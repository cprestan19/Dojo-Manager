import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { distributeParticipantsWithSeeds } from "@/lib/tournament-seeding";

type SessionUser = { role?: string; dojoId?: string | null };

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; bracketId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id, bracketId } = await params;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  const tournament = await prisma.tournament.findFirst({ where: { id, dojoId } });
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  const bracket = await prisma.tournamentBracket.findFirst({
    where: { id: bracketId, tournamentId: id },
    include: {
      participants: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!bracket) return NextResponse.json({ error: "Bracket no encontrado" }, { status: 404 });

  // ── CONFIRM action ──────────────────────────────────────────────────────────
  if (action === "confirm") {
    if (bracket.status !== "ready") {
      return NextResponse.json(
        { error: "El bracket debe estar en estado 'Bracket Listo' para confirmar" },
        { status: 400 },
      );
    }
    if (bracket.participants.length < 2) {
      return NextResponse.json(
        { error: "Se necesitan al menos 2 participantes" },
        { status: 400 },
      );
    }

    const updated = await prisma.tournamentBracket.update({
      where: { id: bracketId },
      data: { bracketLocked: true, status: "active" },
    });

    // If tournament isn't active yet, move it to active
    if (tournament.status === "draft" || tournament.status === "ready") {
      await prisma.tournament.update({
        where: { id },
        data: { status: "active", bracketLocked: true },
      });
    }

    return NextResponse.json(updated);
  }

  // ── GENERATE / REGENERATE bracket ──────────────────────────────────────────
  if (bracket.bracketLocked) {
    return NextResponse.json(
      { error: "El bracket está confirmado y no puede regenerarse" },
      { status: 400 },
    );
  }

  if (bracket.participants.length < 2) {
    return NextResponse.json(
      { error: "Se necesitan al menos 2 participantes para generar el bracket" },
      { status: 400 },
    );
  }

  try {
    const bracketSize  = nextPowerOf2(bracket.participants.length);
    const totalRounds  = Math.log2(bracketSize);

    // Use seeding if any participant has a seed > 0, otherwise shuffle randomly
    const hasSeeds = bracket.participants.some(p => p.seed > 0);

    let orderedIds: string[];
    if (hasSeeds) {
      const distributed = distributeParticipantsWithSeeds(
        bracket.participants.map(p => ({ id: p.id, seed: p.seed })),
        bracketSize,
      );
      // distributed is sorted by position (1..bracketSize); fill gaps with nulls
      orderedIds = distributed.map(d => d.id);
    } else {
      orderedIds = shuffle(bracket.participants.map(p => p.id));
    }

    // Fill slots with participant IDs and nulls for byes
    const slots: (string | null)[] = [
      ...orderedIds,
      ...Array(bracketSize - orderedIds.length).fill(null),
    ];

    type MatchData = {
      tournamentId: string;
      bracketId: string;
      round: number;
      matchNumber: number;
      participant1Id: string | null;
      participant2Id: string | null;
      winnerId: string | null;
      isBye: boolean;
    };

    const matchesToCreate: MatchData[] = [];

    // Round 1 matches
    for (let i = 0; i < bracketSize / 2; i++) {
      const p1 = slots[i * 2] ?? null;
      const p2 = slots[i * 2 + 1] ?? null;
      const isBye = p1 !== null && p2 === null;
      const winnerId = isBye ? p1 : null;

      matchesToCreate.push({
        tournamentId: id,
        bracketId,
        round: 1,
        matchNumber: i + 1,
        participant1Id: p1,
        participant2Id: p2,
        winnerId,
        isBye,
      });
    }

    // Rounds 2..N (empty matches, winners advance)
    for (let round = 2; round <= totalRounds; round++) {
      const matchesInRound = bracketSize / Math.pow(2, round);
      for (let m = 1; m <= matchesInRound; m++) {
        matchesToCreate.push({
          tournamentId: id,
          bracketId,
          round,
          matchNumber: m,
          participant1Id: null,
          participant2Id: null,
          winnerId: null,
          isBye: false,
        });
      }
    }

    // Delete existing matches for this bracket and create new ones
    await prisma.$transaction([
      prisma.tournamentMatch.deleteMany({ where: { tournamentId: id, bracketId } }),
      prisma.tournamentMatch.createMany({ data: matchesToCreate }),
      prisma.tournamentBracket.update({
        where: { id: bracketId },
        data: { status: "ready" },
      }),
    ]);

    // Now propagate bye winners to round 2
    if (totalRounds >= 2) {
      const round1Matches = await prisma.tournamentMatch.findMany({
        where: { tournamentId: id, bracketId, round: 1 },
        orderBy: { matchNumber: "asc" },
      });

      const byeWinners = round1Matches.filter((m) => m.isBye && m.winnerId);

      for (const byeMatch of byeWinners) {
        const nextMatchNum = Math.ceil(byeMatch.matchNumber / 2);
        const isOdd = byeMatch.matchNumber % 2 === 1;

        await prisma.tournamentMatch.updateMany({
          where: { tournamentId: id, bracketId, round: 2, matchNumber: nextMatchNum },
          data: isOdd
            ? { participant1Id: byeMatch.winnerId }
            : { participant2Id: byeMatch.winnerId },
        });
      }

      // Auto-advance if round 2 match now has a bye
      const round2Matches = await prisma.tournamentMatch.findMany({
        where: { tournamentId: id, bracketId, round: 2 },
        orderBy: { matchNumber: "asc" },
      });

      for (const r2Match of round2Matches) {
        if (r2Match.participant1Id !== null && r2Match.participant2Id === null) {
          await prisma.tournamentMatch.update({
            where: { id: r2Match.id },
            data: { winnerId: r2Match.participant1Id, isBye: true },
          });
          // Propagate to round 3 if exists
          if (totalRounds >= 3) {
            const nextMatchNum = Math.ceil(r2Match.matchNumber / 2);
            const isOdd = r2Match.matchNumber % 2 === 1;
            await prisma.tournamentMatch.updateMany({
              where: { tournamentId: id, bracketId, round: 3, matchNumber: nextMatchNum },
              data: isOdd
                ? { participant1Id: r2Match.participant1Id }
                : { participant2Id: r2Match.participant1Id },
            });
          }
        }
      }
    }

    const finalMatches = await prisma.tournamentMatch.findMany({
      where: { tournamentId: id, bracketId },
      orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
    });

    return NextResponse.json({ matches: finalMatches, status: "ready" });
  } catch (err) {
    console.error("POST /api/tournaments/[id]/brackets/[bracketId]/bracket error:", err);
    return NextResponse.json({ error: "Error interno al generar el bracket" }, { status: 500 });
  }
}
