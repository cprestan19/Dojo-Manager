import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { BELT_COLORS } from "@/lib/utils";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string }> };

const VALID_BELTS = new Set(BELT_COLORS.map(b => b.value));

// true si dos filtros de cinta se pisan — un filtro vacío ("todas las cintas")
// se pisa con cualquier otro, vacío o no.
function beltFilterOverlaps(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return true;
  return a.some(belt => b.includes(belt));
}

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

    const body = await req.json() as { applicationId?: string; beltFilter?: string[] };
    if (!body.applicationId) return NextResponse.json({ error: "applicationId requerido" }, { status: 400 });

    const beltFilter = [...new Set(body.beltFilter ?? [])];
    for (const belt of beltFilter) {
      if (!VALID_BELTS.has(belt)) return NextResponse.json({ error: `Cinta inválida: ${belt}` }, { status: 400 });
    }

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

    // Esta misma Postulación puede estar repartida entre varias Evaluaciones
    // por cinta (una por franja horaria) — pero dos vínculos no pueden pisarse
    // en la misma cinta, o un alumno terminaría siendo candidato de dos
    // Evaluaciones distintas a la vez.
    const otherLinks = await prisma.evaluationLink.findMany({
      where:  { applicationId: application.id, evaluationId: { not: evaluationId } },
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

    const link = await prisma.evaluationLink.create({
      data: { evaluationId, applicationId: application.id, beltFilter },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EVALUATION_LINK_CREATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "EvaluationLink",
      resourceId:   link.id,
      statusCode:   200,
      details:      JSON.stringify({ evaluationId, applicationId: application.id, applicationTitle: application.title, beltFilter }),
    });

    return NextResponse.json({ ...link, application });
  } catch (err) {
    console.error("POST /api/evaluations/[id]/link", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
