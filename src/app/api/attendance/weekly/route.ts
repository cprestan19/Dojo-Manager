import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  // weekOffset=0 → current week, weekOffset=-1 → last week
  const weekOffset = Number(new URL(req.url).searchParams.get("weekOffset") ?? "0");

  // Monday of the target week
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun … 6=Sat
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + weekOffset * 7);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // Total active students in the dojo (denominator for %)
  const totalActive = await prisma.student.count({
    where: { dojoId, active: true },
  });

  if (totalActive === 0) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      return { day: DAY_LABELS[d.getDay()], pct: 0, count: 0, date: d.toISOString().split("T")[0] };
    });
    return NextResponse.json({ days, weekLabel: buildWeekLabel(monday, sunday) });
  }

  // Count unique students with "entry" attendance per day
  const raw = await prisma.attendance.findMany({
    where: {
      student: { dojoId },
      type: "entry",
      markedAt: { gte: monday, lte: sunday },
    },
    select: { studentId: true, markedAt: true },
  });

  // Group by day-of-week, count distinct students
  const byDay: Record<number, Set<string>> = {};
  for (const a of raw) {
    const dow = new Date(a.markedAt).getDay();
    if (!byDay[dow]) byDay[dow] = new Set();
    byDay[dow].add(a.studentId);
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const dow   = d.getDay();
    const count = byDay[dow]?.size ?? 0;
    const pct   = Math.round((count / totalActive) * 100);
    return { day: DAY_LABELS[dow], pct, count, date: d.toISOString().split("T")[0] };
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
