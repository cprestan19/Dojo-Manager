import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string }> };

// GET /api/evaluations/[id] — detalle con criterios, evaluadores y postulaciones vinculadas
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id } = await params;
    const evaluation = await prisma.evaluation.findFirst({
      where: { id, dojoId },
      include: {
        criteria:   { orderBy: { order: "asc" } },
        evaluators: {
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, token: true, active: true, confirmedAt: true, _count: { select: { scores: true } } },
        },
        links: {
          select: {
            id: true,
            application: {
              select: {
                id: true, title: true, status: true,
                _count: { select: { invitees: true } },
              },
            },
          },
        },
      },
    });
    if (!evaluation) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    return NextResponse.json(evaluation);
  } catch (err) {
    console.error("GET /api/evaluations/[id]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PUT /api/evaluations/[id] — renombrar
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.evaluation.findFirst({ where: { id, dojoId } });
    if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const body = await req.json() as { title?: string };
    const title = body.title?.trim().slice(0, 120);
    if (!title) return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });

    const updated = await prisma.evaluation.update({ where: { id }, data: { title } });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/evaluations/[id]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/evaluations/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.evaluation.findFirst({ where: { id, dojoId } });
    if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    await prisma.evaluation.delete({ where: { id } }); // cascada: links, criterios, evaluadores, notas

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EVALUATION_DELETED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "Evaluation",
      resourceId:   id,
      statusCode:   200,
      details:      JSON.stringify({ title: existing.title }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/evaluations/[id]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
