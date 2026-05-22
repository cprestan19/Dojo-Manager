/**
 * POST → un juez emite su voto en el Hantei (ao o aka).
 * Requiere judgeId válido del torneo (sin NextAuth — como judge-scores).
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/tournament-security";

type Params = { params: Promise<{ id: string; matchId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id, matchId } = await params;
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, "hantei-vote", 20, 60_000)) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as { judgeId?: string; vote?: string };
  const { judgeId, vote } = body;

  if (!judgeId) return NextResponse.json({ error: "judgeId requerido" }, { status: 400 });
  if (!vote || !["ao", "aka"].includes(vote)) {
    return NextResponse.json({ error: "Voto inválido — debe ser 'ao' o 'aka'" }, { status: 400 });
  }

  // Verificar que el juez pertenece a este torneo
  const judge = await prisma.tournamentJudge.findFirst({
    where:  { id: judgeId, tournamentId: id, active: true },
    select: { id: true, role: true, dojoId: true },
  });
  if (!judge) return NextResponse.json({ error: "Juez no autorizado" }, { status: 403 });

  // Verificar estado del match
  const match = await prisma.tournamentMatch.findFirst({
    where:  { id: matchId, tournamentId: id },
    select: { id: true, hanteiStatus: true, participant1Id: true, participant2Id: true },
  });
  if (!match) return NextResponse.json({ error: "Combate no encontrado" }, { status: 404 });
  if (match.hanteiStatus !== "voting") {
    return NextResponse.json({ error: "El Hantei no está en fase de votación" }, { status: 400 });
  }

  const isReferee = ["referee", "chief_referee", "shushin"].includes(judge.role);

  // Registrar voto (upsert — puede cambiar antes del cierre)
  await prisma.hanteiVote.upsert({
    where:  { matchId_judgeId: { matchId, judgeId } },
    create: { matchId, judgeId, tournamentId: id, dojoId: judge.dojoId, vote, isReferee },
    update: { vote, votedAt: new Date() },
  });

  // Recalcular contadores
  const allVotes = await prisma.hanteiVote.findMany({
    where:  { matchId },
    select: { vote: true },
  });
  const votesAo  = allVotes.filter(v => v.vote === "ao").length;
  const votesAka = allVotes.filter(v => v.vote === "aka").length;

  await prisma.tournamentMatch.update({
    where: { id: matchId },
    data:  { hanteiVotesAo: votesAo, hanteiVotesAka: votesAka },
  });

  return NextResponse.json({
    ok:          true,
    yourVote:    vote,
    votesAo,
    votesAka,
    totalVoted:  allVotes.length,
  });
}
