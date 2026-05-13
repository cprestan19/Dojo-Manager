import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function POST(
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
    if (!bracket) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });

    if (bracket.bracketLocked)
      return NextResponse.json({ error: "La categoría está confirmada y no se puede modificar" }, { status: 400 });

    const participants = await prisma.tournamentParticipant.findMany({
      where: { tournamentId: id, bracketId },
      select: { id: true },
    });

    if (participants.length < 1)
      return NextResponse.json({ error: "No hay participantes en esta categoría" }, { status: 400 });

    // Shuffle con Fisher-Yates
    const shuffled = [...participants].sort(() => Math.random() - 0.5);

    // Actualizar seeds en transacción
    await prisma.$transaction(
      shuffled.map((p, i) =>
        prisma.tournamentParticipant.update({
          where: { id: p.id },
          data:  { seed: i + 1 },
        })
      )
    );

    // Marcar bracket como "ready" (orden generado)
    await prisma.tournamentBracket.update({
      where: { id: bracketId },
      data:  { status: "ready" },
    });

    return NextResponse.json({ ok: true, count: shuffled.length });
  } catch (err) {
    console.error("POST /kata-order error:", err);
    return NextResponse.json({ error: "Error al generar el orden" }, { status: 500 });
  }
}
