import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recomputeInviteeFinalScore } from "@/lib/examScoring";

type Params = { params: Promise<{ token: string }> };

// PUT /api/public/exam/[token]/score — el Sensei guarda (o corrige) una nota
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;

    const evaluator = await prisma.examEvaluator.findUnique({
      where:  { token },
      select: { id: true, active: true, evaluationId: true },
    });
    if (!evaluator) return NextResponse.json({ error: "Link no válido" }, { status: 404 });
    if (!evaluator.active) return NextResponse.json({ error: "Este link ya no está activo — la evaluación fue cerrada" }, { status: 403 });

    const body = await req.json() as { inviteeId?: string; criteriaId?: string; value?: number; note?: string | null };
    if (!body.inviteeId || !body.criteriaId) {
      return NextResponse.json({ error: "inviteeId y criteriaId son requeridos" }, { status: 400 });
    }
    if (typeof body.value !== "number" || body.value < 0 || body.value > 10) {
      return NextResponse.json({ error: "La nota debe estar entre 0 y 10" }, { status: 400 });
    }

    // El alumno y el criterio deben pertenecer a la misma Evaluación que este
    // Sensei — nunca confiar en los IDs del body sin validar que estén dentro
    // del alcance del token. El alumno llega a través de una de las
    // Postulaciones vinculadas (EvaluationLink), no directamente.
    const [invitee, criteria] = await Promise.all([
      prisma.examApplicationInvitee.findFirst({
        where: {
          id:       body.inviteeId,
          response: "ACCEPTED",
          application: { evaluationLinks: { some: { evaluationId: evaluator.evaluationId } } },
        },
        select: { id: true },
      }),
      prisma.examCriteria.findFirst({
        where:  { id: body.criteriaId, evaluationId: evaluator.evaluationId },
        select: { id: true },
      }),
    ]);
    if (!invitee)  return NextResponse.json({ error: "Alumno no encontrado en esta evaluación" }, { status: 404 });
    if (!criteria) return NextResponse.json({ error: "Criterio no encontrado en esta evaluación" }, { status: 404 });

    const note = body.note?.trim().slice(0, 500) || null;

    await prisma.examScore.upsert({
      where: {
        inviteeId_criteriaId_evaluatorId: {
          inviteeId:   body.inviteeId,
          criteriaId:  body.criteriaId,
          evaluatorId: evaluator.id,
        },
      },
      update: { value: body.value, note },
      create: {
        inviteeId:   body.inviteeId,
        criteriaId:  body.criteriaId,
        evaluatorId: evaluator.id,
        value:       body.value,
        note,
      },
    });

    await recomputeInviteeFinalScore(body.inviteeId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/public/exam/[token]/score", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
