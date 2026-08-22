import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recomputeInviteeFinalScore, recomputeFederatedCandidateFinalScore, findEvaluationLinkForInvitee } from "@/lib/examScoring";

type Params = { params: Promise<{ token: string }> };

// PUT /api/public/exam/[token]/score — el Sensei guarda (o corrige) una nota.
// Acepta inviteeId (candidato local) O federatedCandidateId (candidato de un
// dojo hijo vinculado) — nunca ambos a la vez.
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;

    const evaluator = await prisma.examEvaluator.findUnique({
      where:  { token },
      select: { id: true, active: true, evaluationId: true, evaluation: { select: { resultsConfirmedAt: true } } },
    });
    if (!evaluator) return NextResponse.json({ error: "Link no válido" }, { status: 404 });
    if (!evaluator.active) return NextResponse.json({ error: "Este link ya no está activo — la evaluación fue cerrada" }, { status: 403 });
    if (evaluator.evaluation.resultsConfirmedAt) {
      return NextResponse.json({ error: "Esta evaluación ya fue confirmada — no se pueden modificar las notas" }, { status: 403 });
    }

    const body = await req.json() as {
      inviteeId?: string; federatedCandidateId?: string;
      criteriaId?: string; value?: number; note?: string | null;
    };
    if ((!body.inviteeId && !body.federatedCandidateId) || !body.criteriaId) {
      return NextResponse.json({ error: "inviteeId (o federatedCandidateId) y criteriaId son requeridos" }, { status: 400 });
    }
    if (typeof body.value !== "number" || body.value < 0 || body.value > 10) {
      return NextResponse.json({ error: "La nota debe estar entre 0 y 10" }, { status: 400 });
    }

    const criteria = await prisma.examCriteria.findFirst({
      where:  { id: body.criteriaId, evaluationId: evaluator.evaluationId },
      select: { id: true },
    });
    if (!criteria) return NextResponse.json({ error: "Criterio no encontrado en esta evaluación" }, { status: 404 });

    const note = body.note?.trim().slice(0, 500) || null;

    if (body.federatedCandidateId) {
      // El candidato debe pertenecer a un FederatedEvaluationLink de ESTA
      // evaluación — nunca confiar en el id del body sin validar el alcance.
      const candidate = await prisma.federatedCandidate.findFirst({
        where:  { id: body.federatedCandidateId, link: { evaluationId: evaluator.evaluationId } },
        select: { id: true },
      });
      if (!candidate) return NextResponse.json({ error: "Alumno no encontrado en esta evaluación" }, { status: 404 });

      // Si esta Evaluación ya tiene distribución 1-a-1 activa para este
      // candidato, solo el Sensei asignado puede calificarlo. Sin fila de
      // asignación (modo panel histórico) se mantiene el comportamiento previo.
      const fedAssignment = await prisma.federatedExamAssignment.findUnique({
        where: { evaluationId_candidateId: { evaluationId: evaluator.evaluationId, candidateId: body.federatedCandidateId } },
      });
      if (fedAssignment && fedAssignment.evaluatorId !== evaluator.id) {
        return NextResponse.json({ error: "Este alumno no está asignado a ti" }, { status: 403 });
      }

      await prisma.federatedExamScore.upsert({
        where: {
          candidateId_criteriaId_evaluatorId: {
            candidateId: body.federatedCandidateId,
            criteriaId:  body.criteriaId,
            evaluatorId: evaluator.id,
          },
        },
        update: { value: body.value, note },
        create: {
          candidateId: body.federatedCandidateId,
          criteriaId:  body.criteriaId,
          evaluatorId: evaluator.id,
          value:       body.value,
          note,
        },
      });

      await recomputeFederatedCandidateFinalScore(body.federatedCandidateId);
      return NextResponse.json({ ok: true });
    }

    // El alumno y el criterio deben pertenecer a la misma Evaluación que este
    // Sensei — nunca confiar en los IDs del body sin validar que estén dentro
    // del alcance del token. El alumno llega a través de una de las
    // Postulaciones vinculadas (EvaluationLink), no directamente — y esa
    // Postulación puede estar repartida por cinta entre varias Evaluaciones
    // (beltFilter), así que hay que confirmar que la cinta del alumno cae
    // dentro del filtro del vínculo, no solo que la postulación esté vinculada.
    const invitee = await prisma.examApplicationInvitee.findFirst({
      where:  { id: body.inviteeId, response: "ACCEPTED" },
      select: { id: true, applicationId: true, beltToPresent: true },
    });
    if (!invitee) return NextResponse.json({ error: "Alumno no encontrado en esta evaluación" }, { status: 404 });
    const link = await findEvaluationLinkForInvitee(invitee.applicationId, invitee.beltToPresent, evaluator.evaluationId);
    if (!link) return NextResponse.json({ error: "Alumno no encontrado en esta evaluación" }, { status: 404 });

    const assignment = await prisma.examAssignment.findUnique({
      where: { evaluationId_inviteeId: { evaluationId: evaluator.evaluationId, inviteeId: body.inviteeId! } },
    });
    if (assignment && assignment.evaluatorId !== evaluator.id) {
      return NextResponse.json({ error: "Este alumno no está asignado a ti" }, { status: 403 });
    }

    await prisma.examScore.upsert({
      where: {
        inviteeId_criteriaId_evaluatorId: {
          inviteeId:   body.inviteeId!,
          criteriaId:  body.criteriaId,
          evaluatorId: evaluator.id,
        },
      },
      update: { value: body.value, note },
      create: {
        inviteeId:   body.inviteeId!,
        criteriaId:  body.criteriaId,
        evaluatorId: evaluator.id,
        value:       body.value,
        note,
      },
    });

    await recomputeInviteeFinalScore(body.inviteeId!);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/public/exam/[token]/score", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
