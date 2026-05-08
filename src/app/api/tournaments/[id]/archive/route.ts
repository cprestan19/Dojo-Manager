import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null; id?: string; email?: string };

/** POST: inactiva (archiva) el torneo  — body: {} */
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
    const existing = await prisma.tournament.findFirst({ where: { id, dojoId } });
    if (!existing) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    if (existing.archivedAt)
      return NextResponse.json({ error: "El torneo ya está inactivo" }, { status: 400 });

    const updated = await prisma.tournament.update({
      where: { id },
      data:  { archivedAt: new Date() },
    });

    await logAudit({
      action:    "TOURNAMENT_ARCHIVED",
      userId:    user.id,
      userEmail: user.email,
      dojoId,
      details:   JSON.stringify({ tournamentId: id, name: existing.name, status: existing.status }),
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("POST /api/tournaments/[id]/archive error:", err);
    return NextResponse.json({ error: "Error interno al inactivar torneo" }, { status: 500 });
  }
}

/** DELETE: reactiva el torneo (solo sysadmin) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as SessionUser;
  if (user.role !== "admin" && user.role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso para reactivar torneos" }, { status: 403 });

  const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await prisma.tournament.findFirst({ where: { id, dojoId } });
    if (!existing) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    if (!existing.archivedAt)
      return NextResponse.json({ error: "El torneo no está inactivo" }, { status: 400 });

    const updated = await prisma.tournament.update({
      where: { id },
      data:  { archivedAt: null },
    });

    await logAudit({
      action:    "TOURNAMENT_REACTIVATED",
      userId:    user.id,
      userEmail: user.email,
      dojoId,
      details:   JSON.stringify({ tournamentId: id, name: existing.name }),
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("DELETE /api/tournaments/[id]/archive error:", err);
    return NextResponse.json({ error: "Error interno al reactivar torneo" }, { status: 500 });
  }
}
