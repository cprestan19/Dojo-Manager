import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendPaymentReminder } from "@/lib/email";
import { formatDate } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const status    = searchParams.get("status");
  const type      = searchParams.get("type");

  const payments = await prisma.payment.findMany({
    where: {
      ...(studentId ? { studentId } : {}),
      ...(status    ? { status }    : {}),
      ...(type      ? { type }      : {}),
    },
    include: {
      student: { select: { firstName: true, lastName: true, motherEmail: true, fatherEmail: true } },
    },
    orderBy: { dueDate: "desc" },
  });

  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();

  const payment = await prisma.payment.create({
    data: {
      studentId: body.studentId,
      type:      body.type,
      amount:    Number(body.amount),
      dueDate:   new Date(body.dueDate),
      paidDate:  body.paidDate ? new Date(body.paidDate) : null,
      status:    body.status ?? "pending",
      note:      body.note ?? null,
    },
    include: {
      student: { select: { firstName: true, lastName: true, motherEmail: true, fatherEmail: true } },
    },
  });

  return NextResponse.json(payment, { status: 201 });
}

// PUT – mark payment as paid or update
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { id, ...data } = body;

  const payment = await prisma.payment.update({
    where: { id },
    data: {
      status:   data.status,
      paidDate: data.paidDate ? new Date(data.paidDate) : null,
      note:     data.note ?? null,
    },
  });

  return NextResponse.json(payment);
}

// POST to /api/payments/send-reminders (manual trigger)
export async function PATCH() {
  // Find all payments that are 3+ days late and haven't had a reminder sent
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const latePayments = await prisma.payment.findMany({
    where: {
      status:        { in: ["pending", "late"] },
      paidDate:      null,
      dueDate:       { lte: threeDaysAgo },
      reminderSent:  false,
    },
    include: {
      student: { select: { firstName: true, lastName: true, motherEmail: true, fatherEmail: true } },
    },
  });

  let sent = 0;
  for (const p of latePayments) {
    const emails = [p.student.motherEmail, p.student.fatherEmail].filter(Boolean) as string[];
    const daysLate = Math.floor((Date.now() - new Date(p.dueDate).getTime()) / 86400000);
    const studentName = `${p.student.firstName} ${p.student.lastName}`;

    for (const email of emails) {
      try {
        await sendPaymentReminder({
          to: email, studentName,
          amount: p.amount,
          dueDate: formatDate(p.dueDate),
          daysLate,
        });
        sent++;
      } catch (_) { /* skip if email fails */ }
    }

    // Mark as late + reminder sent
    await prisma.payment.update({
      where: { id: p.id },
      data:  { status: "late", reminderSent: true },
    });
  }

  return NextResponse.json({ processed: latePayments.length, emailsSent: sent });
}
