import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const tournament = await prisma.tournament.findFirst({
      where: { publicSlug: slug, isPublic: true },
      select: { id: true, name: true },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    const stream = await prisma.tournamentStream.findUnique({
      where: { tournamentId: tournament.id },
      select: {
        status: true,
        overlayMessage: true,
        activeOverlay: true,
        youtubeVideoId: true,
        title: true,
      },
    });

    return NextResponse.json({
      tournament: { id: tournament.id, name: tournament.name },
      stream,
    });
  } catch (err) {
    console.error("GET /api/public/tournaments/[slug]/stream error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
