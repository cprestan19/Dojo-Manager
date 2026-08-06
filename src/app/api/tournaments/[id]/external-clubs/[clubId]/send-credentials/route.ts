/**
 * POST /api/tournaments/[id]/external-clubs/[clubId]/send-credentials
 * Envía al coach un correo con el código QR de acreditación de cada atleta
 * aprobado del club (para presentar en la entrada del torneo).
 * Requiere club aprobado y pago confirmado/exento.
 */
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import prisma from "@/lib/prisma";
import { verifyTournamentOwnership, verifyClubOwnership } from "@/lib/tournament-security";
import { sendEmail, escHtml } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type Params = { params: Promise<{ id: string; clubId: string }> };
type SessionUser = { id?: string; email?: string };

export async function POST(req: NextRequest, { params }: Params) {
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
      tournament: { select: { name: true } },
      athletes: {
        where:  { status: "approved", qrCode: { not: null } },
        select: {
          id: true, firstName: true, lastName: true, qrCode: true, credentialSentAt: true,
          categories: { where: { status: "approved" }, select: { categoryLabel: true } },
        },
      },
    },
  });
  if (!club) return NextResponse.json({ error: "Club no encontrado" }, { status: 404 });

  if (club.status !== "approved") {
    return NextResponse.json({ error: "El club aún no está aprobado" }, { status: 400 });
  }
  if (!["paid", "waived"].includes(club.paymentStatus)) {
    return NextResponse.json({ error: "El pago del club aún no está confirmado" }, { status: 400 });
  }
  if (club.athletes.length === 0) {
    return NextResponse.json({ error: "No hay atletas aprobados con código de acreditación" }, { status: 400 });
  }

  try {
    const sortedAthletes = [...club.athletes].sort((a, b) => a.lastName.localeCompare(b.lastName));
    const cards = await Promise.all(sortedAthletes.map(async (a) => {
      const qrDataUrl = await QRCode.toDataURL(a.qrCode as string, { width: 220, margin: 1 });
      const cats = a.categories.map(c => escHtml(c.categoryLabel)).join(", ") || "—";
      return `
        <div style="border:1px solid #ddd;border-radius:10px;padding:16px;margin-bottom:14px;text-align:center;">
          <img src="${qrDataUrl}" width="140" height="140" alt="QR" style="display:block;margin:0 auto 8px;" />
          <p style="font-weight:700;margin:0 0 2px;">${escHtml(a.lastName.toUpperCase())}, ${escHtml(a.firstName)}</p>
          <p style="font-size:12px;color:#666;margin:0 0 4px;">${cats}</p>
          <p style="font-family:monospace;font-size:13px;letter-spacing:1px;background:#f4f4f4;padding:4px 8px;border-radius:6px;display:inline-block;">${escHtml(a.qrCode)}</p>
        </div>`;
    }));

    await sendEmail({
      to:      club.coachEmail,
      subject: `Credenciales de acreditación — ${club.tournament.name.replace(/[\r\n]/g, "")}`,
      html: `<div style="font-family:Arial,sans-serif;padding:24px;max-width:480px;margin:0 auto;">
        <h2 style="color:#C0392B;">Credenciales de acreditación</h2>
        <p>Hola <strong>${escHtml(club.coachName)}</strong>, presenta el código QR de cada atleta en la entrada del torneo <strong>${escHtml(club.tournament.name)}</strong>. Si el scanner falla, el código de abajo también puede ingresarse manualmente.</p>
        ${cards.join("")}
        <p style="color:#888;font-size:12px;">Equipo DojoManager</p>
      </div>`,
    });

    await prisma.externalAthlete.updateMany({
      where: { id: { in: club.athletes.map(a => a.id) } },
      data:  { credentialSentAt: new Date() },
    });

    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser;
    await logAudit({
      action:    "TOURNAMENT_CREDENTIALS_SENT",
      userId:    user?.id,
      userEmail: user?.email,
      dojoId:    ownership.dojoId!,
      details:   JSON.stringify({ clubId, tournamentId: id, athletes: club.athletes.length }),
    });

    return NextResponse.json({ ok: true, sent: club.athletes.length });
  } catch (err) {
    console.error("[send-credentials] error:", err);
    return NextResponse.json({ error: "Error al enviar credenciales" }, { status: 500 });
  }
}
