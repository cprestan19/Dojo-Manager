import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "sysadmin" && role !== "admin")
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const existing = await prisma.freeTrialRequest.findFirst({ where: { id, dojoId } });
    if (!existing) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.status     !== undefined) data.status     = body.status;
    if (body.scheduleId !== undefined) data.scheduleId = body.scheduleId || null;
    if (body.notes      !== undefined) data.notes      = body.notes || null;
    if (body.read       !== undefined) data.read       = body.read;

    const updated = await prisma.freeTrialRequest.update({
      where:   { id },
      data,
      include: { schedule: { select: { id: true, name: true, startTime: true, endTime: true } } },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[free-trials] PUT error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "sysadmin" && role !== "admin")
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const existing = await prisma.freeTrialRequest.findFirst({ where: { id, dojoId } });
    if (!existing) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });

    await prisma.freeTrialRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[free-trials] DELETE error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
