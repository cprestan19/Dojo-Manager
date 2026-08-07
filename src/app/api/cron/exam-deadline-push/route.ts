import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPushToSubscriptions, logPushSent } from "@/lib/push";
import { ymdInTz, addDaysYMD, DEFAULT_TIMEZONE } from "@/lib/timezone";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const REMINDER_DAYS = 2; // recordatorio 2 días antes del cierre de postulación

// GET /api/cron/exam-deadline-push — push a alumnos invitados que no han respondido
// y cuyo plazo de postulación vence en 2 días (calculado en la zona horaria de cada dojo).
// Protegido por Authorization: Bearer CRON_SECRET
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const now = new Date();
    // deadline es una fecha pura (sin hora) — se busca en una ventana amplia (REMINDER_DAYS ± 1)
    // para cubrir cualquier zona horaria, y se filtra el día exacto por dojo más abajo.
    const windowStart = new Date(now.getTime() + (REMINDER_DAYS - 1) * 86_400_000);
    const windowEnd   = new Date(now.getTime() + (REMINDER_DAYS + 1) * 86_400_000);

    const applications = await prisma.examApplication.findMany({
      where: {
        status:   "PUBLISHED",
        deadline: { gte: windowStart, lte: windowEnd },
        dojo:     { pushSettings: { enabled: true, notifyExamDeadline: true } },
      },
      select: {
        id: true, title: true, dojoId: true, deadline: true,
        dojo: { select: { timezone: true } },
        invitees: {
          where:  { response: "PENDING" },
          select: { studentId: true },
        },
      },
    });

    let sent = 0, skipped = 0;

    for (const app of applications) {
      if (app.invitees.length === 0 || !app.deadline) continue;

      const dojoTz    = app.dojo.timezone ?? DEFAULT_TIMEZONE;
      const targetYMD = addDaysYMD(ymdInTz(now, dojoTz), REMINDER_DAYS);
      const deadlineYMD = app.deadline.toISOString().slice(0, 10); // fecha pura, sin desplazar
      if (deadlineYMD !== targetYMD) continue; // no es el día exacto (2 días antes) para este dojo

      const studentIds = app.invitees.map(i => i.studentId);
      const subs = await prisma.pushSubscription.findMany({
        where:  { studentId: { in: studentIds }, active: true },
        select: { endpoint: true, p256dh: true, auth: true },
      });
      if (subs.length === 0) { skipped++; continue; }

      const deadlineStr = app.deadline.toLocaleDateString("es-PA", {
        timeZone: "UTC", day: "numeric", month: "long", // fecha pura: sin conversión de zona
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
