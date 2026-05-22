/**
 * GET  → estado del Hantei (público — no expone votos individuales hasta "decided")
 * POST → árbitro llama el Hantei (requiere auth de admin/sysadmin)
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyTournamentOwnership } from "@/lib/tournament-security";
import { requiresHantei } from "@/lib/hantei";
import { logAudit } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type Params = { params: Promise<{ id: string; matchId: string }> };
type SessionUser = { id?: string; email?: string };

// ── GET — estado del Hantei ───────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, matchId } = await params;

  const match = await prisma.tournamentMatch.findFirst({
    where:  { id: matchId, tournamentId: id },
    select: {
      id: true,
      hanteiStatus:    true,
      hanteiVotesAo:   true,
      hanteiVotesAka:  true,
      hanteiWinnerId:  true,
      hanteiCalledAt:  true,
      hanteiDecidedAt: true,
      participant1Id:  true,
      participant2Id:  true,
      score1: true, score2: true, senshu: true, winnerId: true, isBye: true,
    },
  });
  if (!match) return NextResponse.json({ error: "Combate no encontrado" }, { status: 404 });

  const judgesVoted = await prisma.hanteiVote.count({ where: { matchId } });

  return NextResponse.json({
    hanteiStatus:   match.hanteiStatus,
    votesAo:        match.hanteiVotesAo,
    votesAka:       match.hanteiVotesAka,
    winnerId:       match.hanteiWinnerId,
    calledAt:       match.hanteiCalledAt,
    decidedAt:      match.hanteiDecidedAt,
    judgesVoted,
    requiresHantei: requiresHantei(match),
  }, { headers: { "Cache-Control": "no-store" } });
}

// ── POST — árbitro llama el Hantei ────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const { id, matchId } = await params;

  const ownership = await verifyTournamentOwnership(id, req);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.error === "No autenticado" ? 401 : 403 });
  }

  const match = await prisma.tournamentMatch.findFirst({
    where:  { id: matchId, tournamentId: id },
    select: { id: true, score1: true, score2: true, senshu: true, winnerId: true, isBye: true, hanteiStatus: true },
  });
  if (!match) return NextResponse.json({ error: "Combate no encontrado" }, { status: 404 });

  if (!requiresHantei(match)) {
    return NextResponse.json({ error: "Este combate no requiere Hantei — ya hay un ganador por puntos o senshu" }, { status: 400 });
  }
  if (match.hanteiStatus !== "none") {
    return NextResponse.json({ error: "El Hantei ya fue iniciado para este combate" }, { status: 409 });
  }

  await prisma.tournamentMatch.update({
    where: { id: matchId },
    data:  { hanteiStatus: "voting", hanteiCalledAt: new Date() },
  });

  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  await logAudit({
    action:    "HANTEI_CALLED",
    userId:    user?.id,
    userEmail: user?.email,
    dojoId:    ownership.dojoId!,
    details:   JSON.stringify({ matchId, tournamentId: id }),
  });

  return NextResponse.json({ ok: true, status: "voting" });
}
