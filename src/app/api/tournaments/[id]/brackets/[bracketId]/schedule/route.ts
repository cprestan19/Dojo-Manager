import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

/** Minutos de buffer para detectar solapamiento entre brackets en el mismo tatami */
const CONFLICT_BUFFER_MINUTES = 30;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; bracketId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id, bracketId } = await params;

  try {
    const tournament = await prisma.tournament.findFirst({ where: { id, dojoId } });
    if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

    const bracket = await prisma.tournamentBracket.findFirst({
      where: { id: bracketId, tournamentId: id },
    });
    if (!bracket) return NextResponse.json({ error: "Bracket no encontrado" }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

    const { scheduledAt, tatami, forceOverride = false } = body as {
      scheduledAt?: string | null;
      tatami?: number | null;
      forceOverride?: boolean;
    };

    // Detección de conflicto de tatami (si hay tatami y horario y no se fuerza)
    if (!forceOverride && tatami && scheduledAt) {
      const targetTime = new Date(scheduledAt);
      const bufferMs   = CONFLICT_BUFFER_MINUTES * 60 * 1000;

      const conflicting = await prisma.tournamentBracket.findFirst({
        where: {
          tournamentId:      id,
          id:                { not: bracketId },
          bracketTatami:     tatami,
          bracketScheduledAt: {
            gte: new Date(targetTime.getTime() - bufferMs),
            lte: new Date(targetTime.getTime() + bufferMs),
          },
        },
      });

      if (conflicting) {
        return NextResponse.json(
          {
            conflict: true,
            conflictingBracket: {
              id:          conflicting.id,
              name:        conflicting.name,
              scheduledAt: conflicting.bracketScheduledAt,
              tatami:      conflicting.bracketTatami,
            },
          },
          { status: 409 },
        );
      }
    }

    const updated = await prisma.tournamentBracket.update({
      where: { id: bracketId },
      data: {
        ...(scheduledAt !== undefined ? { bracketScheduledAt: scheduledAt ? new Date(scheduledAt) : null } : {}),
        ...(tatami      !== undefined ? { bracketTatami: tatami ?? null } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/tournaments/[id]/brackets/[bracketId]/schedule error:", err);
    return NextResponse.json({ error: "Error interno al guardar horario" }, { status: 500 });
  }
}
