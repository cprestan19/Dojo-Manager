import prisma from "@/lib/prisma";

/**
 * Resuelve a cuál Evaluación pertenece un postulado dentro de una Postulación
 * dada, respetando el `beltFilter` de cada EvaluationLink — necesario porque
 * una misma Postulación (con alumnos de varias cintas) puede estar "llamada"
 * a varias Evaluaciones distintas, una por grupo de cinta/franja horaria.
 * Un vínculo con `beltFilter` vacío es "todas las cintas" (catch-all) y solo
 * se usa si no hay un vínculo más específico que incluya la cinta del alumno.
 * Si se pasa `evaluationId`, restringe la búsqueda a esa Evaluación puntual
 * (para validar que un postulado pertenece a ella, no para descubrirla).
 */
export async function findEvaluationLinkForInvitee(
  applicationId: string,
  beltToPresent: string,
  evaluationId?: string,
): Promise<{ evaluationId: string; beltFilter: string[] } | null> {
  const links = await prisma.evaluationLink.findMany({
    where:  { applicationId, ...(evaluationId ? { evaluationId } : {}) },
    select: { evaluationId: true, beltFilter: true },
  });
  return links.find(l => l.beltFilter.length > 0 && l.beltFilter.includes(beltToPresent))
      ?? links.find(l => l.beltFilter.length === 0)
      ?? null;
}

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
    select: { applicationId: true, beltToPresent: true },
  });
  if (!invitee) return null;

  const link = await findEvaluationLinkForInvitee(invitee.applicationId, invitee.beltToPresent);
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

/**
 * Igual que recomputeInviteeFinalScore pero para un FederatedCandidate
 * (postulado de un dojo hijo, vinculado vía FederatedEvaluationLink). No
 * necesita resolver el vínculo por cinta — el candidato ya es un snapshot
 * fijado a una sola Evaluación desde que se creó.
 */
export async function recomputeFederatedCandidateFinalScore(candidateId: string): Promise<number | null> {
  const candidate = await prisma.federatedCandidate.findUnique({
    where:  { id: candidateId },
    select: { link: { select: { evaluationId: true } } },
  });
  if (!candidate) return null;

  const [criteria, scores] = await Promise.all([
    prisma.examCriteria.findMany({
      where:  { evaluationId: candidate.link.evaluationId },
      select: { id: true, weightPct: true },
    }),
    prisma.federatedExamScore.findMany({
      where:  { candidateId },
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

  await prisma.federatedCandidate.update({
    where: { id: candidateId },
    data:  { finalScore },
  });

  return finalScore;
}
