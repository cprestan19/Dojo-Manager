import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPushToSubscriptions, logPushSent } from "@/lib/push";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const PANAMA_TZ    = "America/Panama";
const REMINDER_DAYS = 3; // recordatorio 3 días antes del vencimiento

function panamaDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PANAMA_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

// GET /api/cron/payment-reminder-push — push a alumnos con mensualidad venciendo en 3 días (hora Panamá)
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

    const payments = await prisma.payment.findMany({
      where: {
        status:  "pending",
        dueDate: { gte: rangeStart, lte: rangeEnd },
        student: {
          active: true,
          dojo:   { pushSettings: { enabled: true, notifyPaymentReminder: true } },
        },
      },
      select: {
        id: true, amount: true, dueDate: true,
        student: { select: { id: true, dojoId: true, fullName: true } },
      },
    });

    let sent = 0, skipped = 0;

    for (const payment of payments) {
      const subs = await prisma.pushSubscription.findMany({
        where:  { studentId: payment.student.id, active: true },
        select: { endpoint: true, p256dh: true, auth: true },
      });
      if (subs.length === 0) { skipped++; continue; }

      const dueDateStr = payment.dueDate.toLocaleDateString("es-PA", {
        timeZone: PANAMA_TZ, day: "numeric", month: "long",
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
