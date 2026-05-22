import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

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
      logo:          body.logo          ?? null,
      tournamentPro: body.tournamentPro !== undefined ? Boolean(body.tournamentPro) : undefined,
    },
    select: {
      id: true, name: true, slug: true, active: true,
      tournamentPro: true, createdAt: true,
      logo: true,
    },
  });
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
    select: { id: true, name: true },
  });
  if (!dojo) return NextResponse.json({ error: "Dojo no encontrado" }, { status: 404 });

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
        await tx.tournament.deleteMany({ where: { dojoId: id } });
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

    await logAudit({
      action:    "DOJO_DELETED",
      userId:    user.id,
      userEmail: user.email,
      dojoId:    id,
      details:   JSON.stringify({ dojoName: dojo.name }),
    });

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("[dojos/DELETE] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error al eliminar el dojo" }, { status: 500 });
  }
}
