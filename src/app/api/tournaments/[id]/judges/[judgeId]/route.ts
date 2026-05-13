import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; judgeId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id: tournamentId, judgeId } = await params;

  const existing = await prisma.tournamentJudge.findFirst({
    where: { id: judgeId, tournamentId, dojoId },
  });
  if (!existing) return NextResponse.json({ error: "Juez no encontrado" }, { status: 404 });

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  try {
    const updated = await prisma.tournamentJudge.update({
      where: { id: judgeId },
      data: {
        ...(raw.name        !== undefined ? { name: raw.name.trim() }          : {}),
        ...(raw.role        !== undefined ? { role: raw.role }                 : {}),
        ...(raw.tatamiId    !== undefined ? { tatamiId: raw.tatamiId ?? null } : {}),
        ...(raw.licenseNo   !== undefined ? { licenseNo: raw.licenseNo ?? null}: {}),
        ...(raw.nationality !== undefined ? { nationality: raw.nationality ?? null } : {}),
        ...(raw.active      !== undefined ? { active: raw.active }             : {}),
      },
      include: {
        tatami: { select: { id: true, name: true, color: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/tournaments/[id]/judges/[judgeId] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; judgeId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id: tournamentId, judgeId } = await params;

  const existing = await prisma.tournamentJudge.findFirst({
    where: { id: judgeId, tournamentId, dojoId },
  });
  if (!existing) return NextResponse.json({ error: "Juez no encontrado" }, { status: 404 });

  try {
    await prisma.tournamentJudge.delete({ where: { id: judgeId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tournaments/[id]/judges/[judgeId] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
