import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logAudit, getIp, AUDIT_MODULE } from "@/lib/audit";

type Params = { params: Promise<{ token: string }> };

// PUT /api/public/exam/[token]/reassign — "Mudar alumno": el Sensei mueve a
// UNO de sus propios candidatos asignados hacia otro Sensei activo de la
// misma Evaluación. Reglas confirmadas por el dueño del producto:
//   - Solo puede mudar candidatos que ya son suyos (no los de otro Sensei).
//   - Bloqueado si ya cargó al menos una nota para ese candidato.
//   - Sin restricción de "instructor propio" — puede mudarlo a cualquiera,
//     incluso a su propio instructor (a diferencia del reparto automático).
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;

    const evaluator = await prisma.examEvaluator.findUnique({
      where:  { token },
      select: { id: true, name: true, active: true, evaluationId: true, evaluation: { select: { dojoId: true, resultsConfirmedAt: true } } },
    });
    if (!evaluator) return NextResponse.json({ error: "Link no válido" }, { status: 404 });
    if (!evaluator.active) return NextResponse.json({ error: "Este link ya no está activo" }, { status: 403 });
    if (evaluator.evaluation.resultsConfirmedAt) {
      return NextResponse.json({ error: "Esta evaluación ya fue confirmada" }, { status: 403 });
    }

    const body = await req.json() as { inviteeId?: string; federatedCandidateId?: string; toEvaluatorId?: string };
    if ((!body.inviteeId && !body.federatedCandidateId) || !body.toEvaluatorId) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }
    if (body.toEvaluatorId === evaluator.id) {
      return NextResponse.json({ error: "Ya es tuyo" }, { status: 400 });
    }

    const toEvaluator = await prisma.examEvaluator.findFirst({
      where:  { id: body.toEvaluatorId, evaluationId: evaluator.evaluationId, active: true },
      select: { id: true, name: true },
    });
    if (!toEvaluator) return NextResponse.json({ error: "Sensei destino no válido" }, { status: 404 });

    if (body.federatedCandidateId) {
      const assignment = await prisma.federatedExamAssignment.findFirst({
        where:  { evaluationId: evaluator.evaluationId, candidateId: body.federatedCandidateId, evaluatorId: evaluator.id },
      });
      if (!assignment) return NextResponse.json({ error: "Este alumno no está asignado a ti" }, { status: 404 });

      const hasScore = await prisma.federatedExamScore.findFirst({
        where: { candidateId: body.federatedCandidateId, evaluatorId: evaluator.id },
        select: { id: true },
      });
      if (hasScore) return NextResponse.json({ error: "Ya evaluaste a este alumno — no se puede mudar" }, { status: 400 });

      await prisma.federatedExamAssignment.update({
        where: { id: assignment.id },
        data:  { evaluatorId: toEvaluator.id, forcedSelfAssignment: false },
      });

      await logAudit({
        action: "EXAM_CANDIDATE_REASSIGNED", module: AUDIT_MODULE.SETTINGS,
        resourceType: "FederatedExamAssignment", resourceId: assignment.id,
        dojoId: evaluator.evaluation.dojoId, method: req.method, ip: getIp(req),
        userAgent: req.headers.get("user-agent"), statusCode: 200,
        details: JSON.stringify({ evaluationId: evaluator.evaluationId, from: evaluator.name, to: toEvaluator.name, kind: "federated" }),
      });
      return NextResponse.json({ ok: true });
    }

    const assignment = await prisma.examAssignment.findFirst({
      where: { evaluationId: evaluator.evaluationId, inviteeId: body.inviteeId, evaluatorId: evaluator.id },
    });
    if (!assignment) return NextResponse.json({ error: "Este alumno no está asignado a ti" }, { status: 404 });

    const hasScore = await prisma.examScore.findFirst({
      where: { inviteeId: body.inviteeId, evaluatorId: evaluator.id },
      select: { id: true },
    });
    if (hasScore) return NextResponse.json({ error: "Ya evaluaste a este alumno — no se puede mudar" }, { status: 400 });

    await prisma.examAssignment.update({
      where: { id: assignment.id },
      data:  { evaluatorId: toEvaluator.id, forcedSelfAssignment: false },
    });

    await logAudit({
      action: "EXAM_CANDIDATE_REASSIGNED", module: AUDIT_MODULE.SETTINGS,
      resourceType: "ExamAssignment", resourceId: assignment.id,
      dojoId: evaluator.evaluation.dojoId, method: req.method, ip: getIp(req),
      userAgent: req.headers.get("user-agent"), statusCode: 200,
      details: JSON.stringify({ evaluationId: evaluator.evaluationId, from: evaluator.name, to: toEvaluator.name, kind: "local" }),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/public/exam/[token]/reassign", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
