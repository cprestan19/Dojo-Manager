/**
 * Utilidades de zona horaria — isomorfas (seguras en cliente y servidor).
 *
 * El dojo guarda su zona horaria en `Dojo.timezone` (identificador IANA, ej.
 * "America/Panama", "America/Caracas"). Todas las fechas se almacenan como
 * instantes UTC (Attendance.markedAt, etc.) — estas funciones convierten esos
 * instantes hacia/desde la hora civil del dojo usando la API Intl, que maneja
 * horario de verano correctamente para cualquier zona (a diferencia de sumar/restar
 * un offset fijo en milisegundos, que solo es válido en zonas sin DST).
 */

export const DEFAULT_TIMEZONE = "America/Panama";

export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "America/Panama",                 label: "Panamá (UTC-5)" },
  { value: "America/Bogota",                 label: "Colombia (UTC-5)" },
  { value: "America/Lima",                   label: "Perú (UTC-5)" },
  { value: "America/Guayaquil",              label: "Ecuador (UTC-5)" },
  { value: "America/Caracas",                label: "Venezuela (UTC-4)" },
  { value: "America/La_Paz",                 label: "Bolivia (UTC-4)" },
  { value: "America/Santo_Domingo",          label: "República Dominicana (UTC-4)" },
  { value: "America/Santiago",               label: "Chile (UTC-3/-4)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (UTC-3)" },
  { value: "America/Mexico_City",            label: "México (UTC-6)" },
  { value: "America/Guatemala",              label: "Guatemala (UTC-6)" },
  { value: "America/El_Salvador",            label: "El Salvador (UTC-6)" },
  { value: "America/Costa_Rica",             label: "Costa Rica (UTC-6)" },
  { value: "America/New_York",               label: "Estados Unidos - Este (UTC-5/-4)" },
  { value: "Europe/Madrid",                  label: "España (UTC+1/+2)" },
];

// Código ISO 3166-1 alpha-2 por zona horaria — mismo criterio que ya usa la
// columna "País" de Gestión de Dojos ("el dojo no guarda un campo país propio,
// se deriva de la zona horaria"). Se usa para precargar la bandera/prefijo por
// defecto en los selectores de teléfono (motherPhone/fatherPhone) — el usuario
// puede cambiarla si el acudiente vive en otro país.
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  "America/Panama":                 "PA",
  "America/Bogota":                 "CO",
  "America/Lima":                   "PE",
  "America/Guayaquil":              "EC",
  "America/Caracas":                "VE",
  "America/La_Paz":                 "BO",
  "America/Santo_Domingo":          "DO",
  "America/Santiago":               "CL",
  "America/Argentina/Buenos_Aires": "AR",
  "America/Mexico_City":            "MX",
  "America/Guatemala":              "GT",
  "America/El_Salvador":            "SV",
  "America/Costa_Rica":             "CR",
  "America/New_York":               "US",
  "Europe/Madrid":                  "ES",
};

/** País por defecto (ISO alpha-2) para el selector de teléfono, a partir de la zona horaria del dojo. */
export function timezoneToCountry(tz: string | null | undefined): string {
  return TIMEZONE_TO_COUNTRY[tz ?? ""] ?? "PA";
}

/** YYYY-MM-DD del instante dado, en la zona horaria indicada */
export function ymdInTz(v: string | Date, tz: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(v));
}

/** { h, m } (24h) del instante dado, en la zona horaria indicada */
export function hmInTz(v: string | Date, tz: string = DEFAULT_TIMEZONE): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(v));
  return {
    h: parseInt(parts.find(p => p.type === "hour")?.value ?? "0", 10),
    m: parseInt(parts.find(p => p.type === "minute")?.value ?? "0", 10),
  };
}

/** Fecha/hora legible en español, en la zona horaria del dojo */
export function formatDateTimeTz(v: string | Date, tz: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("es-PA", {
    timeZone: tz,
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: true,
  }).format(new Date(v));
}

/**
 * Instante UTC correspondiente a una hora civil (año, mes, día, hora, minuto, segundo)
 * en la zona horaria indicada. Usa la técnica de "doble conversión" con Intl para
 * resolver el offset real de esa zona en ese instante (correcto con y sin DST).
 */
export function civilToUtc(
  y: number, m: number, d: number, hh: number, mm: number, ss: number,
  tz: string = DEFAULT_TIMEZONE,
): Date {
  const guessUtcMs = Date.UTC(y, m - 1, d, hh, mm, ss);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(guessUtcMs));
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? "0", 10);
  const asIfUtcMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offsetMs = asIfUtcMs - guessUtcMs;
  return new Date(guessUtcMs - offsetMs);
}

/** Instante UTC de una fecha "YYYY-MM-DD" a una hora civil dada (por defecto medianoche) en la zona del dojo */
export function ymdToUtc(ymd: string, tz: string = DEFAULT_TIMEZONE, hh = 0, mm = 0, ss = 0): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return civilToUtc(y, m, d, hh, mm, ss, tz);
}

