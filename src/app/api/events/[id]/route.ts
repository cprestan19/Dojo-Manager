import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

async function resolveEvent(id: string, dojoId: string) {
  return prisma.event.findFirst({ where: { id, dojoId } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;
  const existing = await resolveEvent(id, dojoId);
  if (!existing) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const { title, description, location, imageUrl, startDate, endDate } = await req.json();

  if (!title?.trim())
    return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
  if (!startDate || !endDate)
    return NextResponse.json({ error: "Las fechas son requeridas" }, { status: 400 });
  if (new Date(endDate) <= new Date(startDate))
    return NextResponse.json({ error: "La fecha de fin debe ser posterior al inicio" }, { status: 400 });

  const updated = await prisma.event.update({
    where: { id },
    data: {
      title:       title.trim(),
      description: description?.trim() || null,
      location:    location?.trim()    || null,
      imageUrl:    imageUrl            || null,
      startDate:   new Date(startDate),
      endDate:     new Date(endDate),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;
  const existing = await resolveEvent(id, dojoId);
  if (!existing) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  await prisma.event.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
