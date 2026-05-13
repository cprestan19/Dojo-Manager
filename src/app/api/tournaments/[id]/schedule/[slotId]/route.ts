import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; slotId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id: tournamentId, slotId } = await params;

  const existing = await prisma.tournamentScheduleSlot.findFirst({
    where: { id: slotId, tournamentId, dojoId },
  });
  if (!existing) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  try {
    const updated = await prisma.tournamentScheduleSlot.update({
      where: { id: slotId },
      data: {
        ...(raw.startTime   !== undefined ? { startTime: raw.startTime }              : {}),
        ...(raw.endTime     !== undefined ? { endTime: raw.endTime ?? null }          : {}),
        ...(raw.eventType   !== undefined ? { eventType: raw.eventType }              : {}),
        ...(raw.title       !== undefined ? { title: raw.title.trim() }              : {}),
        ...(raw.description !== undefined ? { description: raw.description ?? null } : {}),
        ...(raw.tatamiId    !== undefined ? { tatamiId: raw.tatamiId ?? null }       : {}),
        ...(raw.order       !== undefined ? { order: raw.order }                     : {}),
      },
      include: {
        tatami: { select: { id: true, name: true, color: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/tournaments/[id]/schedule/[slotId] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; slotId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id: tournamentId, slotId } = await params;

  const existing = await prisma.tournamentScheduleSlot.findFirst({
    where: { id: slotId, tournamentId, dojoId },
  });
  if (!existing) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  try {
    await prisma.tournamentScheduleSlot.delete({ where: { id: slotId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tournaments/[id]/schedule/[slotId] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
