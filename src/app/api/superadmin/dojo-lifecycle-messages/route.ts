/**
 * CRM "Primera Etapa" — panel Superadmin (uso futuro de /dashboard/superadmin/clientes).
 * GET  → lista el historial de mensajes/contactos por dojo.
 * POST → registra un contacto MANUAL nuevo (Cristhian le escribió por fuera
 *        de cualquier disparador automático — ej. lo llamó, no hay fila previa).
 * Sin dojoId de aislamiento — a propósito, ver nota en el modelo del schema.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { role } = session.user as SessionUser;
  if (role !== "sysadmin") return NextResponse.json({ error: "Solo sysadmin puede acceder" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const dojoId = searchParams.get("dojoId");
  const status = searchParams.get("status");

  const messages = await prisma.dojoLifecycleMessage.findMany({
    where: {
      ...(dojoId ? { dojoId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      dojo: {
        select: {
          name: true, phone: true, email: true, active: true,
          whatsappOptIn: true, whatsappOptOutDate: true, createdAt: true,
          _count: { select: { students: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return NextResponse.json(messages, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { role } = session.user as SessionUser;
  if (role !== "sysadmin") return NextResponse.json({ error: "Solo sysadmin puede acceder" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { dojoId?: string; note?: string };
  if (!body.dojoId || !body.note?.trim()) {
    return NextResponse.json({ error: "dojoId y note son requeridos" }, { status: 400 });
  }

  const dojo = await prisma.dojo.findUnique({ where: { id: body.dojoId }, select: { id: true } });
  if (!dojo) return NextResponse.json({ error: "Dojo no encontrado" }, { status: 404 });

  const created = await prisma.dojoLifecycleMessage.create({
    data: {
      dojoId:  body.dojoId,
      type:    "MANUAL",
      channel: "manual",
      status:  "SENT",
      sentAt:  new Date(),
      note:    body.note.trim(),
    },
  });

  return NextResponse.json(created, { status: 201 });
}
