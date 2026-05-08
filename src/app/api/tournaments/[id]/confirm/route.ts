import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { sendTournamentConfirmationEmails } from "@/lib/email/tournamentEmailService";
import { logAudit } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null; id?: string; email?: string };

/** POST — Completa el torneo (admin/sysadmin).
 *  Requisitos: todos los brackets confirmados + ≥1 árbitro + tatami configurado.
 *  Una vez completado, solo se pueden ingresar puntajes.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as SessionUser;
  if (user.role !== "admin" && user.role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;

  try {
    const tournament = await prisma.tournament.findFirst({
      where: { id, dojoId },
      include: {
        referees: { select: { id: true } },
        brackets: { select: { id: true, name: true, bracketLocked: true } },
      },
    });
    if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

    // ── Validar requisitos ─────────────────────────────────────────────────
    const missing: string[] = [];

    if (tournament.brackets.length === 0) missing.push("No hay brackets creados");

    const pendingBrackets = tournament.brackets.filter(b => !b.bracketLocked);
    if (pendingBrackets.length > 0)
      missing.push(`${pendingBrackets.length} bracket(s) sin confirmar: ${pendingBrackets.map(b => b.name).join(", ")}`);

    if (!tournament.tatami)
      missing.push("Número de tatami no configurado");

    if (tournament.referees.length === 0)
      missing.push("No hay árbitros asignados");

    if (missing.length > 0)
      return NextResponse.json({ error: "Requisitos incompletos", missing }, { status: 400 });

    // ── Confirmar ──────────────────────────────────────────────────────────
    await prisma.tournament.update({
      where: { id },
      data:  { status: "confirmed", bracketLocked: true },
    });

    await logAudit({
      action:    "TOURNAMENT_CONFIRMED",
      userId:    user.id,
      userEmail: user.email,
      dojoId,
      details:   JSON.stringify({ tournamentId: id, name: tournament.name }),
    });

    sendTournamentConfirmationEmails(id).catch(err =>
      console.error("[tournament-confirm] Error enviando correos:", err),
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/tournaments/[id]/confirm error:", err);
    return NextResponse.json({ error: "Error interno al completar torneo" }, { status: 500 });
  }
}

/** DELETE — Reabre el torneo (solo sysadmin). Registra en audit log. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as SessionUser;
  if (user.role !== "sysadmin")
    return NextResponse.json({ error: "Solo sysadmin puede reabrir un torneo completado" }, { status: 403 });

  const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;

  try {
    const tournament = await prisma.tournament.findFirst({ where: { id, dojoId } });
    if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

    if (tournament.status !== "confirmed")
      return NextResponse.json({ error: "El torneo no está en estado completado" }, { status: 400 });

    await prisma.tournament.update({
      where: { id },
      data:  { status: "active", bracketLocked: false },
    });

    await logAudit({
      action:    "TOURNAMENT_REOPENED",
      userId:    user.id,
      userEmail: user.email,
      dojoId,
      details:   JSON.stringify({ tournamentId: id, name: tournament.name }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tournaments/[id]/confirm error:", err);
    return NextResponse.json({ error: "Error interno al reabrir torneo" }, { status: 500 });
  }
}
