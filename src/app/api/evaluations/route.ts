import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };

// GET /api/evaluations — lista las evaluaciones del dojo
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const evaluations = await prisma.evaluation.findMany({
      where:   { dojoId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, createdAt: true,
        _count: { select: { links: true, criteria: true, evaluators: true } },
      },
    });

    return NextResponse.json(evaluations);
  } catch (err) {
    console.error("GET /api/evaluations", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/evaluations — crea una evaluación
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const body = await req.json() as { title?: string };
    const title = body.title?.trim().slice(0, 120);
    if (!title) return NextResponse.json({ error: "El nombre de la evaluación es requerido" }, { status: 400 });

    const evaluation = await prisma.evaluation.create({ data: { dojoId, title } });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EVALUATION_CREATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "Evaluation",
      resourceId:   evaluation.id,
      statusCode:   200,
      details:      JSON.stringify({ title }),
    });

    return NextResponse.json(evaluation);
  } catch (err) {
    console.error("POST /api/evaluations", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
