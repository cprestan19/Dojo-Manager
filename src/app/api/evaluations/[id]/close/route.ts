import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string }> };

// POST /api/evaluations/[id]/close — desactiva todos los links de los Senseis.
// Corregir una nota después requiere reactivar al Sensei puntual a mano.
export async function POST(req: NextRequest, { params }: Params) {
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
    const evaluation = await prisma.evaluation.findFirst({ where: { id, dojoId } });
    if (!evaluation) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const { count } = await prisma.examEvaluator.updateMany({
      where: { evaluationId: id, active: true },
      data:  { active: false },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EVALUATION_CLOSED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "Evaluation",
      resourceId:   id,
      statusCode:   200,
      details:      JSON.stringify({ evaluatorsDeactivated: count }),
    });

    return NextResponse.json({ ok: true, evaluatorsDeactivated: count });
  } catch (err) {
    console.error("POST /api/evaluations/[id]/close", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
