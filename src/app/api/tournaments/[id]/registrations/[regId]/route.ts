import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null; email?: string };

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; regId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as SessionUser;
  if (user.role !== "admin" && user.role !== "sysadmin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id: tournamentId, regId } = await params;

  const existing = await prisma.tournamentRegistration.findFirst({
    where: { id: regId, tournamentId, dojoId },
  });
  if (!existing) return NextResponse.json({ error: "Inscripción no encontrada" }, { status: 404 });

  const raw = await req.json().catch(() => null);
  if (!raw || !raw.status) {
    return NextResponse.json({ error: "status es requerido" }, { status: 400 });
  }

  const extraData: Record<string, unknown> = {};
  if (raw.status === "approved") {
    extraData.approvedAt = new Date();
    extraData.approvedBy = user.email ?? null;
  }

  try {
    const updated = await prisma.tournamentRegistration.update({
      where: { id: regId },
      data: {
        status: raw.status,
        notes: raw.notes ?? existing.notes,
        ...extraData,
      },
      include: {
        student: { select: { fullName: true, studentCode: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/tournaments/[id]/registrations/[regId] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; regId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id: tournamentId, regId } = await params;

  const existing = await prisma.tournamentRegistration.findFirst({
    where: { id: regId, tournamentId, dojoId },
  });
  if (!existing) return NextResponse.json({ error: "Inscripción no encontrada" }, { status: 404 });

  if (existing.status === "approved") {
    return NextResponse.json({ error: "No se puede eliminar una inscripción aprobada" }, { status: 400 });
  }

  try {
    await prisma.tournamentRegistration.delete({ where: { id: regId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tournaments/[id]/registrations/[regId] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
