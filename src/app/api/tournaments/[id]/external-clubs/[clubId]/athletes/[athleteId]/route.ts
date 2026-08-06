/**
 * PUT /api/tournaments/[id]/external-clubs/[clubId]/athletes/[athleteId]
 * Aprobación/rechazo puntual de un atleta externo (excepción al aprobar por club).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { verifyTournamentOwnership, verifyClubOwnership } from "@/lib/tournament-security";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string; clubId: string; athleteId: string }> };
type SessionUser = { id?: string; email?: string };

const VALID_STATUSES = ["pending", "approved", "rejected", "waitlist"];

export async function PUT(req: NextRequest, { params }: Params) {
  const { id, clubId, athleteId } = await params;

  const ownership = await verifyTournamentOwnership(id, req);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.error === "No autenticado" ? 401 : 403 });
  }
  const validClub = await verifyClubOwnership(clubId, ownership.dojoId!, id);
  if (!validClub) return NextResponse.json({ error: "Club no encontrado" }, { status: 404 });

  const athlete = await prisma.externalAthlete.findFirst({
    where:  { id: athleteId, externalClubId: clubId, dojoId: ownership.dojoId! },
    select: { id: true, status: true },
  });
  if (!athlete) return NextResponse.json({ error: "Atleta no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { status?: string; rejectionReason?: string };
  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  await prisma.externalAthlete.update({
    where: { id: athleteId },
    data:  { status: body.status },
  });

  // Rechazar/poner en espera al atleta también retira sus categorías del bracket;
  // aprobarlo aprueba las categorías que seguían pendientes.
  if (body.status === "approved") {
    await prisma.externalAthleteCategory.updateMany({
      where: { athleteId, status: "pending" },
      data:  { status: "approved" },
    });
  } else if (body.status === "rejected" || body.status === "waitlist") {
    await prisma.externalAthleteCategory.updateMany({
      where: { athleteId, status: { in: ["pending", "approved"] } },
      data:  { status: body.status === "rejected" ? "rejected" : "waitlist", rejectionReason: body.rejectionReason ?? null },
    });

    // Sacarlo de cualquier bracket donde ya hubiera sido generado como participante
    const linkedBrackets = await prisma.tournamentParticipant.findMany({
      where:  { externalAthleteId: athleteId },
      select: { bracketId: true },
    });
    await prisma.tournamentParticipant.deleteMany({ where: { externalAthleteId: athleteId } });
    const bracketIds = [...new Set(linkedBrackets.map(b => b.bracketId).filter((b): b is string => !!b))];
    if (bracketIds.length > 0) {
      await prisma.tournamentBracket.updateMany({
        where: { id: { in: bracketIds }, status: { not: "draft" } },
        data:  { status: "draft" },
      });
    }
  }

  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser;
  await logAudit({
    action:    "TOURNAMENT_EXTERNAL_ATHLETE_STATUS_CHANGED",
    userId:    user?.id,
    userEmail: user?.email,
    dojoId:    ownership.dojoId!,
    details:   JSON.stringify({ athleteId, clubId, from: athlete.status, to: body.status }),
  });

  return NextResponse.json({ ok: true });
}
