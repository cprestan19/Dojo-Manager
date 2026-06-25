import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DOJO_TZ    = "America/Panama";

function toLocalDate(utc: Date): Date {
  const local = new Date(utc.toLocaleString("en-US", { timeZone: DOJO_TZ }));
  return local;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const weekOffset = Number(new URL(req.url).searchParams.get("weekOffset") ?? "0");

  const nowLocal  = toLocalDate(new Date());
  const dayOfWeek = nowLocal.getDay();
  const monday    = new Date(nowLocal);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(nowLocal.getDate() - ((dayOfWeek + 6) % 7) + weekOffset * 7);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const totalActive = await prisma.student.count({
    where: { dojoId, active: true },
  });

  if (totalActive === 0) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      return { day: DAY_LABELS[d.getDay()], pct: 0, count: 0, entries: 0, exits: 0, date: d.toISOString().split("T")[0], schedules: [] };
    });
    return NextResponse.json({ days, weekLabel: buildWeekLabel(monday, sunday), totalActive: 0 });
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
    const localDate = toLocalDate(a.markedAt).toISOString().split("T")[0];
    if (!byDayEntry[localDate]) byDayEntry[localDate] = new Set();
    byDayEntry[localDate].add(a.studentId);
    if (a.scheduleId) {
      if (!byDaySchedule[localDate]) byDaySchedule[localDate] = new Map();
      const name = scheduleMap.get(a.scheduleId) ?? "Sin horario";
      byDaySchedule[localDate].set(name, (byDaySchedule[localDate].get(name) ?? 0) + 1);
    }
  }
  for (const a of rawExits) {
    const localDate = toLocalDate(a.markedAt).toISOString().split("T")[0];
    if (!byDayExit[localDate]) byDayExit[localDate] = new Set();
    byDayExit[localDate].add(a.studentId);
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const dateKey  = d.toISOString().split("T")[0];
    const dow      = d.getDay();
    const entries  = byDayEntry[dateKey]?.size ?? 0;
    const exits    = byDayExit[dateKey]?.size ?? 0;
    const pct      = Math.round((entries / totalActive) * 100);
    const schedules = byDaySchedule[dateKey]
      ? [...byDaySchedule[dateKey].entries()].map(([name, count]) => ({ name, count }))
      : [];
    return { day: DAY_LABELS[dow], pct, count: entries, entries, exits, date: dateKey, schedules };
  });

  return NextResponse.json({ days, weekLabel: buildWeekLabel(monday, sunday), totalActive });
}

function buildWeekLabel(monday: Date, sunday: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString("es-PA", { day: "2-digit", month: "short" });
  const now  = new Date();
  const thisMon = new Date(now);
  const dow = now.getDay();
  thisMon.setHours(0,0,0,0);
  thisMon.setDate(now.getDate() - ((dow + 6) % 7));
  if (monday.toDateString() === thisMon.toDateString()) return "Esta semana";
  const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
  if (monday.toDateString() === lastMon.toDateString()) return "Semana pasada";
  return `${fmt(monday)} – ${fmt(sunday)}`;
}
