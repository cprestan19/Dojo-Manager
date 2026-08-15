/**
 * PATCH /api/superadmin/dojo-lifecycle-messages/[id]
 * Marca una fila existente (ej. una PENDING que dejó el registro automático)
 * como contactada manualmente por Cristhian — cambia status a "SENT" y
 * channel a "manual", sin pasar por WhatsApp/Meta.
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
  const existing = await prisma.dojoLifecycleMessage.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { note?: string };

  const updated = await prisma.dojoLifecycleMessage.update({
    where: { id },
    data: {
      status:  "SENT",
      channel: "manual",
      sentAt:  new Date(),
      ...(body.note?.trim() ? { note: body.note.trim() } : {}),
    },
  });

  return NextResponse.json(updated);
}
