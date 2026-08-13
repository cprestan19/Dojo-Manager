import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPaymentReminder } from "@/lib/email";
import { formatDate } from "@/lib/utils";
import {
  sendWhatsAppTemplate, buildOverdueVars, resolveGuardianContact,
} from "@/lib/whatsapp/sendTemplate";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/payment-late-status — pasa a "late" los pagos "pending" que ya
// superaron los días de tolerancia configurados por cada dojo (reminderToleranceDays,
// default 5). Si el dojo tiene "autoRemindersEnabled" activo, además envía
// correo (igual que el botón manual) y WhatsApp (si el alumno tiene opt-in) a
// TODO pago pending o late con dueDate vencido y reminderSent=false — no solo
// a los recién marcados en esta misma corrida, para no perder pagos que ya
// estaban "late" de antes de que existiera el envío automático.
// Protegido por Authorization: Bearer CRON_SECRET
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const dojos = await prisma.dojo.findMany({
      where:  { active: true },
      select: {
        id: true, name: true, logo: true, phone: true, slogan: true, ownerName: true,
        reminderToleranceDays: true, lateInterestPct: true, autoRemindersEnabled: true,
      },
    });

    let updated = 0;
    let emailsSent = 0;
    let whatsappSent = 0;

    for (const dojo of dojos) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (dojo.reminderToleranceDays ?? 5));

      // Paso 1: transición pending → late (comportamiento original, sin tocar).
      const toMarkLate = await prisma.payment.findMany({
        where: {
          student:  { dojoId: dojo.id },
          status:   "pending",
          paidDate: null,
          dueDate:  { lte: cutoff },
        },
        select: { id: true },
      });
      if (toMarkLate.length > 0) {
        await prisma.payment.updateMany({
          where: { id: { in: toMarkLate.map(p => p.id) } },
          data:  { status: "late" },
        });
        updated += toMarkLate.length;
      }

      if (!dojo.autoRemindersEnabled) continue;

      // Paso 2: candidatos a recordatorio — status "pending" O "late" (no solo
      // los recién marcados arriba). Un pago que ya estaba "late" de antes
      // (ej. de corridas previas de este mismo cron antes de tener el envío
      // automático, o de un run anterior sin autoRemindersEnabled) nunca
      // habría recibido recordatorio si solo se mirara "pending" — mismo
      // criterio que ya usa el botón masivo manual (PATCH /api/payments).
      const toNotify = await prisma.payment.findMany({
        where: {
          student:      { dojoId: dojo.id },
          status:       { in: ["pending", "late"] },
          paidDate:     null,
          dueDate:      { lte: cutoff },
          reminderSent: false,
        },
        select: {
          id: true, amount: true, dueDate: true, payToken: true, reminderSent: true,
          student: {
            select: {
              id: true, fullName: true, firstName: true, lastName: true,
              motherName: true, motherEmail: true, motherPhone: true,
              fatherName: true, fatherEmail: true, fatherPhone: true,
              primaryGuardian: true, whatsappOptIn: true,
            },
          },
        },
      });
      if (toNotify.length === 0) continue;

      for (const p of toNotify) {
        const studentName = p.student.fullName || `${p.student.firstName} ${p.student.lastName}`.trim();
        const daysLate     = Math.floor((Date.now() - new Date(p.dueDate).getTime()) / 86400000);

        const recipients = [
          p.student.motherEmail ? { address: p.student.motherEmail, guardianName: p.student.motherName ?? "Madre/Tutora" } : null,
          p.student.fatherEmail ? { address: p.student.fatherEmail, guardianName: p.student.fatherName ?? "Padre/Tutor"  } : null,
        ].filter(Boolean) as { address: string; guardianName: string }[];

        for (const r of recipients) {
          try {
            await sendPaymentReminder({
              to: r.address, studentName, guardianName: r.guardianName,
              amount: p.amount, dueDate: formatDate(p.dueDate), daysLate,
              toleranceDays: dojo.reminderToleranceDays, interestPct: dojo.lateInterestPct,
              dojo,
            });
            emailsSent++;
          } catch { /* skip — no bloquea el resto del batch */ }
        }

        // WhatsApp — nunca bloquea el correo ni el resto del batch.
        try {
          const guardianContact = resolveGuardianContact(p.student);
          if (p.student.whatsappOptIn && guardianContact.phone) {
            const { headerParams, bodyParams } = buildOverdueVars({
              guardianName: guardianContact.name,
              dojo: { name: dojo.name, lateInterestPct: dojo.lateInterestPct, phone: dojo.phone },
              student: { fullName: studentName },
              amount: p.amount, daysLate,
            });
            const result = await sendWhatsAppTemplate({
              dojoId: dojo.id, studentId: p.student.id, paymentId: p.id,
              type: "PAYMENT_OVERDUE", templateName: "aviso_atraso_dojomaster",
              headerParams, bodyParams,
            });
            if (result.sent) whatsappSent++;
          }
        } catch { /* skip */ }
      }

      await prisma.payment.updateMany({
        where: { id: { in: toNotify.map(p => p.id) } },
        data:  { reminderSent: true },
      });

      await logAudit({
        action: "WHATSAPP_OVERDUE_SENT_AUTO", module: AUDIT_MODULE.WHATSAPP,
        resourceType: "Dojo", resourceId: dojo.id, dojoId: dojo.id, statusCode: 200,
        details: JSON.stringify({ processed: toNotify.length }),
      });
    }

    return NextResponse.json({ ok: true, dojosChecked: dojos.length, updated, emailsSent, whatsappSent });
  } catch (err) {
    console.error("[cron/payment-late-status] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
