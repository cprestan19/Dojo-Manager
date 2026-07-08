import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPushToSubscriptions, logPushSent } from "@/lib/push";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const PANAMA_TZ     = "America/Panama";
const REMINDER_DAYS = 2; // recordatorio 2 días antes del cierre de postulación

function panamaDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PANAMA_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

// GET /api/cron/exam-deadline-push — push a alumnos invitados que no han respondido
// y cuyo plazo de postulación vence en 2 días (hora Panamá).
// Protegido por Authorization: Bearer CRON_SECRET
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const targetDate = new Date(Date.now() + REMINDER_DAYS * 86_400_000);
    const targetDay   = panamaDay(targetDate);
    const rangeStart   = new Date(`${targetDay}T00:00:00-05:00`);
    const rangeEnd     = new Date(`${targetDay}T23:59:59-05:00`);

    const applications = await prisma.examApplication.findMany({
      where: {
        status:   "PUBLISHED",
        deadline: { gte: rangeStart, lte: rangeEnd },
        dojo:     { pushSettings: { enabled: true, notifyExamDeadline: true } },
      },
      select: {
        id: true, title: true, dojoId: true, deadline: true,
        invitees: {
          where:  { response: "PENDING" },
          select: { studentId: true },
        },
      },
    });

    let sent = 0, skipped = 0;

    for (const app of applications) {
      if (app.invitees.length === 0 || !app.deadline) continue;

      const studentIds = app.invitees.map(i => i.studentId);
      const subs = await prisma.pushSubscription.findMany({
        where:  { studentId: { in: studentIds }, active: true },
        select: { endpoint: true, p256dh: true, auth: true },
      });
      if (subs.length === 0) { skipped++; continue; }

      const deadlineStr = app.deadline.toLocaleDateString("es-PA", {
        timeZone: PANAMA_TZ, day: "numeric", month: "long",
      });

      const result = await sendPushToSubscriptions(subs, {
        title: "⚠️ Vence el plazo de postulación",
        body:  `"${app.title}" — tienes hasta el ${deadlineStr} para confirmar tu participación.`,
        url:   "/portal/postulaciones",
        tag:   "exam-deadline",
      });

      await logPushSent({
        dojoId: app.dojoId,
        type:   "exam_deadline",
        title:  "Vence el plazo de postulación",
        body:   `"${app.title}" vence el ${deadlineStr}`,
        url:    "/portal/postulaciones",
        result,
      });

      if (result.success > 0) sent++; else skipped++;
    }

    return NextResponse.json({ ok: true, matched: applications.length, sent, skipped });
  } catch (err) {
    console.error("[cron/exam-deadline-push] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
