import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null; id?: string; email?: string };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; bracketId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as SessionUser;

  // Solo SYSADMIN puede reabrir brackets confirmados
  if (user.role !== "sysadmin")
    return NextResponse.json({ error: "Solo sysadmin puede reabrir brackets confirmados" }, { status: 403 });

  const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id, bracketId } = await params;

  try {
    const tournament = await prisma.tournament.findFirst({ where: { id, dojoId } });
    if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

    const bracket = await prisma.tournamentBracket.findFirst({
      where: { id: bracketId, tournamentId: id },
    });
    if (!bracket) return NextResponse.json({ error: "Bracket no encontrado" }, { status: 404 });

    const body = await req.json().catch(() => ({})) as { reason?: string };
    const reason = body.reason?.trim() ?? "";
    if (!reason)
      return NextResponse.json({ error: "El motivo de reapertura es obligatorio" }, { status: 400 });

    const previousStatus = bracket.status;

    // Revertir el bracket a draft
    const updated = await prisma.tournamentBracket.update({
      where: { id: bracketId },
      data: { status: "draft", bracketLocked: false },
    });

    // Si el torneo estaba confirmado, revertirlo también
    if (tournament.status === "confirmed" || tournament.bracketLocked) {
      await prisma.tournament.update({
        where: { id },
        data: { status: "active", bracketLocked: false },
      });
    }

    // Registrar en audit log
    await logAudit({
      action:    "BRACKET_REOPENED",
      userId:    user.id,
      userEmail: user.email,
      dojoId,
      details:   JSON.stringify({ bracketId, bracketName: bracket.name, previousStatus, reason }),
    });

    return NextResponse.json({ ok: true, bracket: updated });
  } catch (err) {
    console.error("POST /api/tournaments/[id]/brackets/[bracketId]/reopen error:", err);
    return NextResponse.json({ error: "Error interno al reabrir bracket" }, { status: 500 });
  }
}
