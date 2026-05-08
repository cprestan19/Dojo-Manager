import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendPaymentReminder } from "@/lib/email";
import { formatDate } from "@/lib/utils";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { CreatePaymentSchema, UpdatePaymentSchema, validationError } from "@/lib/validation";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  // NOTE: role needed for sysadmin context — check SessionUser type
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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  // NOTE: role needed for sysadmin context — check SessionUser type
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

  const parsed = CreatePaymentSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const body = parsed.data;

  // Verify student belongs to this dojo
  const student = await prisma.student.findUnique({ where: { id: body.studentId, dojoId } });
  if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

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

  return NextResponse.json(payment, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  // NOTE: role needed for sysadmin context — check SessionUser type
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

  const parsed = UpdatePaymentSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const { id, ...data } = parsed.data;

  const payment = await prisma.payment.update({
    where: { id, student: { dojoId } },
    data: {
      ...(data.status   !== undefined ? { status: data.status } : {}),
      ...(data.paidDate !== undefined ? { paidDate: data.paidDate ? new Date(data.paidDate) : null } : {}),
      ...(data.amount   !== undefined ? { amount: data.amount } : {}),
      ...(data.note     !== undefined ? { note: data.note ?? null } : {}),
    },
  });

  return NextResponse.json(payment);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  // NOTE: role needed for sysadmin context — check SessionUser type

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
