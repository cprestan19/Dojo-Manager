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
      select: {
        id: true,
        name: true,
        date: true,
        location: true,
        venue: true,
        city: true,
        country: true,
        organization: true,
        description: true,
        status: true,
        isPublic: true,
        publicSlug: true,
        registrationOpenAt: true,
        registrationCloseAt: true,
        maxParticipants: true,
        organizerName: true,
        organizerEmail: true,
        organizerPhone: true,
        rules: true,
        flyerImage: true,
        tournamentType: true,
        entryFeePerCategory: true,
        feeCurrency: true,
        requireWaiver: true,
        waiverText: true,
        maxAthletesPerClub: true,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    const [tatamis, scheduleSlots, judges, stream] = await Promise.all([
      prisma.tournamentTatami.findMany({
        where: { tournamentId: tournament.id, active: true },
        orderBy: { order: "asc" },
        select: { id: true, name: true, color: true, order: true },
      }),
      prisma.tournamentScheduleSlot.findMany({
        where: { tournamentId: tournament.id },
        orderBy: { order: "asc" },
        include: {
          tatami: { select: { id: true, name: true, color: true } },
        },
      }),
      prisma.tournamentJudge.findMany({
        where: { tournamentId: tournament.id, active: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: { id: true, name: true, role: true, nationality: true, tatamiId: true },
      }),
      prisma.tournamentStream.findUnique({
        where: { tournamentId: tournament.id },
        select: {
          id: true,
          youtubeVideoId: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          status: true,
          overlayMessage: true,
          activeOverlay: true,
          startedAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      ...tournament,
      tatamis,
      scheduleSlots,
      judges,
      stream,
    });
  } catch (err) {
    console.error("GET /api/public/tournaments/[slug] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
