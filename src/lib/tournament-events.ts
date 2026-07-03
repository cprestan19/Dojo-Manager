/**
 * Tipos y constantes para el módulo de Asistencia a Torneos.
 * Independiente del módulo Torneo Pro.
 */

export const KATA_OPTIONS = [
  { group: "Heian / Básicos", items: ["Heian Shodan","Heian Nidan","Heian Sandan","Heian Yondan","Heian Godan","Tekki Shodan","Tekki Nidan","Tekki Sandan"] },
  { group: "Bassai / Kanku",  items: ["Bassai Dai","Bassai Sho","Kanku Dai","Kanku Sho"] },
  { group: "Avanzados",       items: ["Jion","Empi","Hangetsu","Jitte","Nijushiho","Gojushiho Dai","Gojushiho Sho","Sochin","Meikyo","Unsu","Wankan","Chinte","Gangaku"] },
];

export const RESULT_OPTIONS = [
  "1° Lugar – Medalla de Oro",
  "2° Lugar – Medalla de Plata",
  "3° Lugar – Medalla de Bronce",
  "4° Lugar",
  "5° Lugar",
  "Eliminado – 1ra Ronda",
  "Eliminado – 2da Ronda",
  "Eliminado – Semifinal",
  "Participación",
];

export interface TEventSummary {
  id:             string;
  name:           string;
  date:           string;
  location:       string;
  notes:          string | null;
  totalStudents:  number;
  arrivedCount:   number;
  confirmedCount: number;
  optedOutCount:  number;
  resultsCount:   number;
}

export interface TEventParticipant {
  participantId:   string;
  studentId:       string;
  fullName:        string;
  belt:            string;
  photo:           string | null;
  studentCode:     number | null;
  birthDate:       string;
  age:             number;
  arrived:         boolean;
  arrivedAt:       string | null;
  scannedBy:       string | null;
  category:        string | null;
  kataName:        string | null;
  kataResult:      string | null;
  kumiteResult:    string | null;
  competitionNotes: string | null;
  confirmed:        boolean;
  optedOut:         boolean;
  optedOutReason:   string | null;
}

export interface TEventDetail extends TEventSummary {
  participants:   TEventParticipant[];
  confirmedCount: number;
  optedOutCount:  number;
}

export interface TEventMedalStudent {
  studentId:   string;
  fullName:    string;
  photo:       string | null;
  studentCode: number | null;
  belt:        string;
  age:         number;
  categories:  string[];
  gold:        number;
  silver:      number;
  bronze:      number;
}

export interface TEventStats {
  totalGold:   number;
  totalSilver: number;
  totalBronze: number;
  students:    TEventMedalStudent[];
}

/** Calcula edad a partir de birthDate */
export function calcAge(birthDate: string): number {
  const today = new Date();
  const birth  = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
