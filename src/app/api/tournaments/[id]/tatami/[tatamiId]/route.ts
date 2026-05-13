import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tatamiId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id: tournamentId, tatamiId } = await params;

  const existing = await prisma.tournamentTatami.findFirst({
    where: { id: tatamiId, tournamentId, dojoId },
  });
  if (!existing) return NextResponse.json({ error: "Tatami no encontrado" }, { status: 404 });

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  try {
    const updated = await prisma.tournamentTatami.update({
      where: { id: tatamiId },
      data: {
        ...(raw.name   !== undefined ? { name: raw.name.trim() }     : {}),
        ...(raw.color  !== undefined ? { color: raw.color }          : {}),
        ...(raw.order  !== undefined ? { order: raw.order }          : {}),
        ...(raw.active !== undefined ? { active: raw.active }        : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/tournaments/[id]/tatami/[tatamiId] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tatamiId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id: tournamentId, tatamiId } = await params;

  const existing = await prisma.tournamentTatami.findFirst({
    where: { id: tatamiId, tournamentId, dojoId },
    include: { _count: { select: { scheduleSlots: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Tatami no encontrado" }, { status: 404 });

  if (existing._count.scheduleSlots > 0) {
    return NextResponse.json(
      { error: "Este tatami tiene eventos asignados. Elimina los eventos primero." },
      { status: 400 },
    );
  }

  try {
    await prisma.tournamentTatami.delete({ where: { id: tatamiId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tournaments/[id]/tatami/[tatamiId] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
