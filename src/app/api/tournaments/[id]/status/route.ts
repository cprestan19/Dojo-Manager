import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit } from "@/lib/audit";
import { getTournamentStatusFlow } from "@/lib/utils";

type SessionUser = { role?: string; dojoId?: string | null; id?: string; email?: string };

// "confirmed" solo sysadmin puede asignarlo (bloqueo oficial de resultados)
const RESTRICTED_TRANSITIONS = new Set(["confirmed"]);

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as SessionUser;
  if (user.role !== "admin" && user.role !== "sysadmin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id: tournamentId } = await params;

  const tournament = await prisma.tournament.findFirst({ where: { id: tournamentId, dojoId } });
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  const raw = await req.json().catch(() => null);
  if (!raw || !raw.status) {
    return NextResponse.json({ error: "status es requerido" }, { status: 400 });
  }

  const newStatus: string = raw.status;
  const allowedTransitions = getTournamentStatusFlow(tournament.status);

  if (!allowedTransitions.includes(newStatus)) {
    return NextResponse.json(
      { error: `Transición inválida: ${tournament.status} → ${newStatus}` },
      { status: 400 },
    );
  }

  if (RESTRICTED_TRANSITIONS.has(newStatus) && user.role !== "sysadmin") {
    return NextResponse.json(
      { error: "Solo el sysadmin puede hacer esta transición de estado" },
      { status: 403 },
    );
  }

  try {
    const updated = await prisma.tournament.update({
      where: { id: tournamentId },
      data:  { status: newStatus },
    });

    await logAudit({
      action: "TOURNAMENT_STATUS_CHANGED",
      userId: user.id,
      userEmail: user.email,
      dojoId,
      details: JSON.stringify({
        tournamentId,
        tournamentName: tournament.name,
        from: tournament.status,
        to: newStatus,
      }),
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/tournaments/[id]/status error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