/** "YYYY-MM-DDTHH:mm" del instante dado, en la zona del dojo — para precargar inputs <input type="datetime-local"> */
export function toDateTimeLocalInTz(v: string | Date, tz: string = DEFAULT_TIMEZONE): string {
  const { h, m } = hmInTz(v, tz);
  return `${ymdInTz(v, tz)}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Instante UTC de un valor "YYYY-MM-DDTHH:mm" (de un <input type="datetime-local">), interpretado en la zona del dojo */
export function dateTimeLocalToUtc(value: string, tz: string = DEFAULT_TIMEZONE): Date {
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = (timePart ?? "00:00").split(":").map(Number);
  return civilToUtc(y, m, d, hh, mm, 0, tz);
}

/** Suma/resta días a una fecha "YYYY-MM-DD" (aritmética de calendario pura, sin zona horaria) */
export function addDaysYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * true si una Postulación de examen ya debe considerarse histórica — pasa a
 * histórico el día calendario siguiente a su fecha límite de respuesta
 * (deadline), o si no tiene deadline, cuando su fecha de examen ya pasó.
 * Comparación por día calendario en la zona del dojo, no por instante — el
 * deadline día X sigue activo todo ese día, recién al día X+1 se oculta.
 */
export function isExamApplicationHistoric(
  deadline: string | Date | null,
  examDate: string | Date,
  tz: string = DEFAULT_TIMEZONE,
): boolean {
  const todayYMD = ymdInTz(new Date(), tz);
  if (deadline) {
    const cutoffYMD = addDaysYMD(ymdInTz(deadline, tz), 1);
    return todayYMD >= cutoffYMD;
  }
  return ymdInTz(examDate, tz) < todayYMD;
}

/** Límites UTC del día calendario "hoy" (00:00:00 a 23:59:59.999) en la zona del dojo */
export function getDayBoundsUtc(now: Date, tz: string = DEFAULT_TIMEZONE): { start: Date; end: Date } {
  const today = ymdInTz(now, tz);
  const [y, m, d] = today.split("-").map(Number);
  const start = civilToUtc(y, m, d, 0, 0, 0, tz);
  const end   = civilToUtc(y, m, d, 23, 59, 59, tz);
  return { start, end: new Date(end.getTime() + 999) };
}

// ── Tardanzas y efectividad de asistencia ─────────────────────────────

// Minutos de tardanza (retraso real desde el inicio de clase) de una marcación de entrada.
// La tolerancia solo decide SI se marca como tardanza — el total reportado es el retraso real,
// no se le resta la tolerancia. Retorna 0 si no aplica (sin horario) o si llegó dentro de tolerancia.
export function getLateMinutes(
  markedAtIso: string,
  scheduleStartTime: string | null | undefined,
  toleranceMinutes: number,
  tz: string = DEFAULT_TIMEZONE,
): number {
  if (!scheduleStartTime) return 0;
  const [hStr, mStr] = scheduleStartTime.split(":");
  const startH = parseInt(hStr ?? "", 10);
  const startM = parseInt(mStr ?? "", 10);
  if (isNaN(startH) || isNaN(startM)) return 0;

  const { h: markedH, m: markedM } = hmInTz(markedAtIso, tz);
  const delay = (markedH * 60 + markedM) - (startH * 60 + startM);
  return delay > toleranceMinutes ? delay : 0;
}

export interface ScheduleAssignment {
  assignedAt: string;
  removedAt: string | null;
  schedule: { days: string };
}

const DAY_KEYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

// % de clases esperadas (según horario(s) asignado(s)) a las que el alumno asistió,
// dentro del rango de fechas filtrado. Se usa para evaluar pases de cinta.
export function computeAttendanceEffectiveness(
  schedules: ScheduleAssignment[],
  from: string,
  to: string,
  attendedYMDs: Set<string>,
  tz: string = DEFAULT_TIMEZONE,
): { expected: number; attended: number; pct: number } | null {
  if (schedules.length === 0) return null;

  const todayYMD = ymdInTz(new Date(), tz);
  const cappedTo = to > todayYMD ? todayYMD : to;
  if (from > cappedTo) return null;

  const windows = schedules.map(ss => {
    let days: string[] = [];
    try {
      const parsed = JSON.parse(ss.schedule.days);
      if (Array.isArray(parsed)) days = parsed;
    } catch { /* ignore malformed days */ }
    return {
      days: new Set(days),
      start: ymdInTz(ss.assignedAt, tz),
      end: ss.removedAt ? ymdInTz(ss.removedAt, tz) : null,
    };
  });

  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = cappedTo.split("-").map(Number);
  let cursor = new Date(Date.UTC(fy, fm - 1, fd));
  const end = new Date(Date.UTC(ty, tm - 1, td));

  let expected = 0;
  let attended = 0;
  while (cursor <= end) {
    const ymd = cursor.toISOString().slice(0, 10);
    const dayKey = DAY_KEYS[cursor.getUTCDay()];
    const isExpected = windows.some(w => w.days.has(dayKey) && ymd >= w.start && (!w.end || ymd <= w.end));
    if (isExpected) {
      expected++;
      if (attendedYMDs.has(ymd)) attended++;
    }
    cursor = new Date(cursor.getTime() + 86400000);
  }

  if (expected === 0) return null;
  return { expected, attended, pct: Math.round((attended / expected) * 100) };
}
