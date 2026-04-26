import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendPaymentReminder } from "@/lib/email";
import { formatDate } from "@/lib/utils";

type SessionUser = { role?: string; dojoId?: string | null };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  if (!dojoId) return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });

  const { paymentId } = await req.json();

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId, student: { dojoId } },
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

  if (recipients.length === 0)
    return NextResponse.json({ error: "El alumno no tiene correos registrados" }, { status: 400 });

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

  await prisma.payment.update({ where: { id: paymentId }, data: { reminderSent: true } });
  return NextResponse.json({ sent, emails: recipients.map(r => r.address) });
}
