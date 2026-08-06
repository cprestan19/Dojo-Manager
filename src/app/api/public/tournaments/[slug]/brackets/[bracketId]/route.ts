/**
 * GET /api/public/tournaments/[slug]/brackets/[bracketId]
 * Detalle público de una categoría: llave completa (kumite) u orden de
 * actuación (kata) — para la página pública de resultados en vivo.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { participantName, participantPhoto, participantClubName } from "@/lib/tournament-participant-display";
import { computeStandings } from "@/lib/round-robin";

type Params = { params: Promise<{ slug: string; bracketId: string }> };

const PARTICIPANT_SELECT = {
  id: true, seed: true, poolNumber: true,
  student: { select: { fullName: true, photo: true, dojo: { select: { name: true } } } },
  externalAthlete: {
    select: { firstName: true, lastName: true, photoUrl: true, externalClub: { select: { clubName: true } } },
  },
} as const;

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug, bracketId } = await params;

  const tournament = await prisma.tournament.findFirst({
    where:  { publicSlug: slug, isPublic: true },
    select: { id: true },
  });
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  const bracket = await prisma.tournamentBracket.findFirst({
    where:  { id: bracketId, tournamentId: tournament.id },
    select: {
      id: true, name: true, type: true, gender: true, categoryLabel: true,
      status: true, bracketLocked: true, format: true,
    },
  });
  if (!bracket) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });

  const participants = await prisma.tournamentParticipant.findMany({
    where:   { tournamentId: tournament.id, bracketId },
    orderBy: { seed: "asc" },
    select:  PARTICIPANT_SELECT,
  });

  const athletes = participants.map(p => ({
    id:       p.id,
    seed:     p.seed,
    name:     participantName(p),
    photo:    participantPhoto(p),
    club:     participantClubName(p),
  }));

  if (bracket.type === "kata") {
    return NextResponse.json({
      bracket: { id: bracket.id, name: bracket.categoryLabel ?? bracket.name, type: "kata", status: bracket.status },
      athletes,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  // ── Kumite: llave completa con participantes resueltos por match ──────────
  const matches = await prisma.tournamentMatch.findMany({
    where:   { tournamentId: tournament.id, bracketId },
    orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
    select: {
      id: true, round: true, matchNumber: true, poolNumber: true,
      participant1Id: true, participant2Id: true,
      score1: true, score2: true, winnerId: true, isBye: true,
    },
  });

  const byId = new Map(athletes.map(a => [a.id, a]));

  if (bracket.format === "round_robin") {
    const participantsByPool: Record<number, string[]> = {};
    for (const p of participants) {
      const pool = p.poolNumber ?? 1;
      (participantsByPool[pool] ??= []).push(p.id);
    }
    const standings = computeStandings(participantsByPool, matches.map(m => ({
      poolNumber: m.poolNumber, participant1Id: m.participant1Id, participant2Id: m.participant2Id,
      score1: m.score1, score2: m.score2, winnerId: m.winnerId, isBye: m.isBye,
    })));

    return NextResponse.json({
      bracket: { id: bracket.id, name: bracket.categoryLabel ?? bracket.name, type: "kumite", format: "round_robin", status: bracket.status },
      standings: standings.map(s => ({ ...s, athlete: byId.get(s.participantId) ?? null })),
      matches: matches.map(m => ({
        id: m.id, poolNumber: m.poolNumber ?? 1, matchNumber: m.matchNumber,
        participant1: m.participant1Id ? byId.get(m.participant1Id) ?? null : null,
        participant2: m.participant2Id ? byId.get(m.participant2Id) ?? null : null,
        score1: m.score1, score2: m.score2, winnerId: m.winnerId, isBye: m.isBye,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    bracket: { id: bracket.id, name: bracket.categoryLabel ?? bracket.name, type: "kumite", format: "single_elim", status: bracket.status },
    matches: matches.map(m => ({
      id: m.id, round: m.round, matchNumber: m.matchNumber,
      participant1: m.participant1Id ? byId.get(m.participant1Id) ?? null : null,
      participant2: m.participant2Id ? byId.get(m.participant2Id) ?? null : null,
      score1: m.score1, score2: m.score2,
      winnerId: m.winnerId, isBye: m.isBye,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
