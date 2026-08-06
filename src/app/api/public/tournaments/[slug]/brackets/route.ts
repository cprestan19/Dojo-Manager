/**
 * GET /api/public/tournaments/[slug]/brackets
 * Lista pública de categorías (brackets) de un torneo — sin datos de
 * combates, solo lo necesario para que el espectador elija una categoría.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const tournament = await prisma.tournament.findFirst({
    where:  { publicSlug: slug, isPublic: true },
    select: { id: true, name: true, status: true },
  });
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  const brackets = await prisma.tournamentBracket.findMany({
    where:   { tournamentId: tournament.id },
    orderBy: [{ order: "asc" }],
    select: {
      id: true, name: true, type: true, gender: true,
      categoryLabel: true, ageGroup: true, weightCategory: true, beltCategory: true,
      isTeamKata: true, isTeamKumite: true, status: true, bracketLocked: true,
      format: true, poolCount: true,
      _count: { select: { participants: true } },
    },
  });

  return NextResponse.json({
    tournament: { name: tournament.name, status: tournament.status },
    brackets: brackets.map(b => ({
      id: b.id,
      name: b.categoryLabel ?? b.name,
      type: b.type,
      gender: b.gender,
      status: b.status,
      locked: b.bracketLocked,
      format: b.format,
      participants: b._count.participants,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
