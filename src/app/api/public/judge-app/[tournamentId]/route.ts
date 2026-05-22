/**
 * API pública para el App del Juez — sin autenticación.
 * Solo accesible cuando el torneo está en estado ready/active/completed.
 * El tournamentId (CUID) actúa como token de acceso de facto.
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Params = { params: Promise<{ tournamentId: string }> };

const ALLOWED_STATUSES = ["ready", "active", "completed", "confirmed"];

export async function GET(_req: Request, { params }: Params) {
  const { tournamentId } = await params;

  const tournament = await prisma.tournament.findUnique({
    where:  { id: tournamentId },
    select: { id: true, name: true, status: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  // Solo torneos activos/listos — no exponer info de torneos en borrador
  if (!ALLOWED_STATUSES.includes(tournament.status)) {
    return NextResponse.json({ error: "Torneo no disponible" }, { status: 403 });
  }

  const [judges, tatamis] = await Promise.all([
    prisma.tournamentJudge.findMany({
      where:   { tournamentId, active: true },
      orderBy: [{ tatamiId: "asc" }, { role: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, role: true, tatamiId: true,
        tatami: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.tournamentTatami.findMany({
      where:   { tournamentId, active: true },
      orderBy: { order: "asc" },
      select:  { id: true, name: true, color: true, order: true },
    }),
  ]);

  return NextResponse.json({ tournament, judges, tatamis }, {
    headers: { "Cache-Control": "no-store" },
  });
}
