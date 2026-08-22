import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { planDistribution, type AssignCandidate } from "@/lib/examAssignment";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string }> };

// POST /api/evaluations/[id]/distribute — reparte 1-a-1 los candidatos SIN
// asignación todavía entre los Senseis activos, evitando que a un Sensei le
// toque su propio alumno (Student.homeInstructorName) salvo que la
// proporción numérica no deje otra opción (forcedSelfAssignment=true).
// Incremental: los candidatos que ya tenían asignación no se tocan — así se
// puede volver a llamar después de vincular otra postulación/dojo sin
// desordenar lo ya repartido.
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

    const evaluators = await prisma.examEvaluator.findMany({
      where:  { evaluationId, active: true },
      select: { id: true, name: true },
    });
    if (evaluators.length === 0) {
      return NextResponse.json({ error: "Agrega al menos un Sensei activo antes de distribuir" }, { status: 400 });
    }

    // ── Candidatos reales de esta Evaluación (mismo criterio que /candidates) ──
    const links = await prisma.evaluationLink.findMany({ where: { evaluationId }, select: { applicationId: true, beltFilter: true } });
    const applicationIds = links.map(l => l.applicationId);
    const allInvitees = applicationIds.length > 0
      ? await prisma.examApplicationInvitee.findMany({
          where:  { applicationId: { in: applicationIds }, response: "ACCEPTED" },
          select: { id: true, applicationId: true, beltToPresent: true, student: { select: { homeInstructorName: true } } },
        })
      : [];
    const localInvitees = allInvitees.filter(inv =>
      links.some(l => l.applicationId === inv.applicationId
        && (l.beltFilter.length === 0 || l.beltFilter.includes(inv.beltToPresent))),
    );
    const federatedCandidates = await prisma.federatedCandidate.findMany({
      where:  { link: { evaluationId } },
      select: { id: true },
    });

    // ── Asignaciones ya existentes — no se tocan, solo cuentan para el cupo ──
    const [existingLocal, existingFederated] = await Promise.all([
      prisma.examAssignment.findMany({ where: { evaluationId }, select: { inviteeId: true, evaluatorId: true } }),
      prisma.federatedExamAssignment.findMany({ where: { evaluationId }, select: { candidateId: true, evaluatorId: true } }),
    ]);
    const assignedInviteeIds   = new Set(existingLocal.map(a => a.inviteeId));
    const assignedCandidateIds = new Set(existingFederated.map(a => a.candidateId));

    const pending: AssignCandidate[] = [
      ...localInvitees
        .filter(inv => !assignedInviteeIds.has(inv.id))
        .map(inv => ({ key: inv.id, kind: "local" as const, homeInstructorName: inv.student.homeInstructorName })),
      ...federatedCandidates
        .filter(c => !assignedCandidateIds.has(c.id))
        .map(c => ({ key: c.id, kind: "federated" as const, homeInstructorName: null })),
    ];

    if (pending.length === 0) {
      return NextResponse.json({ ok: true, assigned: 0, forced: 0, message: "No hay candidatos nuevos por repartir" });
    }

    // Cupo total calculado sobre TODOS los candidatos (ya asignados + nuevos)
    // para mantener el reparto parejo aunque se llame varias veces seguidas.
    const totalCount = localInvitees.length + federatedCandidates.length;
    const base = Math.floor(totalCount / evaluators.length);
    const remainder = totalCount % evaluators.length;
    const capacity = new Map<string, number>();
    evaluators.forEach((e, i) => {
      const alreadyAssigned =
        existingLocal.filter(a => a.evaluatorId === e.id).length +
        existingFederated.filter(a => a.evaluatorId === e.id).length;
      capacity.set(e.id, Math.max(0, base + (i < remainder ? 1 : 0) - alreadyAssigned));
    });

    const plan = planDistribution(pending, evaluators, capacity);

    await prisma.$transaction([
      ...plan.filter(p => p.kind === "local").map(p =>
        prisma.examAssignment.create({
          data: { evaluationId, inviteeId: p.key, evaluatorId: p.evaluatorId, forcedSelfAssignment: p.forced },
        }),
      ),
      ...plan.filter(p => p.kind === "federated").map(p =>
        prisma.federatedExamAssignment.create({
          data: { evaluationId, candidateId: p.key, evaluatorId: p.evaluatorId, forcedSelfAssignment: p.forced },
        }),
      ),
    ]);

    const forcedCount = plan.filter(p => p.forced).length;

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_CANDIDATES_DISTRIBUTED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "Evaluation",
      resourceId:   evaluationId,
      statusCode:   200,
      details:      JSON.stringify({ assigned: plan.length, forced: forcedCount }),
    });

    return NextResponse.json({ ok: true, assigned: plan.length, forced: forcedCount });
  } catch (err) {
    console.error("POST /api/evaluations/[id]/distribute", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
