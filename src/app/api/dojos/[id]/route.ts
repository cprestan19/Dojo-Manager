import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidateTag } from "next/cache";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; id?: string; email?: string };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role } = session.user as SessionUser;
  if (role !== "sysadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  const dojo = await prisma.dojo.update({
    where: { id },
    data: {
      name:          body.name,
      active:        body.active        ?? true,
      // logo: solo se toca si viene explícito en el body — antes cualquier
      // llamada que no lo incluyera (activar/desactivar, Torneo Pro, etc.)
      // lo borraba en silencio con `body.logo ?? null`.
      logo:          body.logo          !== undefined ? body.logo          : undefined,
      tournamentPro: body.tournamentPro !== undefined ? Boolean(body.tournamentPro) : undefined,
      featured:      body.featured      !== undefined ? Boolean(body.featured)      : undefined,
    },
    select: {
      id: true, name: true, slug: true, active: true,
      tournamentPro: true, featured: true, createdAt: true,
      logo: true,
    },
  });

  if (body.featured !== undefined) revalidateTag("public-featured-dojos");

  return NextResponse.json({
    ...dojo,
    logo: dojo.logo?.startsWith("http") ? dojo.logo : null,
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as SessionUser;
  if (user.role !== "sysadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const dojo = await prisma.dojo.findUnique({
    where:  { id },
    select: {
      id: true, name: true, slug: true, email: true, phone: true,
      ownerName: true, slogan: true, active: true, tournamentPro: true,
      locale: true, themeId: true, createdAt: true,
      subscription: {
        select: {
          status: true, cycle: true, gateway: true,
          grantedBy: true, grantedAt: true,
          plan: { select: { name: true } },
        },
      },
      _count: {
        select: {
          users: true, students: true, katas: true, schedules: true,
          beltVideos: true, tournaments: true, events: true, storeProducts: true,
          examApplications: true, certificateTemplates: true, generatedCertificates: true,
          registrationLinks: true, pendingStudents: true, externalClubs: true,
          externalAthletes: true, pushSubscriptions: true,
        },
      },
    },
  });
  if (!dojo) return NextResponse.json({ error: "Dojo no encontrado" }, { status: 404 });

  // Snapshot de contexto no cubierto por _count (TournamentEvent no tiene
  // @relation formal a Dojo) + referencia de quién administraba el dojo —
  // se captura ANTES de borrar, para dejar constancia en el log de auditoría
  // ya que los datos en sí no son recuperables tras eliminar.
  const [activeStudents, tournamentEventCount, staffUsers] = await Promise.all([
    prisma.student.count({ where: { dojoId: id, active: true } }),
    prisma.tournamentEvent.count({ where: { dojoId: id } }),
    prisma.user.findMany({
      where:  { dojoId: id, role: { not: "student" } },
      select: { name: true, email: true, role: true, active: true },
    }),
  ]);

  try {
    /*
     * Eliminación en cascada manual — en orden de dependencias.
     *
     * Prisma no tiene onDelete: Cascade en User ni Student porque son
     * relaciones opcionales/requeridas sin cascade declarado. Si se intenta
     * borrar el Dojo directamente, PostgreSQL lanzaría FK constraint violations.
     *
     * Se eliminan ÚNICAMENTE registros de este dojo (dojoId = id).
     * Ningún dato de otro dojo es afectado en ningún paso.
     */
    await prisma.$transaction(async (tx) => {

      // ── 1. Torneos: obtener IDs para los sub-deletes ─────────
      const tournamentIds = (await tx.tournament.findMany({
        where:  { dojoId: id },
        select: { id: true },
      })).map(t => t.id);

      if (tournamentIds.length > 0) {
        const matchIds = (await tx.tournamentMatch.findMany({
          where:  { tournamentId: { in: tournamentIds } },
          select: { id: true },
        })).map(m => m.id);

        if (matchIds.length > 0) {
          // HanteiVote y JudgeScore dependen de matches
          await tx.hanteiVote.deleteMany({ where: { matchId: { in: matchIds } } });
          await tx.tournamentJudgeScore.deleteMany({ where: { matchId: { in: matchIds } } });
        }

        await tx.tournamentMatch.deleteMany({ where: { tournamentId: { in: tournamentIds } } });

        // Estos tienen dojoId propio — filtrar por él para mayor seguridad
        await tx.externalAthleteCategory.deleteMany({ where: { dojoId: id } });
        await tx.externalAthlete.deleteMany({ where: { dojoId: id } });
        await tx.externalClub.deleteMany({ where: { dojoId: id } });

        await tx.tournamentBracket.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
        await tx.tournamentParticipant.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
        await tx.tournamentReferee.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
        await tx.tournamentRegistration.deleteMany({ where: { dojoId: id } });
        await tx.tournamentScheduleSlot.deleteMany({ where: { dojoId: id } });
        await tx.tournamentJudge.deleteMany({ where: { dojoId: id } });
        await tx.tournamentStream.deleteMany({ where: { dojoId: id } });
        await tx.tournamentTatami.deleteMany({ where: { dojoId: id } });

        // TournamentEmailLog no tiene @relation formal a Tournament (campo
        // tournamentId suelto) — sin este delete explícito quedaría huérfano,
        // Postgres no lo bloquea ni lo cascadea porque no hay FK real.
        await tx.tournamentEmailLog.deleteMany({ where: { tournamentId: { in: tournamentIds } } });

        await tx.tournament.deleteMany({ where: { dojoId: id } });
      }

      // ── 1b. Módulo "Asistencia a Torneos" (TournamentEvent) — independiente
      // de Torneo Pro. dojoId es un campo suelto sin @relation formal (a
      // propósito, según el comentario del schema), así que igual que arriba
      // hay que limpiarlo a mano o queda huérfano.
      const tournamentEventIds = (await tx.tournamentEvent.findMany({
        where:  { dojoId: id },
        select: { id: true },
      })).map(e => e.id);

      if (tournamentEventIds.length > 0) {
        await tx.tournamentEventParticipant.deleteMany({ where: { eventId: { in: tournamentEventIds } } });
        await tx.tournamentEvent.deleteMany({ where: { dojoId: id } });
      }

      // ── 2. Alumnos: datos dependientes primero ────────────────
      const studentIds = (await tx.student.findMany({
        where:  { dojoId: id },
        select: { id: true },
      })).map(s => s.id);

      if (studentIds.length > 0) {
        await tx.attendance.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.studentSchedule.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.kataCompetition.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.beltHistory.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.payment.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.inscription.deleteMany({ where: { studentId: { in: studentIds } } });

        // Desvincular la FK studentId de los usuarios portal ANTES de borrar los alumnos
        await tx.user.updateMany({
          where: { studentId: { in: studentIds } },
          data:  { studentId: null },
        });
      }

      await tx.student.deleteMany({ where: { dojoId: id } });

      // ── 3. Todos los usuarios del dojo (admin, user, student portal) ─
      await tx.user.deleteMany({ where: { dojoId: id } });

      // ── 4. Recursos del dojo ──────────────────────────────────
      await tx.kata.deleteMany({ where: { dojoId: id } });
      await tx.schedule.deleteMany({ where: { dojoId: id } });
      await tx.beltVideo.deleteMany({ where: { dojoId: id } });
      await tx.dojoRolePermission.deleteMany({ where: { dojoId: id } });

      // Los siguientes tienen onDelete: Cascade en el schema pero los
      // eliminamos explícitamente para mayor claridad y control.
      await tx.dojoPage.deleteMany({ where: { dojoId: id } });
      await tx.freeTrialRequest.deleteMany({ where: { dojoId: id } });
      await tx.event.deleteMany({ where: { dojoId: id } });
      await tx.storeProduct.deleteMany({ where: { dojoId: id } });
      await tx.dojoOrganization.deleteMany({ where: { dojoId: id } });

      // ── 5. Finalmente el dojo ─────────────────────────────────
      await tx.dojo.delete({ where: { id } });

    }, { timeout: 30_000 });

    // Snapshot completo del dojo eliminado — es la única forma de consultar
    // después estos datos, ya que la eliminación en sí es irreversible.
    // No incluye datos personales de alumnos (fotos, salud, contactos) por
    // proporcionalidad — solo conteos. Sí incluye el staff (nombre/email/rol)
    // como referencia de quién administraba el dojo.
    const snapshot = {
      dojo: {
        id: dojo.id, name: dojo.name, slug: dojo.slug, email: dojo.email,
        phone: dojo.phone, ownerName: dojo.ownerName, slogan: dojo.slogan,
        active: dojo.active, tournamentPro: dojo.tournamentPro,
        locale: dojo.locale, themeId: dojo.themeId, createdAt: dojo.createdAt,
      },
      subscription: dojo.subscription ? {
        status:    dojo.subscription.status,
        cycle:     dojo.subscription.cycle,
        gateway:   dojo.subscription.gateway,
        planName:  dojo.subscription.plan.name,
        grantedBy: dojo.subscription.grantedBy,
        grantedAt: dojo.subscription.grantedAt,
      } : null,
      counts: {
        ...dojo._count,
        activeStudents,
        tournamentEvents: tournamentEventCount,
      },
      staffUsers,
      deletedAt: new Date().toISOString(),
    };

    await logAudit({
      action:       "DOJO_DELETED",
      module:       "SYSADMIN",
      resourceType: "Dojo",
      resourceId:   id,
      userId:       user.id,
      userEmail:    user.email,
      dojoId:       id,
      dojoSlug:     dojo.slug,
      statusCode:   200,
      details:      JSON.stringify(snapshot),
    });

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("[dojos/DELETE] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error al eliminar el dojo" }, { status: 500 });
  }
}
