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
    const tatamis = await prisma.tournamentTatami.findMany({
      where: { tournamentId, dojoId },
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: { judges: true, scheduleSlots: true },
        },
      },
    });
    return NextResponse.json(tatamis);
  } catch (err) {
    console.error("GET /api/tournaments/[id]/tatami error:", err);
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
  if (!raw || !raw.name?.trim()) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }

  try {
    const agg = await prisma.tournamentTatami.aggregate({
      where: { tournamentId, dojoId },
      _max: { order: true },
    });
    const nextOrder = (agg._max.order ?? 0) + 1;

    const tatami = await prisma.tournamentTatami.create({
      data: {
        tournamentId,
        dojoId,
        name: raw.name.trim(),
        color: raw.color ?? "#C0392B",
        order: nextOrder,
      },
    });
    return NextResponse.json(tatami, { status: 201 });
  } catch (err) {
    console.error("POST /api/tournaments/[id]/tatami error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
