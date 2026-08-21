/**
 * POST /api/evaluations/[id]/confirm-results — cierre irreversible de la
 * Evaluación: fija attended=true y passed=<decisión del admin> en cada
 * candidato real de esta Evaluación (resuelto por EvaluationLink + beltFilter,
 * igual que /candidates — nunca se confía en los inviteeId del body sin
 * validar que de verdad pertenecen a esta Evaluación).
 *
 * No otorga cinta ni emite diploma — eso sigue siendo el paso "Finalizar" de
 * la Postulación (que puede cubrir más cintas de las que tiene esta
 * Evaluación en particular). Esto solo deja el resultado de la evaluación
 * fijo y guardado para que el admin lo use cuando finalice cada Postulación.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string }> };

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
    if (!evaluation) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    if (evaluation.resultsConfirmedAt) {
      return NextResponse.json({ error: "Esta evaluación ya fue confirmada — no se puede volver a confirmar" }, { status: 400 });
    }

    const body = await req.json() as { decisions?: { inviteeId?: string; passed?: boolean }[] };
    const decisions = (body.decisions ?? []).filter(
      (d): d is { inviteeId: string; passed: boolean } => !!d.inviteeId && typeof d.passed === "boolean",
    );
    if (decisions.length === 0) {
      return NextResponse.json({ error: "Debes marcar Aprobó/No aprobó para al menos un alumno" }, { status: 400 });
    }

    // Resolver los candidatos reales de esta Evaluación — mismo criterio que
    // GET /candidates — para no confiar ciegamente en los inviteeId del body.
    const links = await prisma.evaluationLink.findMany({
      where:  { evaluationId },
      select: { applicationId: true, beltFilter: true },
    });
    const applicationIds = links.map(l => l.applicationId);
    const inviteeIds = decisions.map(d => d.inviteeId);

    const invitees = applicationIds.length > 0
      ? await prisma.examApplicationInvitee.findMany({
          where:  { id: { in: inviteeIds }, applicationId: { in: applicationIds }, response: "ACCEPTED" },
          select: { id: true, applicationId: true, beltToPresent: true },
        })
      : [];

    const validIds = new Set(
      invitees
        .filter(inv => links.some(l => l.applicationId === inv.applicationId
          && (l.beltFilter.length === 0 || l.beltFilter.includes(inv.beltToPresent))))
        .map(inv => inv.id),
    );

    const validDecisions = decisions.filter(d => validIds.has(d.inviteeId));
    if (validDecisions.length === 0) {
      return NextResponse.json({ error: "Ninguno de los alumnos pertenece a esta evaluación" }, { status: 400 });
    }

    await prisma.$transaction([
      ...validDecisions.map(d =>
        prisma.examApplicationInvitee.update({
          where: { id: d.inviteeId },
          data:  { attended: true, passed: d.passed },
        }),
      ),
      prisma.evaluation.update({ where: { id: evaluationId }, data: { resultsConfirmedAt: new Date() } }),
    ]);

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EVALUATION_RESULTS_CONFIRMED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "Evaluation",
      resourceId:   evaluationId,
      statusCode:   200,
      details:      JSON.stringify({ confirmed: validDecisions.length, requested: decisions.length }),
    });

    return NextResponse.json({ ok: true, confirmed: validDecisions.length });
  } catch (err) {
    console.error("POST /api/evaluations/[id]/confirm-results", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
