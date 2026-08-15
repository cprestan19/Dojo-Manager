/**
 * PATCH /api/superadmin/whatsapp-inbound/[id]
 * Marca (o desmarca) una respuesta entrante de WhatsApp como atendida.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string };
type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { role } = session.user as SessionUser;
  if (role !== "sysadmin") return NextResponse.json({ error: "Solo sysadmin puede acceder" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.whatsAppInboundMessage.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { handled?: boolean };

  const updated = await prisma.whatsAppInboundMessage.update({
    where: { id },
    data: { handled: body.handled ?? true },
  });

  return NextResponse.json(updated);
}
