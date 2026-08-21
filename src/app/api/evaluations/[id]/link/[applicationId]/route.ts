import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { BELT_COLORS } from "@/lib/utils";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string; applicationId: string }> };

const VALID_BELTS = new Set(BELT_COLORS.map(b => b.value));

function beltFilterOverlaps(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return true;
  return a.some(belt => b.includes(belt));
}

// PUT /api/evaluations/[id]/link/[applicationId] — cambia las cintas del vínculo
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

    const { id: evaluationId, applicationId } = await params;
    const evaluation = await prisma.evaluation.findFirst({ where: { id: evaluationId, dojoId } });
    if (!evaluation) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });

    const link = await prisma.evaluationLink.findUnique({
      where: { evaluationId_applicationId: { evaluationId, applicationId } },
    });
    if (!link) return NextResponse.json({ error: "No estaba vinculada" }, { status: 404 });

    const body = await req.json() as { beltFilter?: string[] };
    const beltFilter = [...new Set(body.beltFilter ?? [])];
    for (const belt of beltFilter) {
      if (!VALID_BELTS.has(belt)) return NextResponse.json({ error: `Cinta inválida: ${belt}` }, { status: 400 });
    }

    const otherLinks = await prisma.evaluationLink.findMany({
      where:  { applicationId, evaluationId: { not: evaluationId } },
      select: { beltFilter: true, evaluation: { select: { title: true } } },
    });
    const conflict = otherLinks.find(l => beltFilterOverlaps(l.beltFilter, beltFilter));
    if (conflict) {
      return NextResponse.json({
        error: beltFilter.length === 0
          ? `Esta postulación ya tiene cintas vinculadas a "${conflict.evaluation.title}" — elige cintas específicas en vez de "todas"`
          : `Alguna de estas cintas ya está vinculada a "${conflict.evaluation.title}"`,
      }, { status: 400 });
    }

    const updated = await prisma.evaluationLink.update({ where: { id: link.id }, data: { beltFilter } });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EVALUATION_LINK_UPDATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "EvaluationLink",
      resourceId:   link.id,
      statusCode:   200,
      details:      JSON.stringify({ evaluationId, applicationId, beltFilter }),
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/evaluations/[id]/link/[applicationId]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/evaluations/[id]/link/[applicationId] — desvincula una postulación
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

    const { id: evaluationId, applicationId } = await params;
    const evaluation = await prisma.evaluation.findFirst({ where: { id: evaluationId, dojoId } });
    if (!evaluation) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });

    const link = await prisma.evaluationLink.findUnique({
      where: { evaluationId_applicationId: { evaluationId, applicationId } },
    });
    if (!link) return NextResponse.json({ error: "No estaba vinculada" }, { status: 404 });

    await prisma.evaluationLink.delete({ where: { id: link.id } });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EVALUATION_LINK_REMOVED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "EvaluationLink",
      resourceId:   link.id,
      statusCode:   200,
      details:      JSON.stringify({ evaluationId, applicationId }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/evaluations/[id]/link/[applicationId]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
