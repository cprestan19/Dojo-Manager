import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendPaymentReminder } from "@/lib/email";
import { formatDate } from "@/lib/utils";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { CreatePaymentSchema, UpdatePaymentSchema, validationError } from "@/lib/validation";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { withReadOnlyGuard } from "@/lib/billing/readOnlyGuard";
import {
  sendWhatsAppTemplate, buildOverdueVars, buildConfirmedVars, resolveGuardianContact,
} from "@/lib/whatsapp/sendTemplate";
import { generateAndUploadReceiptPdf } from "@/lib/whatsapp/receiptPdf";

type SessionUser = { role?: string; dojoId?: string | null };

/**
 * Confirmación de pago por WhatsApp — compartida entre _POST (pago creado ya
 * como "paid" desde el modal "Agregar Pago" del perfil del alumno, con
 * status="paid" preseleccionado por defecto) y _PUT (transición real
 * pending/late → paid). Antes solo vivía en _PUT, así que un pago creado
 * directamente como pagado nunca disparaba el WhatsApp — nunca fallaba,
 * simplemente no se llamaba. Síncrono pero nunca bloquea la respuesta al
 * admin si algo falla.
 */
async function notifyPaymentConfirmedWhatsApp(
  dojoId:  string,
  payment: { id: string; studentId: string; amount: number; paidDate: Date | null; dueDate: Date },
  ctx:     ReturnType<typeof buildAuditCtx>,
) {
  try {
    const student = await prisma.student.findUnique({
      where: { id: payment.studentId, dojoId },
      select: {
        id: true, fullName: true, firstName: true, lastName: true, studentCode: true,
        motherName: true, motherPhone: true, fatherName: true, fatherPhone: true,
        primaryGuardian: true, whatsappOptIn: true,
      },
    });
    const guardianContact = student ? resolveGuardianContact(student) : { name: null, phone: null };
    if (!student?.whatsappOptIn || !guardianContact.phone) return;

    const dojo = await prisma.dojo.findUnique({ where: { id: dojoId }, select: { name: true, logo: true } });
    if (!dojo) return;

    const paidDate  = formatDate(payment.paidDate ?? new Date());
    const receiptNo = payment.id.slice(-8).toUpperCase();
    const { bodyParams } = buildConfirmedVars({
      guardianName: guardianContact.name,
      dojo,
      amount: payment.amount,
      paidDate,
    });

    // El header del template es un documento PDF obligatorio — si la
    // generación/subida falla, no se envía el WhatsApp (Meta rechaza
    // el template sin ese header). Ver sendTemplate.ts.
    let headerDocument: { link: string; filename: string; publicId: string } | undefined;
    try {
      headerDocument = await generateAndUploadReceiptPdf({
        dojoName:    dojo.name,
        dojoLogoUrl: dojo.logo,
        receiptNo,
        studentName: student.fullName || `${student.firstName} ${student.lastName}`.trim(),
        studentCode: student.studentCode,
        concept:     `Mensualidad ${new Date(payment.dueDate).toLocaleDateString("es-PA", { month: "long", year: "numeric" })}`,
        paidDate,
        amount:      payment.amount,
      });
    } catch (pdfErr) {
      console.error("Error generando/subiendo recibo PDF para WhatsApp:", pdfErr);
    }

    if (headerDocument) {
      const result = await sendWhatsAppTemplate({
        dojoId, studentId: student.id, paymentId: payment.id,
        type: "PAYMENT_CONFIRMED", templateName: "confirmacion_pago_dojomaster",
        headerDocument, bodyParams,
      });
      await logAudit({
        ...ctx, action: "WHATSAPP_PAYMENT_CONFIRMED_SENT", module: AUDIT_MODULE.WHATSAPP,
        resourceType: "Payment", resourceId: payment.id, targetId: student.id,
        statusCode: 200, details: JSON.stringify(result),
      });
    }
  } catch (err) {
    console.error("Error sending WhatsApp payment confirmation:", err);
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const status    = searchParams.get("status");
  const type      = searchParams.get("type");
  const dateFrom  = searchParams.get("dateFrom"); // filtra por dueDate — YYYY-MM-DD
  const dateTo    = searchParams.get("dateTo");

  const payments = await prisma.payment.findMany({
    where: {
      student: { dojoId },
      ...(studentId ? { studentId } : {}),
      ...(status    ? { status }    : {}),
      ...(type      ? { type }      : {}),
      ...(dateFrom || dateTo ? {
        dueDate: {
          ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
          ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59`) }   : {}),
        },
      } : {}),
    },
    include: {
      student: { select: { fullName: true, firstName: true, lastName: true, motherName: true, motherEmail: true, fatherName: true, fatherEmail: true } },
    },
    orderBy: { dueDate: "desc" },
    take: 1000,
  });

  return NextResponse.json(payments);
}

async function _POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

  const parsed = CreatePaymentSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const body = parsed.data;

  // Verify student belongs to this dojo
  const student = await prisma.student.findUnique({ where: { id: body.studentId, dojoId } });
  if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

  const t0      = Date.now();
  const payment = await prisma.payment.create({
    data: {
      studentId: body.studentId,
      type:      body.type,
      amount:    body.amount,
      dueDate:   new Date(body.dueDate),
      paidDate:  body.paidDate ? new Date(body.paidDate) : null,
      status:    body.status,
      note:      body.note ?? null,
    },
    include: {
      student: { select: { fullName: true, firstName: true, lastName: true, motherEmail: true, fatherEmail: true } },
    },
  });

  const ctx = buildAuditCtx(session, req, { startTime: t0, dojoId });
  await logAudit({
    ...ctx,
    action:       "PAYMENT_CREATED",
    module:       AUDIT_MODULE.PAYMENTS,
    resourceType: "Payment",
    resourceId:   payment.id,
    targetId:     body.studentId,
    statusCode:   201,
    details:      JSON.stringify({ amount: body.amount, type: body.type, status: body.status, studentName: payment.student.fullName }),
  });

  // Igual que en _PUT: si el pago nace ya "paid" (ej. modal "Agregar Pago"
  // del perfil del alumno, que preselecciona status="paid"), también cuenta
  // como confirmación de pago para WhatsApp.
  if (payment.status === "paid") {
    await notifyPaymentConfirmedWhatsApp(dojoId, payment, ctx);
  }

  return NextResponse.json(payment, { status: 201 });
}

async function _PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

  const parsed = UpdatePaymentSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const { id, ...data } = parsed.data;

  const t0      = Date.now();
  const before  = await prisma.payment.findFirst({
    where:  { id, student: { dojoId } },
    select: { status: true, amount: true, dueDate: true },
  });
  const payment = await prisma.payment.update({
    where: { id, student: { dojoId } },
    data: {
      ...(data.status   !== undefined ? { status: data.status } : {}),
      ...(data.paidDate !== undefined ? { paidDate: data.paidDate ? new Date(data.paidDate) : null } : {}),
      ...(data.dueDate  !== undefined ? { dueDate:  new Date(data.dueDate)  } : {}),
      ...(data.amount   !== undefined ? { amount: data.amount } : {}),
      ...(data.note     !== undefined ? { note: data.note ?? null } : {}),
    },
  });

  const action = data.status === "paid" && before?.status !== "paid"
    ? "PAYMENT_MARKED_PAID"
    : "PAYMENT_UPDATED";

  const ctx = buildAuditCtx(session, req, { startTime: t0, dojoId });
  await logAudit({
    ...ctx,
    action,
    module:       AUDIT_MODULE.PAYMENTS,
    resourceType: "Payment",
    resourceId:   id,
    statusCode:   200,
    details:      JSON.stringify({
      before: before ? { status: before.status, amount: before.amount, dueDate: before.dueDate } : null,
      after:  { status: payment.status, amount: payment.amount, dueDate: payment.dueDate },
    }),
  });

  // Confirmación de pago por WhatsApp — solo en la transición real a "paid".
  if (action === "PAYMENT_MARKED_PAID") {
    await notifyPaymentConfirmedWhatsApp(dojoId, payment, ctx);
  }

  return NextResponse.json(payment);
}

async function _PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const dojoInfo = dojoId ? await prisma.dojo.findUnique({
    where: { id: dojoId },
    select: {
      name: true, logo: true, phone: true, slogan: true, ownerName: true,
      reminderToleranceDays: true, lateInterestPct: true, autoRemindersEnabled: true,
    },
  }) : null;

  const toleranceDays = dojoInfo?.reminderToleranceDays ?? 5;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - toleranceDays);

  const latePayments = await prisma.payment.findMany({
    where: {
      student:      dojoId ? { dojoId } : {},
      status:       { in: ["pending", "late"] },
      paidDate:     null,
      dueDate:      { lte: cutoff },
      reminderSent: false,
    },
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

  let sent = 0;
  let whatsappSent = 0;
  for (const p of latePayments) {
    const studentName = p.student.fullName || `${p.student.firstName} ${p.student.lastName}`.trim();
    const daysLate    = Math.floor((Date.now() - new Date(p.dueDate).getTime()) / 86400000);
    const recipients  = [
      p.student.motherEmail ? { address: p.student.motherEmail, guardianName: p.student.motherName ?? "Madre/Tutora" } : null,
      p.student.fatherEmail ? { address: p.student.fatherEmail, guardianName: p.student.fatherName ?? "Padre/Tutor"  } : null,
    ].filter(Boolean) as { address: string; guardianName: string }[];

    for (const r of recipients) {
      try {
        await sendPaymentReminder({
          to: r.address, studentName, guardianName: r.guardianName,
          amount: p.amount, dueDate: formatDate(p.dueDate), daysLate,
          toleranceDays, interestPct: dojoInfo?.lateInterestPct ?? 10,
          dojo: dojoInfo ?? undefined,
        });
        sent++;
      } catch { /* skip */ }
    }

    // WhatsApp — canal adicional del botón masivo, nunca bloquea el correo.
    const guardianContact = resolveGuardianContact(p.student);
    if (p.student.whatsappOptIn && guardianContact.phone && dojoInfo && dojoId) {
      try {
        const { headerParams, bodyParams } = buildOverdueVars({
          guardianName: guardianContact.name,
          dojo: { name: dojoInfo.name, lateInterestPct: dojoInfo.lateInterestPct, phone: dojoInfo.phone },
          student: { fullName: studentName },
          amount: p.amount, daysLate,
        });
        const result = await sendWhatsAppTemplate({
          dojoId, studentId: p.student.id, paymentId: p.id,
          type: "PAYMENT_OVERDUE", templateName: "aviso_atraso_dojomaster",
          headerParams, bodyParams,
        });
        if (result.sent) whatsappSent++;
      } catch { /* skip */ }
    }
  }

  // Todos los pagos procesados reciben el mismo cambio — un solo update
  // en vez de uno por pago dentro del loop.
  if (latePayments.length > 0) {
    await prisma.payment.updateMany({
      where: { id: { in: latePayments.map(p => p.id) } },
      data:  { status: "late", reminderSent: true },
    });
  }

  if (latePayments.length > 0) {
    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx, action: "WHATSAPP_OVERDUE_SENT_BULK", module: AUDIT_MODULE.WHATSAPP,
      resourceType: "Payment", statusCode: 200,
      details: JSON.stringify({ processed: latePayments.length, whatsappSent }),
    });
  }

  return NextResponse.json({ processed: latePayments.length, emailsSent: sent, whatsappSent });
}

async function _DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const payment = await prisma.payment.findUnique({
    where:  { id: body.id as string },
    select: { id: true, student: { select: { dojoId: true, fullName: true } }, amount: true, type: true, status: true },
  });

  if (!payment || payment.student.dojoId !== dojoId)
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });

  await prisma.payment.delete({ where: { id: payment.id } });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  await logAudit({
    action:       "PAYMENT_DELETED",
    module:       AUDIT_MODULE.PAYMENTS,
    resourceType: "Payment",
    resourceId:   payment.id,
    dojoId,
    ip,
    details:      JSON.stringify({ amount: payment.amount, type: payment.type, status: payment.status, student: payment.student.fullName }),
  });

  return NextResponse.json({ ok: true });
}

export const POST  = withReadOnlyGuard(_POST);
export const PUT   = withReadOnlyGuard(_PUT);
export const PATCH = withReadOnlyGuard(_PATCH);
export const DELETE = withReadOnlyGuard(_DELETE);
