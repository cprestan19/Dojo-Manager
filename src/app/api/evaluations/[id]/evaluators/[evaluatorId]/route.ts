import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string; evaluatorId: string }> };

// PATCH /api/evaluations/[id]/evaluators/[evaluatorId] — activar/desactivar el link
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id, evaluatorId } = await params;
    const evaluation = await prisma.evaluation.findFirst({ where: { id, dojoId } });
    if (!evaluation) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const evaluator = await prisma.examEvaluator.findFirst({ where: { id: evaluatorId, evaluationId: id } });
    if (!evaluator) return NextResponse.json({ error: "Sensei no encontrado" }, { status: 404 });

    const body = await req.json() as { active?: boolean };
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "active debe ser boolean" }, { status: 400 });
    }

    const updated = await prisma.examEvaluator.update({
      where: { id: evaluatorId },
      data:  { active: body.active },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       body.active ? "EXAM_EVALUATOR_ACTIVATED" : "EXAM_EVALUATOR_DEACTIVATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamEvaluator",
      resourceId:   evaluatorId,
      statusCode:   200,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/evaluations/[id]/evaluators/[evaluatorId]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/evaluations/[id]/evaluators/[evaluatorId] — solo si aún no calificó a nadie
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

    const { id, evaluatorId } = await params;
    const evaluation = await prisma.evaluation.findFirst({ where: { id, dojoId } });
    if (!evaluation) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const evaluator = await prisma.examEvaluator.findFirst({
      where:  { id: evaluatorId, evaluationId: id },
      select: { id: true, _count: { select: { scores: true } } },
    });
    if (!evaluator) return NextResponse.json({ error: "Sensei no encontrado" }, { status: 404 });
    if (evaluator._count.scores > 0) {
      return NextResponse.json({ error: "Este Sensei ya cargó notas — desactívalo en vez de eliminarlo" }, { status: 400 });
    }

    await prisma.examEvaluator.delete({ where: { id: evaluatorId } });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_EVALUATOR_DELETED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamEvaluator",
      resourceId:   evaluatorId,
      statusCode:   200,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/evaluations/[id]/evaluators/[evaluatorId]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
