import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// GET /api/exam-applications/[id]/evaluators — incluye progreso de cada Sensei
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id } = await params;
    const application = await prisma.examApplication.findFirst({ where: { id, dojoId } });
    if (!application) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const evaluators = await prisma.examEvaluator.findMany({
      where:   { applicationId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, name: true, token: true, active: true, confirmedAt: true, createdAt: true,
        _count: { select: { scores: true } },
      },
    });

    return NextResponse.json(evaluators);
  } catch (err) {
    console.error("GET /api/exam-applications/[id]/evaluators", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/exam-applications/[id]/evaluators — agrega un Sensei y genera su link
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id } = await params;
    const application = await prisma.examApplication.findFirst({ where: { id, dojoId } });
    if (!application) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    if (application.status === "FINALIZED") {
      return NextResponse.json({ error: "El examen ya está finalizado" }, { status: 400 });
    }

    const body = await req.json() as { name?: string };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "El nombre del Sensei es requerido" }, { status: 400 });

    const evaluator = await prisma.examEvaluator.create({
      data: { applicationId: id, name, token: randomUUID() },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_EVALUATOR_CREATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamEvaluator",
      resourceId:   evaluator.id,
      statusCode:   200,
      details:      JSON.stringify({ applicationId: id, name }),
    });

    return NextResponse.json(evaluator);
  } catch (err) {
    console.error("POST /api/exam-applications/[id]/evaluators", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
