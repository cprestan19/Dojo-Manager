import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string }> };

// POST /api/evaluations/[id]/link — "llama" una Postulación existente del
// mismo dojo: sus postulados aceptados pasan a ser candidatos de la Evaluación.
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

    const { id: evaluationId } = await params;
    const evaluation = await prisma.evaluation.findFirst({ where: { id: evaluationId, dojoId } });
    if (!evaluation) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });

    const body = await req.json() as { applicationId?: string };
    if (!body.applicationId) return NextResponse.json({ error: "applicationId requerido" }, { status: 400 });

    // Nunca confiar en el ID sin validar que la postulación es de este dojo.
    const application = await prisma.examApplication.findFirst({
      where:  { id: body.applicationId, dojoId },
      select: { id: true, title: true },
    });
    if (!application) return NextResponse.json({ error: "Postulación no encontrada" }, { status: 404 });

    const existing = await prisma.evaluationLink.findUnique({
      where: { evaluationId_applicationId: { evaluationId, applicationId: application.id } },
    });
    if (existing) return NextResponse.json({ error: "Esa postulación ya está vinculada" }, { status: 400 });

    const link = await prisma.evaluationLink.create({
      data: { evaluationId, applicationId: application.id },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EVALUATION_LINK_CREATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "EvaluationLink",
      resourceId:   link.id,
      statusCode:   200,
      details:      JSON.stringify({ evaluationId, applicationId: application.id, applicationTitle: application.title }),
    });

    return NextResponse.json({ ...link, application });
  } catch (err) {
    console.error("POST /api/evaluations/[id]/link", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
