import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { participantName, participantBelt } from "@/lib/tournament-participant-display";

/** Público — sin auth. Devuelve estado en tiempo real de todos los tatamis. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const tournament = await prisma.tournament.findFirst({
    where:  { publicSlug: slug, isPublic: true },
    select: { id: true, name: true, status: true },
  });
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  const tatamis = await prisma.tournamentTatami.findMany({
    where:   { tournamentId: tournament.id, active: true },
    orderBy: { order: "asc" },
    select: {
      id: true, name: true, color: true, order: true,
      streamStatus: true, overlayMessage: true, youtubeVideoId: true,
      currentMatchId: true,
    },
  });

  // Cargar TODOS los matches activos (uno por tatami) en una sola query en
  // vez de una findUnique por tatami — antes eran hasta 2 queries de match
  // (una duplicada) + 2 de participantes POR tatami, todo secuencial.
  const matchIds = tatamis.map(t => t.currentMatchId).filter((id): id is string => !!id);

  const matches = matchIds.length ? await prisma.tournamentMatch.findMany({
    where: { id: { in: matchIds } },
    select: {
      id: true, round: true, matchNumber: true,
      score1: true, score2: true, winnerId: true,
      participant1Id: true, participant2Id: true,
      bracket: { select: { name: true, type: true } },
      judgeScores: { select: { score1: true, score2: true } },
    },
  }) : [];
  const matchById = new Map(matches.map(m => [m.id, m]));

  const participantSelect = {
    student: { select: { fullName: true, beltHistory: { orderBy: { changeDate: "desc" as const }, take: 1, select: { beltColor: true } } } },
    externalAthlete: { select: { firstName: true, lastName: true, beltColor: true } },
  };

  const participantIds = [...new Set(
    matches.flatMap(m => [m.participant1Id, m.participant2Id]).filter((id): id is string => !!id)
  )];
  const participants = participantIds.length ? await prisma.tournamentParticipant.findMany({
    where:  { id: { in: participantIds } },
    select: { id: true, ...participantSelect },
  }) : [];
  const participantById = new Map(participants.map(p => [p.id, p]));

  const toParticipant = (id: string | null) => {
    if (!id) return null;
    const p = participantById.get(id);
    return p ? { fullName: participantName(p), beltColor: participantBelt(p) } : null;
  };

  const tatamiData = tatamis.map(tatami => {
    const match = tatami.currentMatchId ? matchById.get(tatami.currentMatchId) : undefined;
    if (!match) return { ...tatami, currentMatch: null };

    const judgeScores = match.judgeScores ?? [];
    const totalScore1 = judgeScores.reduce((a, s) => a + (s.score1 ?? 0), 0);
    const totalScore2 = judgeScores.reduce((a, s) => a + (s.score2 ?? 0), 0);

    return {
      ...tatami,
      currentMatch: {
        id: match.id, round: match.round, matchNumber: match.matchNumber,
        score1: match.score1, score2: match.score2, winnerId: match.winnerId,
        bracket: match.bracket,
        participant1: toParticipant(match.participant1Id),
        participant2: toParticipant(match.participant2Id),
        judgeTotal1: totalScore1,
        judgeTotal2: totalScore2,
      },
    };
  });

  return NextResponse.json({
    tournament: { id: tournament.id, name: tournament.name, status: tournament.status },
    tatamis:    tatamiData,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
