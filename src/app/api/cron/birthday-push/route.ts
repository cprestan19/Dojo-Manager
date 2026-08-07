import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPushToSubscriptions, logPushSent } from "@/lib/push";
import { ymdInTz, DEFAULT_TIMEZONE } from "@/lib/timezone";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/birthday-push — envía push de cumpleaños a los alumnos que cumplen años hoy
// (calculado en la zona horaria de CADA dojo, no una sola zona global)
// Protegido por Authorization: Bearer CRON_SECRET
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const now = new Date();

    const candidates = await prisma.student.findMany({
      where: {
        active: true,
        dojo:   { pushSettings: { enabled: true, notifyBirthday: true } },
      },
      select: { id: true, fullName: true, birthDate: true, dojoId: true, dojo: { select: { timezone: true } } },
    });

    const birthdayStudents = candidates.filter(s => {
      const [, todayMonth, todayDay] = ymdInTz(now, s.dojo.timezone ?? DEFAULT_TIMEZONE).split("-").map(Number);
      return s.birthDate.getUTCMonth() + 1 === todayMonth && s.birthDate.getUTCDate() === todayDay;
    });

    let sent = 0, skipped = 0;

    for (const student of birthdayStudents) {
      const subs = await prisma.pushSubscription.findMany({
        where:  { studentId: student.id, active: true },
        select: { endpoint: true, p256dh: true, auth: true },
      });
      if (subs.length === 0) { skipped++; continue; }

      const firstName = student.fullName.trim().split(/\s+/)[0] || student.fullName;

      const result = await sendPushToSubscriptions(subs, {
        title: `🎉 ¡Feliz cumpleaños, ${firstName}!`,
        body:  "Que este nuevo año de vida esté lleno de salud, alegría y muchos éxitos. ¡Disfruta tu día al máximo! 🎂🥋",
        url:   "/portal",
        tag:   "birthday",
      });

      await logPushSent({
        dojoId: student.dojoId,
        type:   "birthday",
        title:  `¡Feliz cumpleaños, ${firstName}!`,
        body:   "Que este nuevo año de vida esté lleno de salud, alegría y muchos éxitos.",
        url:    "/portal",
        result,
      });

      if (result.success > 0) sent++; else skipped++;
    }

    return NextResponse.json({ ok: true, matched: birthdayStudents.length, sent, skipped });
  } catch (err) {
    console.error("[cron/birthday-push] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
