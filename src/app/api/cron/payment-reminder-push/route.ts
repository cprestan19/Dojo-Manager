import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPushToSubscriptions, logPushSent } from "@/lib/push";
import { ymdInTz, addDaysYMD, DEFAULT_TIMEZONE } from "@/lib/timezone";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const REMINDER_DAYS = 3; // recordatorio 3 días antes del vencimiento

// GET /api/cron/payment-reminder-push — push a alumnos con mensualidad venciendo en 3 días
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
    // dueDate es una fecha pura (sin hora) — se busca en una ventana amplia (REMINDER_DAYS ± 1)
    // para cubrir cualquier zona horaria, y se filtra el día exacto por dojo más abajo.
    const windowStart = new Date(now.getTime() + (REMINDER_DAYS - 1) * 86_400_000);
    const windowEnd   = new Date(now.getTime() + (REMINDER_DAYS + 1) * 86_400_000);

    const payments = await prisma.payment.findMany({
      where: {
        status:  "pending",
        dueDate: { gte: windowStart, lte: windowEnd },
        student: {
          active: true,
          dojo:   { pushSettings: { enabled: true, notifyPaymentReminder: true } },
        },
      },
      select: {
        id: true, amount: true, dueDate: true,
        student: { select: { id: true, dojoId: true, fullName: true, dojo: { select: { timezone: true } } } },
      },
    });

    let sent = 0, skipped = 0;

    for (const payment of payments) {
      const dojoTz    = payment.student.dojo.timezone ?? DEFAULT_TIMEZONE;
      const targetYMD = addDaysYMD(ymdInTz(now, dojoTz), REMINDER_DAYS);
      const dueYMD    = payment.dueDate.toISOString().slice(0, 10); // fecha pura, sin desplazar
      if (dueYMD !== targetYMD) continue; // no es el día exacto (3 días antes) para este dojo

      const subs = await prisma.pushSubscription.findMany({
        where:  { studentId: payment.student.id, active: true },
        select: { endpoint: true, p256dh: true, auth: true },
      });
      if (subs.length === 0) { skipped++; continue; }

      const dueDateStr = payment.dueDate.toLocaleDateString("es-PA", {
        timeZone: "UTC", day: "numeric", month: "long", // fecha pura: sin conversión de zona
      });

      const result = await sendPushToSubscriptions(subs, {
        title: "💳 Recordatorio de pago",
        body:  `Tu mensualidad de $${payment.amount.toFixed(2)} vence el ${dueDateStr}.`,
        url:   "/portal/payments",
        tag:   "payment-reminder",
      });

      await logPushSent({
        dojoId: payment.student.dojoId,
        type:   "payment",
        title:  "Recordatorio de pago",
        body:   `Mensualidad de $${payment.amount.toFixed(2)} vence el ${dueDateStr}`,
        url:    "/portal/payments",
        result,
      });

      if (result.success > 0) sent++; else skipped++;
    }

    return NextResponse.json({ ok: true, matched: payments.length, sent, skipped });
  } catch (err) {
    console.error("[cron/payment-reminder-push] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
