/**
 * PUT /api/tournament-events/[id]/participants/[participantId]
 *
 * Guarda los resultados de un participante (kata + kumite).
 * Sincroniza automáticamente con KataCompetition (historial de competencias).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type Params = { params: Promise<{ id: string; participantId: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id: eventId, participantId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  // Verificar que el evento pertenece al dojo
  const event = await prisma.tournamentEvent.findFirst({
    where:  { id: eventId, dojoId },
    select: { id: true, name: true, date: true },
  });
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const participant = await prisma.tournamentEventParticipant.findFirst({
    where:  { id: participantId, eventId },
    select: {
      id: true, studentId: true,
      kataCompetitionId: true, kumiteCompetitionId: true,
    },
  });
  if (!participant) return NextResponse.json({ error: "Participante no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as {
    arrived?:          boolean;
    kataName?:         string | null;
    kataResult?:       string | null;
    kumiteResult?:     string | null;
    competitionNotes?: string | null;
  };

  // ── Sincronizar con KataCompetition (historial de competencias) ──────────
  let kataCompetitionId    = participant.kataCompetitionId;
  let kumiteCompetitionId  = participant.kumiteCompetitionId;

  // Guardar kata result en KataCompetition
  if (body.kataResult !== undefined) {
    const kataData = {
      studentId:  participant.studentId,
      date:       event.date,
      tournament: event.name,
      result:     body.kataResult ?? null,
      notes:      [body.kataName ? `Kata: ${body.kataName}` : "", body.competitionNotes ?? ""].filter(Boolean).join(" | ") || null,
    };

    if (kataCompetitionId) {
      await prisma.kataCompetition.update({
        where: { id: kataCompetitionId },
        data:  kataData,
      }).catch(() => { kataCompetitionId = null; }); // si fue borrado, crear nuevo
    }

    if (!kataCompetitionId && body.kataResult) {
      const created    = await prisma.kataCompetition.create({ data: kataData, select: { id: true } });
      kataCompetitionId = created.id;
    }
  }

  // Guardar kumite result en KataCompetition (como entrada separada)
  if (body.kumiteResult !== undefined) {
    const kumiteData = {
      studentId:  participant.studentId,
      date:       event.date,
      tournament: event.name,
      result:     body.kumiteResult ?? null,
      notes:      `Kumite${body.competitionNotes ? " | " + body.competitionNotes : ""}`,
    };

    if (kumiteCompetitionId) {
      await prisma.kataCompetition.update({
        where: { id: kumiteCompetitionId },
        data:  kumiteData,
      }).catch(() => { kumiteCompetitionId = null; });
    }

    if (!kumiteCompetitionId && body.kumiteResult) {
      const created      = await prisma.kataCompetition.create({ data: kumiteData, select: { id: true } });
      kumiteCompetitionId = created.id;
    }
  }

  // ── Actualizar participante ──────────────────────────────────────────────
  const updated = await prisma.tournamentEventParticipant.update({
    where: { id: participantId },
    data:  {
      ...(body.arrived !== undefined ? {
        arrived:   body.arrived,
        arrivedAt: body.arrived ? new Date() : null,
      } : {}),
      ...(body.kataName         !== undefined ? { kataName:         body.kataName         } : {}),
      ...(body.kataResult       !== undefined ? { kataResult:       body.kataResult       } : {}),
      ...(body.kumiteResult     !== undefined ? { kumiteResult:     body.kumiteResult     } : {}),
      ...(body.competitionNotes !== undefined ? { competitionNotes: body.competitionNotes } : {}),
      kataCompetitionId,
      kumiteCompetitionId,
    },
  });

  return NextResponse.json({ ok: true, updated });
}
