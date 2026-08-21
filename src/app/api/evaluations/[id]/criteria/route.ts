import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string }> };

async function requireEvaluation(dojoId: string, id: string) {
  return prisma.evaluation.findFirst({ where: { id, dojoId } });
}

// GET /api/evaluations/[id]/criteria
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
    const evaluation = await requireEvaluation(dojoId, id);
    if (!evaluation) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const criteria = await prisma.examCriteria.findMany({
      where:   { evaluationId: id },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(criteria);
  } catch (err) {
    console.error("GET /api/evaluations/[id]/criteria", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/evaluations/[id]/criteria — crea un criterio
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
    const evaluation = await requireEvaluation(dojoId, id);
    if (!evaluation) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const body = await req.json() as { name?: string; weightPct?: number };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "El nombre del criterio es requerido" }, { status: 400 });
    if (typeof body.weightPct !== "number" || body.weightPct <= 0 || body.weightPct > 100) {
      return NextResponse.json({ error: "El peso debe ser un número entre 1 y 100" }, { status: 400 });
    }

    const count = await prisma.examCriteria.count({ where: { evaluationId: id } });

    const criteria = await prisma.examCriteria.create({
      data: { evaluationId: id, name, weightPct: body.weightPct, order: count },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_CRITERIA_CREATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamCriteria",
      resourceId:   criteria.id,
      statusCode:   200,
      details:      JSON.stringify({ evaluationId: id, name, weightPct: body.weightPct }),
    });

    return NextResponse.json(criteria);
  } catch (err) {
    console.error("POST /api/evaluations/[id]/criteria", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
