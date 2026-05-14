import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES = ["pending","contacted","scheduled","enrolled","cancelled"] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;
  const lead = await prisma.freeTrialRequest.findFirst({ where: { id, dojoId } });
  if (!lead) return NextResponse.json({ error: "Prospecto no encontrado" }, { status: 404 });

  const body = await req.json();
  const updateData: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status))
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    updateData.status = body.status;
  }
  if (body.notes     !== undefined) updateData.notes      = body.notes     || null;
  if (body.scheduleId !== undefined) updateData.scheduleId = body.scheduleId || null;

  const updated = await prisma.freeTrialRequest.update({
    where: { id },
    data:  updateData,
    include: { schedule: { select: { id: true, name: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;
  const lead = await prisma.freeTrialRequest.findFirst({ where: { id, dojoId } });
  if (!lead) return NextResponse.json({ error: "Prospecto no encontrado" }, { status: 404 });

  await prisma.freeTrialRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
