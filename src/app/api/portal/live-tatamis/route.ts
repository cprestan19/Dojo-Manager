/**
 * GET /api/portal/live-tatamis
 * Tatamis en vivo del dojo del alumno.
 * Solo role=student. NUNCA devuelve youtubeStreamKey.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { role, dojoId } = session.user as SessionUser;
  if (role !== "student") {
    return NextResponse.json({ error: "Solo disponible para alumnos" }, { status: 403 });
  }
  if (!dojoId) return NextResponse.json({ tatamis: [] });

  // TournamentTatami no tiene relación formal con Tournament en el schema.
  // Obtenemos primero los torneos activos del dojo, luego los tatamis live.
  const activeTournaments = await prisma.tournament.findMany({
    where:  { dojoId, status: { in: ["active", "ready"] } },
    select: { id: true, name: true, date: true },
  });

  if (activeTournaments.length === 0) return NextResponse.json({ tatamis: [] });

  const tournamentIds = activeTournaments.map(t => t.id);
  const tournamentMap = Object.fromEntries(activeTournaments.map(t => [t.id, t]));

  const rawTatamis = await prisma.tournamentTatami.findMany({
    where: {
      dojoId,
      tournamentId:   { in: tournamentIds },
      streamStatus:   "live",
      youtubeVideoId: { not: null },
    },
    orderBy: { order: "asc" },
    select: {
      id:             true,
      tournamentId:   true,
      name:           true,
      color:          true,
      youtubeVideoId: true,   // NUNCA youtubeStreamKey
      streamStatus:   true,
      overlayMessage: true,
      currentMatchId: true,
    },
  });

  const tatamis = rawTatamis.map(t => ({
    ...t,
    tournament: tournamentMap[t.tournamentId] ?? null,
  }));

  return NextResponse.json({ tatamis });
}
