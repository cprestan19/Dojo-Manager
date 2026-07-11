/**
 * POST /api/events/[id]/attendance-list
 *
 * Automatiza la Asistencia de Eventos (TournamentEvent) a partir de un Evento
 * del dojo (Event), usando como participantes los alumnos con RSVP "attending".
 *
 * Es idempotente y acumulativo:
 * - Primera vez: crea el TournamentEvent con los alumnos confirmados.
 * - Siguientes veces: solo agrega alumnos recién confirmados y quita a los que
 *   se retractaron SIEMPRE que no tengan ya asistencia/resultados cargados —
 *   nunca se toca a un participante con datos, ni se modifica a nadie que no
 *   cambió su confirmación.
 *
 * Todo corre dentro de una transacción para evitar que un doble clic cree dos
 * listas para el mismo evento.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { withPaidPlanGuard } from "@/lib/billing/featureGuard";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { computeSyncDiff } from "@/lib/tournament-event-sync";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string }> };

export const POST = withPaidPlanGuard(async (req: NextRequest, ctx: unknown) => {
  const t0 = Date.now();
  const { params } = ctx as Params;
  const { id: eventId } = await params;

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const event = await prisma.event.findFirst({
    where:  { id: eventId, dojoId },
    select: { id: true, title: true, description: true, location: true, startDate: true, endDate: true },
  });
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const rsvps = await prisma.eventRSVP.findMany({
    where:  { eventId: event.id, status: "attending" },
    select: { studentId: true },
  });

  // Re-validación: solo alumnos activos y del mismo dojo — nunca confiar en el RSVP a ciegas.
  const validStudents = rsvps.length > 0
    ? await prisma.student.findMany({
        where:  { id: { in: rsvps.map(r => r.studentId) }, dojoId, active: true },
        select: { id: true },
      })
    : [];
  const confirmedIds = new Set(validStudents.map(s => s.id));

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.tournamentEvent.findFirst({
      where:  { dojoId, sourceEventId: event.id },
      select: { id: true },
    });

    if (!existing) {
      if (confirmedIds.size === 0) return { error: "No hay alumnos confirmados para este evento" as const };

      const endStr = event.endDate.toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "long", year: "numeric" });
      const notesParts = [`Fecha fin del evento: ${endStr}`];
      if (event.description?.trim()) notesParts.push(event.description.trim());

      const created = await tx.tournamentEvent.create({
        data: {
          dojoId,
          name:          event.title,
          date:          event.startDate,
          location:      event.location?.trim() || "Por definir",
          notes:         notesParts.join("\n\n"),
          sourceEventId: event.id,
          participants: {
            create: [...confirmedIds].map(studentId => ({ studentId })),
          },
        },
        select: { id: true },
      });
      return { id: created.id, created: true, added: confirmedIds.size, removed: 0 };
    }

    const currentParticipants = await tx.tournamentEventParticipant.findMany({
      where:  { eventId: existing.id },
      select: {
        id: true, studentId: true, arrived: true, kataResult: true, kumiteResult: true,
        kataCompetitionId: true, kumiteCompetitionId: true, confirmed: true, optedOut: true,
      },
    });

    const { toAdd, toRemove } = computeSyncDiff(confirmedIds, currentParticipants);

    if (toAdd.length > 0) {
      await tx.tournamentEventParticipant.createMany({
        data:           toAdd.map(studentId => ({ eventId: existing.id, studentId })),
        skipDuplicates: true,
      });
    }
    if (toRemove.length > 0) {
      await tx.tournamentEventParticipant.deleteMany({ where: { id: { in: toRemove } } });
    }

    return { id: existing.id, created: false, added: toAdd.length, removed: toRemove.length };
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  if (result.added > 0 || result.removed > 0) {
    const auditCtx = buildAuditCtx(session, req, { startTime: t0, dojoId });
    await logAudit({
      ...auditCtx,
      action:       result.created ? "TOURNAMENT_EVENT_CREATED_FROM_EVENT" : "TOURNAMENT_EVENT_SYNCED_FROM_EVENT",
      module:       AUDIT_MODULE.TOURNAMENTS,
      resourceType: "TournamentEvent",
      resourceId:   result.id,
      statusCode:   result.created ? 201 : 200,
      details:      JSON.stringify({ sourceEventId: event.id, name: event.title, added: result.added, removed: result.removed }),
    });
  }

  return NextResponse.json(result, { status: result.created ? 201 : 200 });
});
