/**
 * API pública — el juez asigna Senshu (先取) manualmente.
 * Requiere judgeId válido del torneo al que pertenece el match.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(req: NextRequest) {
  const { matchId, participantId, judgeId } = await req.json().catch(() => ({})) as {
    matchId?: string; participantId?: string | null; judgeId?: string;
  };

  if (!matchId)  return NextResponse.json({ error: "matchId requerido" },  { status: 400 });
  if (!judgeId)  return NextResponse.json({ error: "judgeId requerido" },  { status: 400 });

  // Cargar match y juez en paralelo
  const [match, judge] = await Promise.all([
    prisma.tournamentMatch.findUnique({
      where:  { id: matchId },
      select: { id: true, tournamentId: true, participant1Id: true, participant2Id: true },
    }),
    prisma.tournamentJudge.findUnique({
      where:  { id: judgeId },
      select: { id: true, tournamentId: true, active: true },
    }),
  ]);

  if (!match)  return NextResponse.json({ error: "Match no encontrado" },  { status: 404 });
  if (!judge)  return NextResponse.json({ error: "Juez no encontrado" },   { status: 404 });
  if (!judge.active) return NextResponse.json({ error: "Juez inactivo" }, { status: 403 });

  // El juez debe pertenecer al mismo torneo que el match
  if (judge.tournamentId !== match.tournamentId) {
    return NextResponse.json({ error: "Juez no pertenece a este torneo" }, { status: 403 });
  }

  // Validar que el participante pertenece al match
  if (participantId !== null && participantId !== undefined) {
    if (participantId !== match.participant1Id && participantId !== match.participant2Id) {
      return NextResponse.json({ error: "Participante no pertenece a este match" }, { status: 400 });
    }
  }

  await prisma.tournamentMatch.update({
    where: { id: matchId },
    data:  { senshu: participantId ?? null },
  });

  return NextResponse.json({ ok: true });
}
