/**
 * POST /api/tournaments/[id]/external-clubs/generate-participants
 *
 * Puente entre el flujo de inscripción pública (ExternalAthlete/ExternalAthleteCategory)
 * y el sistema real de brackets/marcador (TournamentParticipant/TournamentMatch).
 *
 * Toma las categorías de atletas externos ya aprobadas (club aprobado, atleta aprobado,
 * categoría aprobada) y crea la fila de TournamentParticipant correspondiente en su
 * bracket — de otro modo esos atletas nunca aparecen en el sorteo, el marcador de
 * jueces, el overlay ni la acreditación. Idempotente: correr de nuevo solo agrega
 * los que falten (skipDuplicates sobre @@unique([bracketId, externalAthleteId])).
 *
 * No exige pago confirmado — el organizador decide si arma brackets antes de
 * conciliar todos los pagos; el estado de pago se sigue viendo aparte en Inscripciones.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null; id?: string; email?: string };
type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as SessionUser;
  if (user.role !== "admin" && user.role !== "sysadmin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;

  const tournament = await prisma.tournament.findFirst({ where: { id, dojoId } });
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  try {
    const eligible = await prisma.externalAthleteCategory.findMany({
      where: {
        tournamentId: id,
        dojoId,
        status:    "approved",
        bracketId: { not: null },
        athlete:   { status: "approved", externalClub: { status: "approved" } },
      },
      select: {
        bracketId: true,
        athleteId: true,
        athlete:   { select: { weight: true } },
        bracket:   { select: { bracketLocked: true } },
      },
    });

    const creatable = eligible.filter(e => e.bracket && !e.bracket.bracketLocked);
    const skippedLocked = eligible.length - creatable.length;

    let created = 0;
    if (creatable.length > 0) {
      const result = await prisma.tournamentParticipant.createMany({
        data: creatable.map(e => ({
          tournamentId:      id,
          bracketId:         e.bracketId as string,
          externalAthleteId: e.athleteId,
          weight:            e.athlete.weight ?? null,
          seed: 0,
        })),
        skipDuplicates: true,
      });
      created = result.count;

      // Los brackets que recibieron participantes nuevos vuelven a "draft" —
      // el organizador debe regenerar el sorteo para incluirlos.
      const affectedBracketIds = [...new Set(creatable.map(e => e.bracketId as string))];
      await prisma.tournamentBracket.updateMany({
        where: { id: { in: affectedBracketIds }, status: { not: "draft" } },
        data:  { status: "draft" },
      });
    }

    await logAudit({
      action:    "TOURNAMENT_EXTERNAL_PARTICIPANTS_GENERATED",
      userId:    user.id,
      userEmail: user.email,
      dojoId,
      details:   JSON.stringify({ tournamentId: id, eligible: eligible.length, created, skippedLocked }),
    });

    return NextResponse.json({
      ok: true,
      eligible: eligible.length,
      created,
      alreadyLinked: eligible.length - creatable.length - skippedLocked,
      skippedLocked,
    });
  } catch (err) {
    console.error("POST /external-clubs/generate-participants error:", err);
    return NextResponse.json({ error: "Error al generar participantes" }, { status: 500 });
  }
}
