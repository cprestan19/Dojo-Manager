import prisma from "@/lib/prisma";
import { resolveDojoTimezone } from "@/lib/timezone-server";
import { ymdInTz, civilToUtc } from "@/lib/timezone";

export type DisciplineStatus =
  | "exemplary"        // >= 90%
  | "good"             // 70–89%
  | "building"         // 50–69%
  | "needs_attention"  // < 50%
  | "no_data";         // expectedCount === 0

export interface DisciplineData {
  studentId:     string;
  fullName:      string;
  expectedCount: number;
  attendedCount: number;
  percentage:    number | null; // null when no classes scheduled yet this month
  message:       string;
  status:        DisciplineStatus;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const DAY_NAME_TO_NUM: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3,
  jueves: 4,  viernes: 5, sabado: 6,
};

function todayYMD(tz: string): string {
  return ymdInTz(new Date(), tz);
}

function monthStartYMD(tz: string): string {
  return todayYMD(tz).slice(0, 7) + "-01";
}

// noon UTC → stable getUTCDay() regardless of server/client timezone
function ymdDayOfWeek(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12)).getUTCDay();
}

function ymdToMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!, 12);
}

function addDays(ymd: string, n: number): string {
  const ms = ymdToMs(ymd) + n * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function maxYMD(a: string, b: string, c: string): string {
  return a > b ? (a > c ? a : c) : (b > c ? b : c);
}

function minYMD(a: string, b: string): string {
  return a < b ? a : b;
}

function monthEndYMD(tz: string): string {
  const today = todayYMD(tz);
  const [y, m] = today.split("-").map(Number);
  // Date.UTC con mes 0-indexado: m! como "siguiente mes" → día 0 = último día del mes actual
  return new Date(Date.UTC(y!, m!, 0, 12)).toISOString().slice(0, 10);
}

function dateToYMD(d: Date, tz: string): string {
  return ymdInTz(d, tz);
}

function parseDayNums(raw: string): Set<number> {
  try {
    const names = JSON.parse(raw) as string[];
    const nums = names.map(n => DAY_NAME_TO_NUM[n] ?? -1).filter(n => n >= 0);
    return new Set(nums);
  } catch { return new Set(); }
}

// Counts days in [from, to] (inclusive YYYY-MM-DD strings) matching dayNums.
// Max range is 31 days → O(31) per schedule, acceptable.
function countScheduledDays(from: string, to: string, dayNums: Set<number>): number {
  if (from > to || dayNums.size === 0) return 0;
  let count = 0;
  let cur   = from;
  while (cur <= to) {
    if (dayNums.has(ymdDayOfWeek(cur))) count++;
    cur = addDays(cur, 1);
  }
  return count;
}

function getDisciplineStatus(pct: number | null): DisciplineStatus {
  if (pct === null) return "no_data";
  if (pct >= 90)   return "exemplary";
  if (pct >= 70)   return "good";
  if (pct >= 50)   return "building";
  return "needs_attention";
}

function getDisciplineMessage(status: DisciplineStatus): string {
  switch (status) {
    case "exemplary":       return "Disciplina ejemplar. Este es el camino.";
    case "good":            return "Sigue así. Estás cada vez más cerca de tu objetivo mensual.";
    case "building":        return "La constancia se construye entrenamiento a entrenamiento. Vuelve pronto.";
    case "needs_attention": return "Cada entrenamiento cuenta. Tu próxima clase es una oportunidad.";
    case "no_data":         return "Aún sin datos este mes.";
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function calcMonthlyDiscipline(studentId: string): Promise<DisciplineData> {
  const studentDojo = await prisma.student.findUnique({ where: { id: studentId }, select: { dojoId: true } });
  if (!studentDojo) {
    return {
      studentId, fullName: "", expectedCount: 0, attendedCount: 0,
      percentage: null, message: getDisciplineMessage("no_data"), status: "no_data",
    };
  }
  const tz = await resolveDojoTimezone(studentDojo.dojoId);

  const today      = todayYMD(tz);
  const monthStart = monthStartYMD(tz);
  const monthEnd   = monthEndYMD(tz);
  const [msFromY, msFromM, msFromD] = monthStart.split("-").map(Number);
  const [msToY, msToM, msToD]       = today.split("-").map(Number);
  const msFrom = civilToUtc(msFromY, msFromM, msFromD, 0, 0, 0, tz);
  const msTo   = civilToUtc(msToY, msToM, msToD, 23, 59, 59, tz);

  const student = await prisma.student.findUnique({
    where:  { id: studentId },
    select: {
      id:       true,
      fullName: true,
      inscription: { select: { inscriptionDate: true } },
      studentSchedules: {
        where: {
          OR: [
            { removedAt: null },
            { removedAt: { gt: msFrom } },
          ],
        },
        select: {
          assignedAt: true,
          removedAt:  true,
          schedule: { select: { days: true, active: true } },
        },
      },
      attendances: {
        where: { type: "entry", markedAt: { gte: msFrom, lte: msTo } },
        select: { markedAt: true },
      },
    },
  });

  if (!student) {
    return {
      studentId,
      fullName:      "",
      expectedCount: 0,
      attendedCount: 0,
      percentage:    null,
      message:       getDisciplineMessage("no_data"),
      status:        "no_data",
    };
  }

  // Inscription date as the earliest possible start (student didn't exist before it)
  const inscYMD = student.inscription?.inscriptionDate
    ? dateToYMD(student.inscription.inscriptionDate, tz)
    : monthStart;

  let expectedCount = 0;

  for (const ss of student.studentSchedules) {
    if (!ss.schedule.active) continue;

    const assignedYMD = dateToYMD(ss.assignedAt, tz);
    const removedYMD  = ss.removedAt ? dateToYMD(ss.removedAt, tz) : null;

    // Start = latest of (month-start, inscription-date, assignment-date)
    const effectiveFrom = maxYMD(monthStart, inscYMD, assignedYMD);

    // End = earliest of (fin de mes, día-antes-de-baja)
    // Usar monthEnd (no today) para que el denominador sea el mes completo
    const effectiveTo = removedYMD
      ? minYMD(monthEnd, addDays(removedYMD, -1))
      : monthEnd;

    if (effectiveFrom > effectiveTo) continue;

    expectedCount += countScheduledDays(effectiveFrom, effectiveTo, parseDayNums(ss.schedule.days));
  }

  // Distinct calendar days with an entry attendance this month
  const attendedDays  = new Set(student.attendances.map(a => dateToYMD(a.markedAt, tz)));
  // Cap to expectedCount so the UI never shows "5 de 3 entrenamientos"
  const attendedCount = expectedCount > 0 ? Math.min(attendedDays.size, expectedCount) : attendedDays.size;

  const percentage = expectedCount === 0
    ? null
    : Math.min(100, Math.round((attendedCount / expectedCount) * 100));

  const status  = getDisciplineStatus(percentage);
  const message = getDisciplineMessage(status);

  return {
    studentId:    student.id,
    fullName:     student.fullName,
    expectedCount,
    attendedCount,
    percentage,
    message,
    status,
  };
}
