/**
 * GET /api/tournaments/[id]/external-clubs/[clubId]   → detalle del club
 * PUT /api/tournaments/[id]/external-clubs/[clubId]   → aprobar / rechazar / actualizar estado
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyTournamentOwnership, verifyClubOwnership } from "@/lib/tournament-security";
import { logAudit } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string; clubId: string }> };
type SessionUser = { id?: string; email?: string };

// ── GET — detalle del club ────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const { id, clubId } = await params;

  const ownership = await verifyTournamentOwnership(id, req);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.error === "No autenticado" ? 401 : 403 });
  }

  const valid = await verifyClubOwnership(clubId, ownership.dojoId!, id);
  if (!valid) return NextResponse.json({ error: "Club no encontrado" }, { status: 404 });

  const club = await prisma.externalClub.findFirst({
    where: { id: clubId, dojoId: ownership.dojoId!, tournamentId: id },
    include: {
      athletes: {
        where:   { dojoId: ownership.dojoId! },
        include: { categories: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      },
    },
  });

  return NextResponse.json({ club });
}

// ── PUT — actualizar estado del club ─────────────────────────

export async function PUT(req: NextRequest, { params }: Params) {
  const { id, clubId } = await params;

  const ownership = await verifyTournamentOwnership(id, req);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.error === "No autenticado" ? 401 : 403 });
  }

  const valid = await verifyClubOwnership(clubId, ownership.dojoId!, id);
  if (!valid) return NextResponse.json({ error: "Club no encontrado" }, { status: 404 });

  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser;

  const body = await req.json().catch(() => ({})) as {
    status?:          string;
    paymentStatus?:   string;
    paymentRef?:      string;
    paymentNotes?:    string;
    rejectionReason?: string;
    notes?:           string;
  };

  const validStatuses      = ["pending", "approved", "rejected", "waitlist"];
  const validPayStatuses   = ["unpaid", "partial", "paid", "waived"];

  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
  if (body.paymentStatus && !validPayStatuses.includes(body.paymentStatus)) {
    return NextResponse.json({ error: "Estado de pago inválido" }, { status: 400 });
  }

  const club = await prisma.externalClub.findUnique({
    where:  { id: clubId },
    select: { status: true, paymentStatus: true, coachEmail: true, coachName: true, clubName: true },
  });
  if (!club) return NextResponse.json({ error: "Club no encontrado" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.status         !== undefined) {
    data.status = body.status;
    if (body.status === "approved") data.approvedAt = new Date(), data.approvedBy = user?.email ?? null;
    if (body.status === "rejected") data.rejectionReason = body.rejectionReason ?? null;
  }
  if (body.paymentStatus  !== undefined) data.paymentStatus  = body.paymentStatus;
  if (body.paymentRef     !== undefined) data.paymentRef     = body.paymentRef?.trim() || null;
  if (body.paymentNotes   !== undefined) data.paymentNotes   = body.paymentNotes?.trim() || null;
  if (body.notes          !== undefined) data.notes          = body.notes?.trim() || null;

  // Marcar fecha de pago cuando pasa a "paid"
  if (body.paymentStatus === "paid" && club.paymentStatus !== "paid") {
    data.paidAt = new Date();
  }

  await prisma.externalClub.update({ where: { id: clubId }, data });

  await logAudit({
    action:    "EXTERNAL_CLUB_STATUS_CHANGED",
    userId:    user?.id,
    userEmail: user?.email,
    dojoId:    ownership.dojoId!,
    details:   JSON.stringify({ clubId, changes: body }),
  });

  // Notificar al coach por email cuando hay cambio de estado
  if (body.status && body.status !== club.status) {
    const statusMessages: Record<string, string> = {
      approved:  "Tu inscripción ha sido <strong>APROBADA</strong>. ¡Ya puedes continuar con el pago!",
      rejected:  `Tu inscripción ha sido <strong>RECHAZADA</strong>${body.rejectionReason ? `: ${body.rejectionReason}` : "."}`,
      waitlist:  "Tu inscripción está en <strong>LISTA DE ESPERA</strong>. Te notificaremos si hay cupos disponibles.",
    };
    const msg = statusMessages[body.status];
    if (msg) {
      try {
        await sendEmail({
          to:      club.coachEmail,
          subject: `Actualización de inscripción — ${club.clubName}`,
          html:    `<div style="font-family:Arial,sans-serif;padding:24px;max-width:560px;">
            <h2 style="color:#C0392B;">Actualización de tu inscripción</h2>
            <p>Hola <strong>${club.coachName}</strong>,</p>
            <p>${msg}</p>
            <p style="color:#888;font-size:12px;">Equipo DojoManager</p>
          </div>`,
        });
      } catch (e) {
        console.error("[external-clubs] email error:", e);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
