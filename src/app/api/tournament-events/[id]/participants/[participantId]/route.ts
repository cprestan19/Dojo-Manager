/**
 * PUT /api/tournament-events/[id]/participants/[participantId]
 *
 * Guarda los resultados de un participante (kata + kumite).
 * Sincroniza automáticamente con KataCompetition (historial de competencias).
 *
 * CONCURRENCIA: Soporta ediciones simultáneas de alumnos distintos sin problema.
 * Locking optimista opcional: si el cliente envía `updatedAt`, se valida contra DB
 * y se retorna 409 si otro usuario guardó mientras tanto.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type Params = { params: Promise<{ id: string; participantId: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

const MAX_LEN = {
  category:         100,
  kataName:         200,
  kataResult:       200,
  kumiteResult:     200,
  competitionNotes: 1000,
} as const;

export async function PUT(req: NextRequest, { params }: Params) {
  try {
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
        id: true, studentId: true, updatedAt: true,
        arrived: true, kataResult: true, kumiteResult: true,
        kataCompetitionId: true, kumiteCompetitionId: true,
      },
    });
    if (!participant) return NextResponse.json({ error: "Participante no encontrado" }, { status: 404 });

    const student = await prisma.student.findUnique({
      where:  { id: participant.studentId },
      select: { fullName: true, studentCode: true },
    });

    const body = await req.json().catch(() => ({})) as {
      arrived?:          boolean;
      category?:         string | null;
      kataName?:         string | null;
      kataResult?:       string | null;
      kumiteResult?:     string | null;
      competitionNotes?: string | null;
      confirmed?:        boolean;
      optedOut?:         boolean;
      optedOutReason?:   string | null;
      updatedAt?:        string;   // ISO string — locking optimista opcional
    };

    // ── Locking optimista (si el cliente envía updatedAt) ─────────────────────
    if (body.updatedAt) {
      const clientTs  = new Date(body.updatedAt).getTime();
      const serverTs  = participant.updatedAt.getTime();
      if (Math.abs(clientTs - serverTs) > 999) {
        return NextResponse.json({
          error:    "El registro fue modificado por otro usuario. Por favor recarga y vuelve a intentar.",
          conflict: true,
        }, { status: 409 });
      }
    }

    // ── Validación de longitud ────────────────────────────────────────────────
    const trim = (v?: string | null) => v?.trim() ?? null;
    if (trim(body.category)     && trim(body.category)!.length     > MAX_LEN.category)
      return NextResponse.json({ error: `Categoría: máximo ${MAX_LEN.category} caracteres` }, { status: 422 });
    if (trim(body.kataName)     && trim(body.kataName)!.length     > MAX_LEN.kataName)
      return NextResponse.json({ error: `Nombre de kata: máximo ${MAX_LEN.kataName} caracteres` }, { status: 422 });
    if (trim(body.kataResult)   && trim(body.kataResult)!.length   > MAX_LEN.kataResult)
      return NextResponse.json({ error: `Resultado kata: máximo ${MAX_LEN.kataResult} caracteres` }, { status: 422 });
    if (trim(body.kumiteResult) && trim(body.kumiteResult)!.length > MAX_LEN.kumiteResult)
      return NextResponse.json({ error: `Resultado kumite: máximo ${MAX_LEN.kumiteResult} caracteres` }, { status: 422 });
    if (trim(body.competitionNotes) && trim(body.competitionNotes)!.length > MAX_LEN.competitionNotes)
      return NextResponse.json({ error: `Notas: máximo ${MAX_LEN.competitionNotes} caracteres` }, { status: 422 });

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
        notes:      [body.category ? `Cat: ${body.category}` : "", body.kataName ? `Kata: ${body.kataName}` : "", body.competitionNotes ?? ""].filter(Boolean).join(" | ") || null,
      };

      if (kataCompetitionId) {
        await prisma.kataCompetition.update({
          where: { id: kataCompetitionId },
          data:  kataData,
        }).catch(() => { kataCompetitionId = null; });
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
        notes:      [body.category ? `Cat: ${body.category}` : "", `Kumite`, body.competitionNotes ?? ""].filter(Boolean).join(" | "),
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
        ...(body.kataName         !== undefined ? { kataName:         body.kataName?.trim()         || null } : {}),
        ...(body.kataResult       !== undefined ? { kataResult:       body.kataResult?.trim()       || null } : {}),
        ...(body.kumiteResult     !== undefined ? { kumiteResult:     body.kumiteResult?.trim()     || null } : {}),
        ...(body.competitionNotes !== undefined ? { competitionNotes: body.competitionNotes?.trim() || null } : {}),
        kataCompetitionId,
        kumiteCompetitionId,
      },
    });

    // Campos vía SQL directo — garantiza compatibilidad aunque el cliente Prisma esté cacheado
    if (body.category !== undefined) {
      const v = body.category?.trim() || null;
      await prisma.$executeRaw`UPDATE tournament_event_participants SET category = ${v} WHERE id = ${participantId}`;
    }
    if (body.confirmed !== undefined) {
      const conf = body.confirmed === true;
      await prisma.$executeRaw`UPDATE tournament_event_participants SET confirmed = ${conf} WHERE id = ${participantId}`;
    }
    if (body.optedOut !== undefined) {
      const opted   = body.optedOut === true;
      const reason  = body.optedOutReason?.trim() || null;
      await prisma.$executeRaw`UPDATE tournament_event_participants SET opted_out = ${opted}, opted_out_reason = ${reason} WHERE id = ${participantId}`;
    }

    // ── Auditoría ────────────────────────────────────────────────────────────
    const arrivedChanged  = body.arrived !== undefined && body.arrived !== participant.arrived;
    const resultsChanged  = (body.kataResult   !== undefined && (body.kataResult?.trim()   || null) !== participant.kataResult)
                         || (body.kumiteResult  !== undefined && (body.kumiteResult?.trim() || null) !== participant.kumiteResult);

    if (arrivedChanged || resultsChanged) {
      const action = arrivedChanged && body.arrived
        ? "TOURNAMENT_ATTENDANCE_REGISTERED"
        : arrivedChanged && !body.arrived
        ? "TOURNAMENT_ATTENDANCE_REMOVED"
        : "TOURNAMENT_RESULT_SAVED";

      const ctx = buildAuditCtx(session, req, { dojoId });
      await logAudit({
        ...ctx,
        action,
        module:       AUDIT_MODULE.TOURNAMENTS,
        resourceType: "TournamentEventParticipant",
        resourceId:   participantId,
        statusCode:   200,
        details: JSON.stringify({
          event:   { id: eventId, name: event.name },
          student: { id: participant.studentId, fullName: student?.fullName ?? "—", studentCode: student?.studentCode ?? null },
          before: {
            arrived:      participant.arrived,
            kataResult:   participant.kataResult,
            kumiteResult: participant.kumiteResult,
          },
          after: {
            ...(body.arrived      !== undefined ? { arrived:      body.arrived }                        : {}),
            ...(body.kataResult   !== undefined ? { kataResult:   body.kataResult?.trim()   || null }   : {}),
            ...(body.kumiteResult !== undefined ? { kumiteResult: body.kumiteResult?.trim() || null }    : {}),
            ...(body.category     !== undefined ? { category:     body.category?.trim()     || null }    : {}),
            ...(body.kataName     !== undefined ? { kataName:     body.kataName?.trim()     || null }    : {}),
          },
        }),
      });
    }

    return NextResponse.json({ ok: true, updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    console.error("[PUT participant]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
