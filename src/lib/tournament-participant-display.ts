/**
 * Resuelve nombre, foto y datos de club para un TournamentParticipant,
 * que puede provenir de un alumno interno (Student) o de un atleta de
 * un club visitante inscrito por link público (ExternalAthlete).
 *
 * Exactamente una de las dos relaciones debe estar presente — nunca ambas.
 * Usar SIEMPRE estas funciones en vez de leer `.student.fullName` directo,
 * para que overlay/TV/acreditación funcionen igual con ambos orígenes.
 */

export interface DisplayStudent {
  fullName:    string;
  photo?:      string | null;
  nationality?: string | null;
  dojo?:       { name: string } | null;
  beltHistory?: { beltColor: string }[];
}

export interface DisplayExternalAthlete {
  firstName:  string;
  lastName:   string;
  photoUrl?:  string | null;
  nationality?: string | null;
  beltColor?: string | null;
  externalClub?: { clubName: string } | null;
}

export interface DisplayParticipant {
  student?:         DisplayStudent | null;
  externalAthlete?: DisplayExternalAthlete | null;
}

export function participantName(p: DisplayParticipant): string {
  if (p.student) return p.student.fullName;
  if (p.externalAthlete) return `${p.externalAthlete.firstName} ${p.externalAthlete.lastName}`;
  return "—";
}

function isHttpUrl(url: string | null | undefined): url is string {
  return !!url && url.startsWith("http");
}

export function participantPhoto(p: DisplayParticipant): string | null {
  const raw = p.student?.photo ?? p.externalAthlete?.photoUrl;
  return isHttpUrl(raw) ? raw : null;
}

export function participantNationality(p: DisplayParticipant): string | null {
  return p.student?.nationality ?? p.externalAthlete?.nationality ?? null;
}

export function participantBelt(p: DisplayParticipant): string | null {
  if (p.student) return p.student.beltHistory?.[0]?.beltColor ?? null;
  return p.externalAthlete?.beltColor ?? null;
}

export function participantClubName(p: DisplayParticipant): string | null {
  return p.student?.dojo?.name ?? p.externalAthlete?.externalClub?.clubName ?? null;
}

/** true = el participante viene de un club visitante inscrito por link público. */
export function participantIsExternal(p: DisplayParticipant): boolean {
  return !!p.externalAthlete;
}
