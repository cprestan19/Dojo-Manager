/**
 * API pública de display por tatami.
 * Sin autenticación — corre en TVs del venue.
 * Devuelve toda la información necesaria para la pantalla del público.
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Params = { params: Promise<{ tatamiId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { tatamiId } = await params;

  const tatami = await prisma.tournamentTatami.findUnique({
    where:  { id: tatamiId },
    select: {
      id: true, name: true, color: true, streamStatus: true,
      overlayMessage: true, currentMatchId: true, tournamentId: true,
      currentMatchStartedAt: true, matchTimerRunning: true, matchTimerBaseElapsed: true, matchDurationSecs: true,
      matchDisplayState: true, winnerParticipantId: true, winnerReason: true, matchWonAt: true,
      videoReviewEnabled: true,
    },
  });

  if (!tatami) return NextResponse.json({ error: "Tatami no encontrado" }, { status: 404 });

  const tournamentRaw = await prisma.tournament.findUnique({
    where:  { id: tatami.tournamentId },
    select: { id: true, name: true, status: true, dojo: { select: { name: true, logo: true } } },
  });

  if (!tournamentRaw) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  // Torneos archivados no se muestran en el overlay
  if (tournamentRaw.status === "archived") {
    return NextResponse.json({ error: "Torneo archivado" }, { status: 403 });
  }

  // Sanitizar logo — nunca retornar base64 en respuesta pública
  const tournament = {
    ...tournamentRaw,
    dojo: {
      ...tournamentRaw.dojo,
      logo: tournamentRaw.dojo.logo?.startsWith("http") ? tournamentRaw.dojo.logo : null,
    },
  };

  // Datos de combate (participantes, scores) solo cuando el torneo está operativo.
  // En borrador se muestra el tatami pero sin datos de participantes — útil para setup/pruebas.
  const MATCH_DATA_ALLOWED = ["ready", "active", "completed", "confirmed"];
  const allowMatchData = MATCH_DATA_ALLOWED.includes(tournament.status);

  // Sin match activo, o torneo aún en borrador → solo info del tatami
  if (!tatami.currentMatchId || !allowMatchData) {
    return NextResponse.json({
      tatami: { id: tatami.id, name: tatami.name, color: tatami.color, streamStatus: tatami.streamStatus, overlayMessage: tatami.overlayMessage, matchStartedAt: null, timerRunning: false, timerBase: 0, matchDuration: tatami.matchDurationSecs, matchDisplayState: tatami.matchDisplayState, winnerParticipantId: tatami.winnerParticipantId, winnerReason: tatami.winnerReason, matchWonAt: tatami.matchWonAt?.toISOString() ?? null },
      tournament: { id: tournament.id, name: tournament.name, status: tournament.status, dojo: tournament.dojo },
      match:  null,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  // Cargar match activo con toda la info
  const match = await prisma.tournamentMatch.findUnique({
    where:  { id: tatami.currentMatchId },
    select: {
      id: true, round: true, matchNumber: true,
      score1: true, score2: true, winnerId: true, isBye: true, senshu: true,
      reviewStatus: true, reviewRequestedBy: true, reviewDecision: true,
      hanteiStatus: true, hanteiVotesAo: true, hanteiVotesAka: true, hanteiWinnerId: true,
      bracket: { select: { id: true, name: true, type: true, gender: true } },
      judgeScores: {
        select: {
          id: true, scoreType: true,
          ippon1: true, wazaari1: true, yuko1: true,
          ippon2: true, wazaari2: true, yuko2: true,
          chukoku1: true, hansoku1: true,
          chukoku2: true, hansoku2: true,
          penalty1: true, penalty2: true,
          score1: true, score2: true,
          kataScore1: true, kataScore2: true,
          lastTechnique1: true, lastTechnique2: true,
          judge: { select: { id: true, name: true, role: true } },
        },
        orderBy: { judge: { name: "asc" } },
      },
    },
  });

  if (!match) {
    return NextResponse.json({
      tatami: { id: tatami.id, name: tatami.name, color: tatami.color, streamStatus: tatami.streamStatus, overlayMessage: tatami.overlayMessage, matchStartedAt: tatami.currentMatchStartedAt?.toISOString() ?? null, timerRunning: tatami.matchTimerRunning, timerBase: tatami.matchTimerBaseElapsed, matchDuration: tatami.matchDurationSecs, matchDisplayState: tatami.matchDisplayState, winnerParticipantId: tatami.winnerParticipantId, winnerReason: tatami.winnerReason, matchWonAt: tatami.matchWonAt?.toISOString() ?? null, videoReviewEnabled: tatami.videoReviewEnabled },
      tournament,
      match: null,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  // Cargar participantes
  const fullMatch = await prisma.tournamentMatch.findUnique({
    where:  { id: tatami.currentMatchId },
    select: { participant1Id: true, participant2Id: true },
  });

  async function loadParticipant(pid: string | null) {
    if (!pid) return null;
    const p = await prisma.tournamentParticipant.findUnique({
      where:  { id: pid },
      select: {
        id: true, seed: true, weight: true,
        student: {
          select: {
            id: true, fullName: true, photo: true,
            nationality: true,
            beltHistory: { orderBy: { changeDate: "desc" }, take: 1, select: { beltColor: true } },
            dojo: { select: { name: true } },
          },
        },
      },
    });
    if (!p) return null;
    return {
      id:          p.id,
      seed:        p.seed,
      weight:      p.weight ?? null,
      fullName:    p.student.fullName,
      photo:       p.student.photo?.startsWith("http") ? p.student.photo : null,
      nationality: p.student.nationality ?? null,
      dojoName:    p.student.dojo?.name ?? null,
      belt:        p.student.beltHistory[0]?.beltColor ?? null,
    };
  }

  const [participant1, participant2] = await Promise.all([
    loadParticipant(fullMatch?.participant1Id ?? null),
    loadParticipant(fullMatch?.participant2Id ?? null),
  ]);

  // Calcular totales de jueces
  const scores = match.judgeScores;
  const isKata = scores[0]?.scoreType === "kata" || match.bracket?.type === "kata";

  let totals: Record<string, unknown> = {};
  let kataCalc: Record<string, unknown> | null = null;

  if (isKata) {
    const raw1 = scores.map(s => s.kataScore1 ?? 0).sort((a, b) => a - b);
    const raw2 = scores.map(s => s.kataScore2 ?? 0).sort((a, b) => a - b);
    const trim = (arr: number[]) => arr.length <= 2 ? arr : arr.slice(1, -1);
    const avg  = (arr: number[]) => arr.length === 0 ? 0 : parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2));

    kataCalc = {
      raw1, raw2,
      dropped1: raw1.length > 2 ? [raw1[0], raw1[raw1.length-1]] : [],
      dropped2: raw2.length > 2 ? [raw2[0], raw2[raw2.length-1]] : [],
      total1: avg(trim(raw1)),
      total2: avg(trim(raw2)),
    };
    totals = { total1: (kataCalc as { total1: number }).total1, total2: (kataCalc as { total2: number }).total2 };
  } else {
    const totalIppon1   = scores.reduce((a, s) => a + (s.ippon1   ?? 0), 0);
    const totalWazaari1 = scores.reduce((a, s) => a + (s.wazaari1 ?? 0), 0);
    const totalYuko1    = scores.reduce((a, s) => a + (s.yuko1    ?? 0), 0);
    const totalIppon2   = scores.reduce((a, s) => a + (s.ippon2   ?? 0), 0);
    const totalWazaari2 = scores.reduce((a, s) => a + (s.wazaari2 ?? 0), 0);
    const totalYuko2    = scores.reduce((a, s) => a + (s.yuko2    ?? 0), 0);
    const totalChukoku1 = scores.reduce((a, s) => a + (s.chukoku1 ?? 0), 0);
    const totalHansoku1 = scores.reduce((a, s) => a + (s.hansoku1 ?? 0), 0);
    const totalChukoku2 = scores.reduce((a, s) => a + (s.chukoku2 ?? 0), 0);
    const totalHansoku2 = scores.reduce((a, s) => a + (s.hansoku2 ?? 0), 0);
    const lastTech1 = scores.find(s => s.lastTechnique1)?.lastTechnique1 ?? null;
    const lastTech2 = scores.find(s => s.lastTechnique2)?.lastTechnique2 ?? null;

    totals = {
      ippon1: totalIppon1, wazaari1: totalWazaari1, yuko1: totalYuko1,
      ippon2: totalIppon2, wazaari2: totalWazaari2, yuko2: totalYuko2,
      chukoku1: totalChukoku1, hansoku1: totalHansoku1,
      chukoku2: totalChukoku2, hansoku2: totalHansoku2,
      total1: totalIppon1*3 + totalWazaari1*2 + totalYuko1,
      total2: totalIppon2*3 + totalWazaari2*2 + totalYuko2,
      lastTech1, lastTech2,
    };
  }

  // Determinar ganador
  let winnerName: string | null = null;
  if (match.winnerId) {
    const winnerPart = match.winnerId === fullMatch?.participant1Id ? participant1 : participant2;
    winnerName = winnerPart?.fullName ?? null;
  }

  return NextResponse.json({
    tatami: { id: tatami.id, name: tatami.name, color: tatami.color, streamStatus: tatami.streamStatus, overlayMessage: tatami.overlayMessage, matchStartedAt: tatami.currentMatchStartedAt?.toISOString() ?? null, timerRunning: tatami.matchTimerRunning, timerBase: tatami.matchTimerBaseElapsed, matchDuration: tatami.matchDurationSecs, matchDisplayState: tatami.matchDisplayState, winnerParticipantId: tatami.winnerParticipantId, winnerReason: tatami.winnerReason, matchWonAt: tatami.matchWonAt?.toISOString() ?? null, videoReviewEnabled: tatami.videoReviewEnabled },
    tournament,
    match: {
      id: match.id, round: match.round, matchNumber: match.matchNumber,
      bracketName: match.bracket?.name ?? "", bracketType: match.bracket?.type ?? "kumite",
      bracketGender: match.bracket?.gender ?? "",
      participant1, participant2,
      winnerId: match.winnerId,
      winnerName,
      isKata,
      judgeScores: scores,
      totals,
      kataCalc,
      reviewStatus:      match.reviewStatus,
      reviewRequestedBy: match.reviewRequestedBy,
      reviewDecision:    match.reviewDecision,
      hanteiStatus:      match.hanteiStatus,
      hanteiVotesAo:     match.hanteiVotesAo,
      hanteiVotesAka:    match.hanteiVotesAka,
      hanteiWinnerId:    match.hanteiWinnerId,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
