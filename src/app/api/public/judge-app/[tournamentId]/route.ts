/**
 * API pública para el App del Juez — sin autenticación de sesión.
 * Solo accesible cuando el torneo está en estado ready/active/completed.
 * Protegida por Tournament.judgePin (query ?pin=) cuando el torneo lo tiene
 * configurado — ver verifyJudgePin() en tournament-security.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyJudgePin } from "@/lib/tournament-security";

type Params = { params: Promise<{ tournamentId: string }> };

const ALLOWED_STATUSES = ["ready", "active", "completed", "confirmed"];

export async function GET(req: NextRequest, { params }: Params) {
  const { tournamentId } = await params;

  const tournament = await prisma.tournament.findUnique({
    where:  { id: tournamentId },
    select: { id: true, name: true, status: true, judgePin: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  // Solo torneos activos/listos — no exponer info de torneos en borrador
  if (!ALLOWED_STATUSES.includes(tournament.status)) {
    return NextResponse.json({ error: "Torneo no disponible" }, { status: 403 });
  }

  const pin = new URL(req.url).searchParams.get("pin");
  if (!(await verifyJudgePin(tournamentId, pin))) {
    return NextResponse.json({ error: "PIN incorrecto", pinRequired: true }, { status: 403 });
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

  // judgePin NUNCA se retorna al cliente — solo se usó para validar arriba.
  const publicTournament = { id: tournament.id, name: tournament.name, status: tournament.status };

  return NextResponse.json({ tournament: publicTournament, judges, tatamis }, {
    headers: { "Cache-Control": "no-store" },
  });
}
