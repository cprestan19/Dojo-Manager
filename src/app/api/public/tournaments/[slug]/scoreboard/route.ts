import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

  // Para cada tatami, cargar el match activo con participantes
  const tatamiData = await Promise.all(
    tatamis.map(async (tatami) => {
      if (!tatami.currentMatchId) return { ...tatami, currentMatch: null };

      const match = await prisma.tournamentMatch.findUnique({
        where: { id: tatami.currentMatchId },
        select: {
          id: true, round: true, matchNumber: true,
          score1: true, score2: true, winnerId: true,
          bracket: { select: { name: true, type: true } },
          judgeScores: {
            select: { score1: true, score2: true, kataScore1: true, kataScore2: true, scoreType: true },
          },
        },
      });

      // Cargar participantes por separado para evitar relaciones FK complejas
      let participant1: { fullName: string; beltColor: string | null } | null = null;
      let participant2: { fullName: string; beltColor: string | null } | null = null;

      const fullMatch = await prisma.tournamentMatch.findUnique({
        where: { id: tatami.currentMatchId },
        select: { participant1Id: true, participant2Id: true },
      });

      if (fullMatch?.participant1Id) {
        const p = await prisma.tournamentParticipant.findUnique({
          where:  { id: fullMatch.participant1Id },
          select: { student: { select: { fullName: true, beltHistory: { orderBy: { changeDate: "desc" }, take: 1, select: { beltColor: true } } } } },
        });
        if (p) participant1 = { fullName: p.student.fullName, beltColor: p.student.beltHistory[0]?.beltColor ?? null };
      }
      if (fullMatch?.participant2Id) {
        const p = await prisma.tournamentParticipant.findUnique({
          where:  { id: fullMatch.participant2Id },
          select: { student: { select: { fullName: true, beltHistory: { orderBy: { changeDate: "desc" }, take: 1, select: { beltColor: true } } } } },
        });
        if (p) participant2 = { fullName: p.student.fullName, beltColor: p.student.beltHistory[0]?.beltColor ?? null };
      }

      // Calcular scores totales de jueces
      const judgeScores = match?.judgeScores ?? [];
      const totalScore1 = judgeScores.reduce((a, s) => a + (s.score1 ?? 0), 0);
      const totalScore2 = judgeScores.reduce((a, s) => a + (s.score2 ?? 0), 0);

      return {
        ...tatami,
        currentMatch: match ? {
          ...match,
          participant1, participant2,
          judgeTotal1: totalScore1,
          judgeTotal2: totalScore2,
        } : null,
      };
    })
  );

  return NextResponse.json({
    tournament: { id: tournament.id, name: tournament.name, status: tournament.status },
    tatamis:    tatamiData,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
