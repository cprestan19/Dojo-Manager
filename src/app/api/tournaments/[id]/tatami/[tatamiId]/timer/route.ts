/**
 * Control del cronómetro (Sencho) por tatami.
 * Público: el juez/cronometrador lo usa sin login.
 * action: "start" | "pause" | "reset"
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Params = { params: Promise<{ id: string; tatamiId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { tatamiId } = await params;
  const { action } = await req.json().catch(() => ({})) as { action?: string };

  const tatami = await prisma.tournamentTatami.findUnique({
    where:  { id: tatamiId },
    select: { matchTimerRunning: true, matchTimerBaseElapsed: true, currentMatchStartedAt: true },
  });
  if (!tatami) return NextResponse.json({ error: "Tatami no encontrado" }, { status: 404 });

  let data: Record<string, unknown> = {};

  if (action === "start") {
    if (tatami.matchTimerRunning) return NextResponse.json({ ok: true }); // ya corriendo
    // Nuevo inicio: ajustar startedAt para que el elapsed acumulado se preserve
    const now = new Date();
    const adjustedStart = new Date(now.getTime() - tatami.matchTimerBaseElapsed * 1000);
    data = { matchTimerRunning: true, currentMatchStartedAt: adjustedStart };

  } else if (action === "pause") {
    if (!tatami.matchTimerRunning) return NextResponse.json({ ok: true }); // ya pausado
    // Calcular segundos transcurridos hasta ahora
    const started = tatami.currentMatchStartedAt;
    const elapsed = started
      ? Math.floor((Date.now() - started.getTime()) / 1000)
      : tatami.matchTimerBaseElapsed;
    data = { matchTimerRunning: false, matchTimerBaseElapsed: elapsed };

  } else if (action === "reset") {
    data = { matchTimerRunning: false, matchTimerBaseElapsed: 0, currentMatchStartedAt: null };

  } else {
    return NextResponse.json({ error: "action inválida: start | pause | reset" }, { status: 400 });
  }

  const updated = await prisma.tournamentTatami.update({
    where:  { id: tatamiId },
    data,
    select: { matchTimerRunning: true, matchTimerBaseElapsed: true, currentMatchStartedAt: true },
  });

  return NextResponse.json({ ok: true, ...updated });
}
