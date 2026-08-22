// ── Distribución 1-a-1 Sensei↔alumno dentro de una Evaluación ───────────────
// Reemplaza el modelo "panel" (todos califican a todos) por asignación
// exclusiva, evitando que un Sensei le toque su propio alumno
// (Student.homeInstructorName) salvo que la proporción numérica lo obligue.
// Ver comentario del modelo ExamAssignment en schema.prisma.

export interface AssignCandidate {
  key: string; // inviteeId o federatedCandidateId
  kind: "local" | "federated";
  homeInstructorName: string | null; // siempre null para federated (dato de otro dojo, fuera del allowlist)
}
export interface AssignEvaluator {
  id: string;
  name: string;
}
export interface AssignmentPlanRow {
  key: string;
  kind: "local" | "federated";
  evaluatorId: string;
  forced: boolean;
}

function normalizeName(s: string): string {
  const decomposed = s.trim().toLowerCase().normalize("NFD");
  let out = "";
  for (const ch of decomposed) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0300 && code <= 0x036f) continue; // marcas diacríticas combinadas (acentos)
    out += ch;
  }
  return out;
}

/**
 * Reparte `candidates` entre `evaluators` lo más parejo posible (±1), evitando
 * asignar un candidato a su propio instructor salvo que no quede otra opción
 * con cupo — en ese caso la fila queda marcada `forced: true`.
 *
 * `initialCapacity` permite distribuir solo los candidatos NUEVOS de una
 * Evaluación que ya tenía asignaciones previas, respetando el cupo que le
 * queda a cada evaluador (para no desbalancear lo ya asignado).
 */
export function planDistribution(
  candidates: AssignCandidate[],
  evaluators: AssignEvaluator[],
  initialCapacity?: Map<string, number>,
): AssignmentPlanRow[] {
  const K = evaluators.length;
  const N = candidates.length;
  if (K === 0 || N === 0) return [];

  const capacity = new Map<string, number>();
  if (initialCapacity) {
    for (const e of evaluators) capacity.set(e.id, Math.max(0, initialCapacity.get(e.id) ?? 0));
  } else {
    const base = Math.floor(N / K);
    const remainder = N % K;
    evaluators.forEach((e, i) => capacity.set(e.id, base + (i < remainder ? 1 : 0)));
  }

  const evaluatorByNormName = new Map<string, string>();
  for (const e of evaluators) evaluatorByNormName.set(normalizeName(e.name), e.id);

  const withConflict = candidates.map(c => ({
    ...c,
    conflictEvaluatorId: c.homeInstructorName
      ? evaluatorByNormName.get(normalizeName(c.homeInstructorName)) ?? null
      : null,
  }));

  // Los más restringidos (con conflicto) se procesan primero — clásico greedy
  // de asignación bipartita: si se dejan para el final, ya no queda cupo libre.
  const ordered = [
    ...withConflict.filter(c => c.conflictEvaluatorId),
    ...withConflict.filter(c => !c.conflictEvaluatorId),
  ];

  const plan: AssignmentPlanRow[] = [];
  for (const c of ordered) {
    const compatible = evaluators.filter(
      e => e.id !== c.conflictEvaluatorId && (capacity.get(e.id) ?? 0) > 0,
    );
    if (compatible.length > 0) {
      // El que tenga más cupo restante, para mantener el reparto parejo.
      compatible.sort((a, b) => (capacity.get(b.id) ?? 0) - (capacity.get(a.id) ?? 0));
      const chosen = compatible[0];
      capacity.set(chosen.id, (capacity.get(chosen.id) ?? 0) - 1);
      plan.push({ key: c.key, kind: c.kind, evaluatorId: chosen.id, forced: false });
      continue;
    }
    // Sin alternativa — cae en su propio instructor si tiene cupo, o en
    // cualquiera con cupo restante como último recurso.
    const ownHasRoom = c.conflictEvaluatorId && (capacity.get(c.conflictEvaluatorId) ?? 0) > 0;
    const fallbackId = ownHasRoom
      ? c.conflictEvaluatorId!
      : (evaluators.find(e => (capacity.get(e.id) ?? 0) > 0)?.id ?? evaluators[0].id);
    capacity.set(fallbackId, Math.max(0, (capacity.get(fallbackId) ?? 0) - 1));
    plan.push({ key: c.key, kind: c.kind, evaluatorId: fallbackId, forced: fallbackId === c.conflictEvaluatorId });
  }

  return plan;
}
