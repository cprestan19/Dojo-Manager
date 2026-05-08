import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

/**
 * Cascade-clears a winner from all subsequent matches within the same bracket.
 * When a winner is corrected, we must remove the old winner's advancement
 * from every next-round match they had been placed in (and so on recursively).
 */
async function cascadeClearWinner(
  tournamentId: string,
  bracketId: string | null,
  oldWinnerId: string,
  fromRound: number,
  fromMatchNumber: number,
): Promise<void> {
  const nextRound     = fromRound + 1;
  const nextMatchNum  = Math.ceil(fromMatchNumber / 2);
  const isOdd         = fromMatchNumber % 2 === 1;

  const nextMatch = await prisma.tournamentMatch.findFirst({
    where: {
      tournamentId,
      ...(bracketId ? { bracketId } : { bracketId: null }),
      round: nextRound,
      matchNumber: nextMatchNum,
    },
  });
  if (!nextMatch) return; // was the final round — nothing to cascade

  const slotHasOldWinner = isOdd
    ? nextMatch.participant1Id === oldWinnerId
    : nextMatch.participant2Id === oldWinnerId;

  if (!slotHasOldWinner) return; // old winner wasn't placed here (already corrected)

  // If the next match itself had a winner that derived from oldWinnerId, cascade further first
  if (nextMatch.winnerId && nextMatch.winnerId !== oldWinnerId) {
    // The winner of the next match was someone else — their slot may also need clearing further up
    // but only if oldWinnerId was the source of that match's slot
    await cascadeClearWinner(tournamentId, bracketId, nextMatch.winnerId, nextRound, nextMatch.matchNumber);
  } else if (nextMatch.winnerId === oldWinnerId) {
    // oldWinner also won the next match — cascade from there too
    await cascadeClearWinner(tournamentId, bracketId, oldWinnerId, nextRound, nextMatch.matchNumber);
  }

  // Clear old winner from the slot and reset winner/bye status
  await prisma.tournamentMatch.update({
    where: { id: nextMatch.id },
    data: {
      ...(isOdd ? { participant1Id: null } : { participant2Id: null }),
      winnerId: null,
      isBye:    false,
    },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id, matchId } = await params;

  const tournament = await prisma.tournament.findFirst({ where: { id, dojoId } });
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  // Permitir puntajes en active, completed Y confirmed (torneo completado/bloqueado)
  const allowedStatuses = ["active", "completed", "confirmed"];
  if (!allowedStatuses.includes(tournament.status)) {
    return NextResponse.json(
      { error: "Solo se pueden registrar resultados en torneos activos o completados" },
      { status: 400 },
    );
  }

  try {
    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

    const { score1, score2, winnerId: manualWinnerId } =
      raw as { score1?: number; score2?: number; winnerId?: string };

    // Validate scores: non-negative integers, max 999 (prevents int overflow and UI issues)
    const s1 = score1 !== undefined ? Number(score1) : null;
    const s2 = score2 !== undefined ? Number(score2) : null;

    if (s1 !== null && (!Number.isInteger(s1) || s1 < 0 || s1 > 999))
      return NextResponse.json({ error: "score1 debe ser un entero entre 0 y 999" }, { status: 400 });
    if (s2 !== null && (!Number.isInteger(s2) || s2 < 0 || s2 > 999))
      return NextResponse.json({ error: "score2 debe ser un entero entre 0 y 999" }, { status: 400 });

    const match = await prisma.tournamentMatch.findFirst({
      where: { id: matchId, tournamentId: id },
    });
    if (!match) return NextResponse.json({ error: "Match no encontrado" }, { status: 404 });

    // Auto-determine winner from scores; fall back to manualWinnerId for ties
    let winnerId = manualWinnerId ?? null;
    if (s1 !== null && s2 !== null) {
      if (s1 > s2)      winnerId = match.participant1Id;
      else if (s2 > s1) winnerId = match.participant2Id;
      // tie → keep manualWinnerId
    }

    if (!winnerId)
      return NextResponse.json(
        { error: "Empate: debes seleccionar el ganador manualmente" },
        { status: 400 },
      );

    if (winnerId !== match.participant1Id && winnerId !== match.participant2Id)
      return NextResponse.json(
        { error: "El ganador debe ser uno de los participantes del match" },
        { status: 400 },
      );

    // Cascade-clear old winner before setting the new one
    if (match.winnerId && match.winnerId !== winnerId) {
      await cascadeClearWinner(id, match.bracketId, match.winnerId, match.round, match.matchNumber);
    }

    // Save winner + scores
    await prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        winnerId,
        ...(s1 !== null ? { score1: s1 } : {}),
        ...(s2 !== null ? { score2: s2 } : {}),
      },
    });

    // Fetch all matches for this bracket (cascade may have modified some)
    const bracketFilter = match.bracketId
      ? { tournamentId: id, bracketId: match.bracketId }
      : { tournamentId: id, bracketId: null as string | null };

    const allMatches = await prisma.tournamentMatch.findMany({
      where: bracketFilter,
      orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
    });

    if (allMatches.length === 0)
      return NextResponse.json({ error: "No se encontraron matches para este bracket" }, { status: 500 });

    const maxRound = Math.max(...allMatches.map((m) => m.round));

    if (match.round < maxRound) {
      // Advance winner to the next round
      const nextRound    = match.round + 1;
      const nextMatchNum = Math.ceil(match.matchNumber / 2);
      const isOdd        = match.matchNumber % 2 === 1;

      const nextMatch = allMatches.find(
        (m) => m.round === nextRound && m.matchNumber === nextMatchNum,
      );

      if (nextMatch) {
        // Place the winner in their designated slot of the next round.
        // Do NOT auto-advance further: the opponent slot may still be empty
        // because their match hasn't been played yet — that is not a bye.
        // Byes are already resolved at bracket-generation time.
        const slotData = isOdd ? { participant1Id: winnerId } : { participant2Id: winnerId };
        await prisma.tournamentMatch.update({
          where: { id: nextMatch.id },
          data: slotData,
        });
      }
    }

    // Re-evaluate bracket + tournament status.
    // Re-fetch allMatches (may have changed via cascade) — single query replaces 2 redundant fetches
    const refreshedMatches = await prisma.tournamentMatch.findMany({
      where: bracketFilter,
      orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
    });
    const refreshedMax     = refreshedMatches.length > 0
      ? Math.max(...refreshedMatches.map(m => m.round)) : 0;
    const finalMatch       = refreshedMatches.find(m => m.round === refreshedMax);
    const bracketCompleted = !!finalMatch?.winnerId;

    // Parallel: update bracket status + fetch brackets list for tournament check
    const [, allBrackets] = await Promise.all([
      match.bracketId
        ? prisma.tournamentBracket.update({
            where: { id: match.bracketId },
            data:  { status: bracketCompleted ? "completed" : "active" },
          })
        : Promise.resolve(null),
      prisma.tournamentBracket.findMany({
        where:  { tournamentId: id },
        select: { id: true, status: true },
      }),
    ]);

    let newTournamentStatus: string;
    if (allBrackets.length > 0) {
      const allDone = allBrackets.every(
        b => b.status === "completed" || (b.id === match.bracketId && bracketCompleted),
      );
      newTournamentStatus = allDone ? "completed" : "active";
    } else {
      // Legacy path (no brackets)
      newTournamentStatus = bracketCompleted ? "completed" : "active";
    }

    // Parallel: update tournament + fetch updated data for response
    const [updatedTournament, updatedMatches] = await Promise.all([
      prisma.tournament.update({
        where: { id },
        data:  { status: newTournamentStatus },
      }),
      prisma.tournamentMatch.findMany({
        where:   { tournamentId: id },
        orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
      }),
    ]);

    return NextResponse.json({ matches: updatedMatches, tournament: updatedTournament });
  } catch (err) {
    console.error("PUT /api/tournaments/[id]/matches/[matchId] error:", err);
    return NextResponse.json({ error: "Error interno al registrar resultado" }, { status: 500 });
  }
}
