import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id: tournamentId } = await params;

  try {
    const slots = await prisma.tournamentScheduleSlot.findMany({
      where: { tournamentId, dojoId },
      orderBy: { order: "asc" },
      include: {
        tatami: { select: { id: true, name: true, color: true } },
      },
    });
    return NextResponse.json(slots);
  } catch (err) {
    console.error("GET /api/tournaments/[id]/schedule error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id: tournamentId } = await params;

  const tournament = await prisma.tournament.findFirst({ where: { id: tournamentId, dojoId } });
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  const raw = await req.json().catch(() => null);
  if (!raw || !raw.startTime || !raw.eventType || !raw.title?.trim()) {
    return NextResponse.json({ error: "startTime, eventType y title son requeridos" }, { status: 400 });
  }

  try {
    let order = raw.order;
    if (order === undefined || order === null) {
      const agg = await prisma.tournamentScheduleSlot.aggregate({
        where: { tournamentId, dojoId },
        _max: { order: true },
      });
      order = (agg._max.order ?? 0) + 1;
    }

    const slot = await prisma.tournamentScheduleSlot.create({
      data: {
        tournamentId,
        dojoId,
        startTime: raw.startTime,
        endTime: raw.endTime ?? null,
        eventType: raw.eventType,
        title: raw.title.trim(),
        description: raw.description ?? null,
        tatamiId: raw.tatamiId ?? null,
        order,
      },
      include: {
        tatami: { select: { id: true, name: true, color: true } },
      },
    });
    return NextResponse.json(slot, { status: 201 });
  } catch (err) {
    console.error("POST /api/tournaments/[id]/schedule error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
