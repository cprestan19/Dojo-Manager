import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

async function resolveEntry(id: string, dojoId: string) {
  const entry = await prisma.beltHistory.findUnique({
    where:  { id },
    select: {
      id: true,
      beltColor: true,
      changeDate: true,
      isRanking: true,
      studentId: true,
      student: { select: { dojoId: true } },
    },
  });
  if (!entry || entry.student.dojoId !== dojoId) return null;
  return entry;
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const before = await resolveEntry(id, dojoId);
  if (!before) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  try {
    const t0   = Date.now();
    const body = await req.json();
    const kataIds: string[] = Array.isArray(body.kataIds)
      ? body.kataIds.filter(Boolean).slice(0, 5)
      : body.kataId ? [body.kataId] : [];

    const entry = await prisma.beltHistory.update({
      where: { id },
      data: {
        beltColor:  body.beltColor,
        changeDate: new Date(body.changeDate),
        kataId:     kataIds[0] ?? null,
        kataIds:    kataIds.length > 0 ? kataIds : Prisma.DbNull,
        isRanking:  body.isRanking ?? false,
        notes:      body.notes     || null,
      },
      select: {
        id: true, beltColor: true, changeDate: true, isRanking: true, notes: true,
        kataIds: true,
        kata: { select: { id: true, name: true, beltColor: true } },
      },
    });

    const ctx = buildAuditCtx(session, req, { startTime: t0, dojoId });
    await logAudit({
      ...ctx,
      action:       "BELT_UPDATED",
      module:       AUDIT_MODULE.BELTS,
      resourceType: "BeltHistory",
      resourceId:   id,
      targetId:     before.studentId,
      statusCode:   200,
      details:      JSON.stringify({
        before: { beltColor: before.beltColor, isRanking: before.isRanking },
        after:  { beltColor: entry.beltColor,  isRanking: entry.isRanking  },
      }),
    });

    return NextResponse.json(entry);
  } catch (err) {
    console.error("belt-history [id] error:", err);
    return NextResponse.json({ error: "Error al actualizar el historial" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const t0     = Date.now();
  const before = await resolveEntry(id, dojoId);
  if (!before) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.beltHistory.delete({ where: { id } });

  const ctx = buildAuditCtx(session, req, { startTime: t0, dojoId });
  await logAudit({
    ...ctx,
    action:       "BELT_DELETED",
    module:       AUDIT_MODULE.BELTS,
    resourceType: "BeltHistory",
    resourceId:   id,
    targetId:     before.studentId,
    statusCode:   200,
    details:      JSON.stringify({ beltColor: before.beltColor, isRanking: before.isRanking }),
  });

  return NextResponse.json({ ok: true });
}
