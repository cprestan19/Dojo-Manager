/**
 * POST → árbitro cierra la votación y el sistema registra el ganador.
 * Requiere auth de admin/sysadmin.
 * Acepta ?force=1 para cerrar con votos parciales (juez ausente).
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyTournamentOwnership } from "@/lib/tournament-security";
import { calculateHanteiResult } from "@/lib/hantei";
import { logAudit } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type Params = { params: Promise<{ id: string; matchId: string }> };
type SessionUser = { id?: string; email?: string };

export async function POST(req: NextRequest, { params }: Params) {
  const { id, matchId } = await params;

  const ownership = await verifyTournamentOwnership(id, req);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.error === "No autenticado" ? 401 : 403 });
  }

  const match = await prisma.tournamentMatch.findFirst({
    where:  { id: matchId, tournamentId: id },
    select: { id: true, hanteiStatus: true, participant1Id: true, participant2Id: true },
  });
  if (!match) return NextResponse.json({ error: "Combate no encontrado" }, { status: 404 });
  if (match.hanteiStatus !== "voting") {
    return NextResponse.json({ error: "No hay Hantei activo en estado de votación" }, { status: 400 });
  }

  const force = new URL(req.url).searchParams.get("force") === "1";
  const body  = await req.json().catch(() => ({})) as { judgeCount?: number };

  const allVotes = await prisma.hanteiVote.findMany({
    where:  { matchId },
    select: { vote: true, isReferee: true },
  });

  if (allVotes.length === 0) {
    return NextResponse.json({ error: "No hay votos registrados" }, { status: 400 });
  }

  const totalExpected = body.judgeCount ?? Math.max(allVotes.length, 3);
  const result = calculateHanteiResult(
    allVotes as Array<{ vote: "ao" | "aka"; isReferee: boolean }>,
    match.participant1Id ?? "",
    match.participant2Id ?? "",
    totalExpected,
    force,
  );

  if (!result?.winnerId) {
    return NextResponse.json({
      error: "No se pudo determinar el ganador — puede que falten votos o no haya voto del árbitro para desempatar",
    }, { status: 400 });
  }

  // Registrar ganador
  await prisma.tournamentMatch.update({
    where: { id: matchId },
    data: {
      winnerId:        result.winnerId,
      hanteiWinnerId:  result.winnerId,
      hanteiStatus:    "decided",
      hanteiVotesAo:   result.votesAo,
      hanteiVotesAka:  result.votesAka,
      hanteiDecidedAt: new Date(),
    },
  });

  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  await logAudit({
    action:    "HANTEI_DECIDED",
    userId:    user?.id,
    userEmail: user?.email,
    dojoId:    ownership.dojoId!,
    details:   JSON.stringify({
      matchId, tournamentId: id,
      winnerId:  result.winnerId,
      votesAo:   result.votesAo,
      votesAka:  result.votesAka,
      method:    result.method,
    }),
  });

  return NextResponse.json({ ok: true, result });
}
