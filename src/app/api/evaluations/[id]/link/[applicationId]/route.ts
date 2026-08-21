import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string; applicationId: string }> };

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
