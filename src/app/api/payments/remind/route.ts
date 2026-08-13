import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendPaymentReminder } from "@/lib/email";
import { formatDate } from "@/lib/utils";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { sendWhatsAppTemplate, buildOverdueVars, resolveGuardianContact } from "@/lib/whatsapp/sendTemplate";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  // NOTE: role needed for sysadmin context — check SessionUser type
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { paymentId } = await req.json();

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId, student: { dojoId } },
    include: {
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

  if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });

  const dojo = await prisma.dojo.findUnique({
    where: { id: dojoId },
    select: {
      name: true, email: true, logo: true, phone: true, slogan: true, ownerName: true,
      reminderToleranceDays: true, lateInterestPct: true,
    },
  });

  const studentName = payment.student.fullName || `${payment.student.firstName} ${payment.student.lastName}`.trim();
  const daysLate    = Math.max(0, Math.floor((Date.now() - new Date(payment.dueDate).getTime()) / 86400000));

  const recipients = [
    payment.student.motherEmail
      ? { address: payment.student.motherEmail, guardianName: payment.student.motherName ?? "Madre/Tutora" }
      : null,
    payment.student.fatherEmail
      ? { address: payment.student.fatherEmail, guardianName: payment.student.fatherName ?? "Padre/Tutor" }
      : null,
  ].filter(Boolean) as { address: string; guardianName: string }[];

  const guardianContact = resolveGuardianContact(payment.student);
  const hasWhatsappChannel = payment.student.whatsappOptIn && !!guardianContact.phone;

  if (recipients.length === 0 && !hasWhatsappChannel)
    return NextResponse.json({ error: "El alumno no tiene correos ni WhatsApp registrados" }, { status: 400 });

  let sent = 0;
  for (const r of recipients) {
    try {
      await sendPaymentReminder({
        to:           r.address,
        studentName,
        guardianName: r.guardianName,
        amount:       payment.amount,
        dueDate:      formatDate(payment.dueDate),
        daysLate,
        toleranceDays: dojo?.reminderToleranceDays ?? 5,
        interestPct:   dojo?.lateInterestPct       ?? 10,
        dojo:          dojo ?? undefined,
      });
      sent++;
    } catch (err) {
      console.error("Error sending reminder:", err);
    }
  }

  // WhatsApp — canal adicional, nunca bloquea el correo ni la respuesta al admin.
  let whatsappSent = false;
  if (hasWhatsappChannel && dojo) {
    try {
      const { headerParams, bodyParams } = buildOverdueVars({
        guardianName: guardianContact.name,
        dojo: { name: dojo.name, lateInterestPct: dojo.lateInterestPct, phone: dojo.phone },
        student: { fullName: studentName },
        amount: payment.amount,
        daysLate,
      });
      const result = await sendWhatsAppTemplate({
        dojoId, studentId: payment.student.id, paymentId: payment.id,
        type: "PAYMENT_OVERDUE", templateName: "aviso_atraso_dojomaster",
        headerParams, bodyParams,
      });
      whatsappSent = result.sent;
      const ctx = buildAuditCtx(session, req, { dojoId });
      await logAudit({
        ...ctx, action: "WHATSAPP_OVERDUE_SENT_MANUAL", module: AUDIT_MODULE.WHATSAPP,
        resourceType: "Payment", resourceId: payment.id, targetId: payment.student.id,
        statusCode: 200, details: JSON.stringify(result),
      });
    } catch (err) {
      console.error("Error sending WhatsApp reminder:", err);
    }
  }

  await prisma.payment.update({ where: { id: paymentId }, data: { reminderSent: true } });
  return NextResponse.json({ sent, emails: recipients.map(r => r.address), whatsappSent });
}
