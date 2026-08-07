import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { resolveDojoTimezone } from "@/lib/timezone-server";
import { ymdInTz, civilToUtc, addDaysYMD } from "@/lib/timezone";

type SessionUser = { role?: string; dojoId?: string | null };

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Día de la semana (0=domingo) de una fecha "YYYY-MM-DD", sin depender de la TZ del proceso */
function dowOfYMD(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const tz = await resolveDojoTimezone(dojoId);
  const weekOffset = Number(new URL(req.url).searchParams.get("weekOffset") ?? "0");

  const todayYMD  = ymdInTz(new Date(), tz);
  const dayOfWeek = dowOfYMD(todayYMD);
  const mondayYMD = addDaysYMD(todayYMD, -((dayOfWeek + 6) % 7) + weekOffset * 7);
  const sundayYMD = addDaysYMD(mondayYMD, 6);

  const [my, mm, md] = mondayYMD.split("-").map(Number);
  const [sy, sm, sd] = sundayYMD.split("-").map(Number);
  const monday = civilToUtc(my, mm, md, 0, 0, 0, tz);
  const sunday = civilToUtc(sy, sm, sd, 23, 59, 59, tz);

  const totalActive = await prisma.student.count({
    where: { dojoId, active: true },
  });

  if (totalActive === 0) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const dateKey = addDaysYMD(mondayYMD, i);
      return { day: DAY_LABELS[dowOfYMD(dateKey)], pct: 0, count: 0, entries: 0, exits: 0, date: dateKey, schedules: [] };
    });
    return NextResponse.json({ days, weekLabel: buildWeekLabel(mondayYMD, sundayYMD, todayYMD), totalActive: 0 });
  }

  const [rawEntries, rawExits] = await Promise.all([
    prisma.attendance.findMany({
      where: { student: { dojoId }, type: "entry", markedAt: { gte: monday, lte: sunday } },
      select: { studentId: true, markedAt: true, scheduleId: true },
    }),
    prisma.attendance.findMany({
      where: { student: { dojoId }, type: "exit", markedAt: { gte: monday, lte: sunday } },
      select: { studentId: true, markedAt: true },
    }),
  ]);

  const scheduleIds = [...new Set(rawEntries.map(a => a.scheduleId).filter(Boolean))] as string[];
  const scheduleMap = new Map<string, string>();
  if (scheduleIds.length > 0) {
    const scheds = await prisma.schedule.findMany({
      where: { id: { in: scheduleIds } },
      select: { id: true, name: true },
    });
    for (const s of scheds) scheduleMap.set(s.id, s.name);
  }

  const byDayEntry:    Record<string, Set<string>>         = {};
  const byDayExit:     Record<string, Set<string>>         = {};
  const byDaySchedule: Record<string, Map<string, number>> = {};

  for (const a of rawEntries) {
    const dateKey = ymdInTz(a.markedAt, tz);
    if (!byDayEntry[dateKey]) byDayEntry[dateKey] = new Set();
    byDayEntry[dateKey].add(a.studentId);
    if (a.scheduleId) {
      if (!byDaySchedule[dateKey]) byDaySchedule[dateKey] = new Map();
      const name = scheduleMap.get(a.scheduleId) ?? "Sin horario";
      byDaySchedule[dateKey].set(name, (byDaySchedule[dateKey].get(name) ?? 0) + 1);
    }
  }
  for (const a of rawExits) {
    const dateKey = ymdInTz(a.markedAt, tz);
    if (!byDayExit[dateKey]) byDayExit[dateKey] = new Set();
    byDayExit[dateKey].add(a.studentId);
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const dateKey  = addDaysYMD(mondayYMD, i);
    const entries  = byDayEntry[dateKey]?.size ?? 0;
    const exits    = byDayExit[dateKey]?.size ?? 0;
    const pct      = Math.round((entries / totalActive) * 100);
    const schedules = byDaySchedule[dateKey]
      ? [...byDaySchedule[dateKey].entries()].map(([name, count]) => ({ name, count }))
      : [];
    return { day: DAY_LABELS[dowOfYMD(dateKey)], pct, count: entries, entries, exits, date: dateKey, schedules };
  });

  return NextResponse.json({ days, weekLabel: buildWeekLabel(mondayYMD, sundayYMD, todayYMD), totalActive });
}

function buildWeekLabel(mondayYMD: string, sundayYMD: string, todayYMD: string): string {
  const fmt = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-PA", { day: "2-digit", month: "short", timeZone: "UTC" });
  };
  const thisMonYMD = addDaysYMD(todayYMD, -((dowOfYMD(todayYMD) + 6) % 7));
  if (mondayYMD === thisMonYMD) return "Esta semana";
  const lastMonYMD = addDaysYMD(thisMonYMD, -7);
  if (mondayYMD === lastMonYMD) return "Semana pasada";
  return `${fmt(mondayYMD)} – ${fmt(sundayYMD)}`;
}
