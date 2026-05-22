/**
 * GET /api/tournaments/[id]/external-clubs
 * Lista todos los clubs externos con sus atletas y totales.
 * Solo admin/sysadmin del dojo organizador.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyTournamentOwnership } from "@/lib/tournament-security";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const ownership = await verifyTournamentOwnership(id, req);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.error === "No autenticado" ? 401 : 403 });
  }

  const clubs = await prisma.externalClub.findMany({
    where:   { tournamentId: id, dojoId: ownership.dojoId! },
    orderBy: { createdAt: "asc" },
    include: {
      athletes: {
        where:   { dojoId: ownership.dojoId! },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          id:         true,
          firstName:  true,
          lastName:   true,
          gender:     true,
          ageGroup:   true,
          weight:     true,
          beltColor:  true,
          nationality: true,
          status:     true,
          accreditedAt: true,
          // documentId y photoUrl NUNCA en lista — solo en endpoint individual
          categories: {
            select: {
              id:            true,
              categoryLabel: true,
              status:        true,
              feeAmount:     true,
              paymentStatus: true,
              isRanking:     true,
              rankingValidated: true,
              rankingSeed:   true,
            },
          },
        },
      },
    },
  });

  // Calcular totales por club
  const clubsWithTotals = clubs.map(club => ({
    id:              club.id,
    clubName:        club.clubName,
    country:         club.country,
    city:            club.city,
    coachName:       club.coachName,
    coachEmail:      club.coachEmail,
    coachPhone:      club.coachPhone,
    federationId:    club.federationId,
    status:          club.status,
    paymentStatus:   club.paymentStatus,
    paymentRef:      club.paymentRef,
    paymentProofUrl: club.paymentProofUrl,
    rejectionReason: club.rejectionReason,
    createdAt:       club.createdAt,
    athletes:        club.athletes,
    totals: {
      athletes:   club.athletes.length,
      categories: club.athletes.reduce((s, a) => s + a.categories.length, 0),
      approved:   club.athletes.reduce((s, a) => s + a.categories.filter(c => c.status === "approved").length, 0),
      fee:        club.athletes.reduce((s, a) => s + a.categories.reduce((cs, c) => cs + (c.feeAmount ?? 0), 0), 0),
    },
  }));

  return NextResponse.json({ clubs: clubsWithTotals });
}
