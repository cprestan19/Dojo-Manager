/**
 * PUT /api/public/tournament-club/[token]/payment
 * El coach actualiza el estado de pago de su club:
 * paymentRef (referencia) + paymentProofUrl (URL Cloudinary del comprobante).
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCoachToken } from "@/lib/coach-token";
import { checkRateLimit, getClientIp, verifyClubOwnership } from "@/lib/tournament-security";

type Params = { params: Promise<{ token: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, "coach-payment", 10, 60_000)) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const auth = await requireCoachToken(token);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { clubId, dojoId, tournamentId } = auth.payload;

  const ok = await verifyClubOwnership(clubId, dojoId, tournamentId);
  if (!ok) return NextResponse.json({ error: "Club no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as {
    paymentRef?:      string;
    paymentProofUrl?: string;  // URL Cloudinary del comprobante — nunca base64
    paymentNotes?:    string;
  };

  // Validar que la URL sea de Cloudinary si se provee
  if (body.paymentProofUrl && !body.paymentProofUrl.startsWith("https://res.cloudinary.com/")) {
    return NextResponse.json({ error: "paymentProofUrl debe ser una URL de Cloudinary" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.paymentRef      !== undefined) data.paymentRef      = body.paymentRef?.trim() || null;
  if (body.paymentProofUrl !== undefined) data.paymentProofUrl = body.paymentProofUrl || null;
  if (body.paymentNotes    !== undefined) data.paymentNotes    = body.paymentNotes?.trim() || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No hay datos para actualizar" }, { status: 400 });
  }

  await prisma.externalClub.update({ where: { id: clubId }, data });
  return NextResponse.json({ ok: true });
}
