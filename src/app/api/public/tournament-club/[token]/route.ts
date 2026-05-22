/**
 * GET /api/public/tournament-club/[token]
 * Portal del coach — datos del club, atletas e info del torneo.
 * Sin autenticación NextAuth — token JWT firmado.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCoachToken } from "@/lib/coach-token";
import { checkRateLimit, getClientIp, verifyClubOwnership } from "@/lib/tournament-security";

type Params = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, "coach-portal-get", 30, 60_000)) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const auth = await requireCoachToken(token);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { clubId, dojoId, tournamentId } = auth.payload;

  const validOwner = await verifyClubOwnership(clubId, dojoId, tournamentId);
  if (!validOwner) return NextResponse.json({ error: "Club no encontrado" }, { status: 404 });

  const club = await prisma.externalClub.findFirst({
    where: { id: clubId, dojoId, tournamentId },
    include: {
      tournament: {
        select: {
          name:                true,
          date:                true,
          location:            true,
          registrationCloseAt: true,
          entryFeePerCategory: true,
          feeCurrency:         true,
          requirePhoto:        true,
          requireFederationId: true,
          requireWaiver:       true,
          waiverText:          true,
          maxAthletesPerClub:  true,
          status:              true,
        },
      },
      athletes: {
        where:   { dojoId },
        orderBy: { createdAt: "asc" },
        select: {
          id:          true,
          firstName:   true,
          lastName:    true,
          birthDate:   true,
          gender:      true,
          nationality: true,
          weight:      true,
          beltColor:   true,
          ageGroup:    true,
          status:      true,
          photoUrl:    true,
          // documentId NUNCA se retorna al coach por API
          categories: {
            select: {
              id:              true,
              categoryLabel:   true,
              status:          true,
              feeAmount:       true,
              paymentStatus:   true,
              rejectionReason: true,
              isRanking:       true,
              rankingValidated: true,
              rankingNote:     true,
            },
          },
        },
      },
    },
  });

  if (!club) return NextResponse.json({ error: "Club no encontrado" }, { status: 404 });

  const totalFee = club.athletes.reduce(
    (sum, a) => sum + a.categories.reduce((s, c) => s + (c.feeAmount ?? 0), 0),
    0,
  );
  const registrationOpen = club.tournament.registrationCloseAt
    ? new Date() < new Date(club.tournament.registrationCloseAt)
    : true;

  return NextResponse.json({
    club: {
      id:              club.id,
      clubName:        club.clubName,
      country:         club.country,
      city:            club.city,
      coachName:       club.coachName,
      coachEmail:      club.coachEmail,
      status:          club.status,
      paymentStatus:   club.paymentStatus,
      paymentRef:      club.paymentRef,
      rejectionReason: club.rejectionReason,
    },
    tournament:       club.tournament,
    athletes:         club.athletes,
    totals: {
      athletes:   club.athletes.length,
      categories: club.athletes.reduce((s, a) => s + a.categories.length, 0),
      approved:   club.athletes.reduce((s, a) => s + a.categories.filter(c => c.status === "approved").length, 0),
      totalFee,
      currency:   club.tournament.feeCurrency,
    },
    registrationOpen,
  }, { headers: { "Cache-Control": "no-store" } });
}
