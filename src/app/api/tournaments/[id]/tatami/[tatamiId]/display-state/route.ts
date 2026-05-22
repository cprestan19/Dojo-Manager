/**
 * PUT /api/tournaments/[id]/tatami/[tatamiId]/display-state
 * Cambia el estado visual de la pantalla TV del tatami.
 * Estados: "idle" | "active" | "winner" | "next_preview"
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyTournamentOwnership } from "@/lib/tournament-security";

type Params = { params: Promise<{ id: string; tatamiId: string }> };

const VALID_STATES = ["idle", "active", "winner", "next_preview"] as const;
type DisplayState = typeof VALID_STATES[number];

export async function PUT(req: NextRequest, { params }: Params) {
  const { id, tatamiId } = await params;

  const ownership = await verifyTournamentOwnership(id, req);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.error === "No autenticado" ? 401 : 403 });
  }

  const body = await req.json().catch(() => ({})) as {
    state?:       DisplayState;
    winnerId?:    string | null;
    winnerReason?: string | null;
  };

  if (!body.state || !VALID_STATES.includes(body.state)) {
    return NextResponse.json(
      { error: `Estado inválido. Valores válidos: ${VALID_STATES.join(", ")}` },
      { status: 400 },
    );
  }

  const tatami = await prisma.tournamentTatami.findFirst({
    where:  { id: tatamiId, tournamentId: id, dojoId: ownership.dojoId },
    select: { id: true },
  });
  if (!tatami) return NextResponse.json({ error: "Tatami no encontrado" }, { status: 404 });

  const data: Record<string, unknown> = { matchDisplayState: body.state };

  if (body.state === "winner") {
    data.winnerParticipantId = body.winnerId ?? null;
    data.winnerReason        = body.winnerReason ?? "points";
    data.matchWonAt          = new Date();
  }

  if (body.state === "idle" || body.state === "active") {
    data.winnerParticipantId = null;
    data.winnerReason        = null;
    data.matchWonAt          = null;
  }

  const updated = await prisma.tournamentTatami.update({
    where:  { id: tatamiId },
    data,
    select: { id: true, matchDisplayState: true, winnerParticipantId: true, winnerReason: true, matchWonAt: true },
  });

  return NextResponse.json({ ok: true, ...updated });
}
