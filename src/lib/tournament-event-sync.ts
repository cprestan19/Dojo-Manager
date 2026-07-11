/**
 * Lógica compartida para sincronizar TournamentEventParticipant con los RSVP
 * "attending" de un Event del dojo. Usada por POST /api/events/[id]/attendance-list
 * (para aplicar la sincronización) y por GET /api/events (para calcular cuántos
 * cambios están pendientes, sin aplicarlos).
 */

export interface ParticipantSyncFields {
  studentId:           string;
  arrived:              boolean;
  kataResult:           string | null;
  kumiteResult:         string | null;
  kataCompetitionId:    string | null;
  kumiteCompetitionId:  string | null;
  confirmed:            boolean;
  optedOut:             boolean;
}

/** true si el participante ya tiene algo cargado — nunca se elimina automáticamente. */
export function hasParticipantData(p: ParticipantSyncFields): boolean {
  return (
    p.arrived ||
    !!p.kataResult ||
    !!p.kumiteResult ||
    !!p.kataCompetitionId ||
    !!p.kumiteCompetitionId ||
    p.confirmed ||
    p.optedOut
  );
}

export interface SyncDiff {
  toAdd:    string[]; // studentIds a agregar
  toRemove: string[]; // participantIds a eliminar (sin datos cargados y ya no confirmados)
}

/** Calcula qué agregar/quitar sin tocar a nadie que no cambió. */
export function computeSyncDiff(
  confirmedStudentIds: Set<string>,
  currentParticipants: (ParticipantSyncFields & { id: string })[],
): SyncDiff {
  const currentIds = new Set(currentParticipants.map(p => p.studentId));

  const toAdd = [...confirmedStudentIds].filter(id => !currentIds.has(id));
  const toRemove = currentParticipants
    .filter(p => !confirmedStudentIds.has(p.studentId) && !hasParticipantData(p))
    .map(p => p.id);

  return { toAdd, toRemove };
}
