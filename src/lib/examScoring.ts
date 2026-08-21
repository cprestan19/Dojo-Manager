import prisma from "@/lib/prisma";

/**
 * Recalcula ExamApplicationInvitee.finalScore a partir de las notas cargadas
 * hasta el momento (ExamScore). Se promedia entre los Senseis que ya
 * calificaron cada criterio, y el resultado se pondera solo con los
 * criterios que ya tienen al menos una nota — así el número tiene sentido
 * también "en progreso", antes de que todos los Senseis terminen.
 *
 * Los criterios ya no viven en la Postulación del alumno — viven en la
 * Evaluación a la que esa Postulación fue vinculada (EvaluationLink).
 */
export async function recomputeInviteeFinalScore(inviteeId: string): Promise<number | null> {
  const invitee = await prisma.examApplicationInvitee.findUnique({
    where:  { id: inviteeId },
    select: { applicationId: true },
  });
  if (!invitee) return null;

  const link = await prisma.evaluationLink.findFirst({
    where:  { applicationId: invitee.applicationId },
    select: { evaluationId: true },
  });
  if (!link) return null; // la postulación de este alumno no está vinculada a ninguna evaluación

  const [criteria, scores] = await Promise.all([
    prisma.examCriteria.findMany({
      where:  { evaluationId: link.evaluationId },
      select: { id: true, weightPct: true },
    }),
    prisma.examScore.findMany({
      where:  { inviteeId },
      select: { criteriaId: true, value: true },
    }),
  ]);

  const byCriteria = new Map<string, number[]>();
  for (const s of scores) {
    const arr = byCriteria.get(s.criteriaId) ?? [];
    arr.push(s.value);
    byCriteria.set(s.criteriaId, arr);
  }

  let weightedSum = 0;
  let weightTotal = 0;
  for (const c of criteria) {
    const values = byCriteria.get(c.id);
    if (!values || values.length === 0) continue;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    weightedSum += avg * c.weightPct;
    weightTotal += c.weightPct;
  }

  const finalScore = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 100) / 100 : null;

  await prisma.examApplicationInvitee.update({
    where: { id: inviteeId },
    data:  { finalScore },
  });

  return finalScore;
}
