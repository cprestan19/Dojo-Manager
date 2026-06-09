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

type SessionUser = { role?: string; dojoId?: string | null };

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

  const payments = await prisma.payment.findMany({
    where: {
      student: { dojoId },
      ...(studentId ? { studentId } : {}),
      ...(status    ? { status }    : {}),
      ...(type      ? { type }      : {}),
    },
    include: {
      student: { select: { fullName: true, firstName: true, lastName: true, motherName: true, motherEmail: true, fatherName: true, fatherEmail: true } },
    },
    orderBy: { dueDate: "desc" },
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
          fullName: true, firstName: true, lastName: true,
          motherName: true, motherEmail: true,
          fatherName: true, fatherEmail: true,
        },
      },
    },
  });

  let sent = 0;
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
      } catch (_) { /* skip */ }
    }

    await prisma.payment.update({ where: { id: p.id }, data: { status: "late", reminderSent: true } });
  }

  return NextResponse.json({ processed: latePayments.length, emailsSent: sent });
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
