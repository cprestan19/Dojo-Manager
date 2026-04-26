import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendPaymentReceipt } from "@/lib/email";
import { formatDate } from "@/lib/utils";

type SessionUser = { dojoId?: string | null };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  if (!dojoId) return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });

  const { paymentId } = await req.json();

  const payment = await prisma.payment.findUnique({
    where:   { id: paymentId, student: { dojoId } },
    include: {
      student: {
        select: {
          id: true, fullName: true, firstName: true, lastName: true, studentCode: true,
          motherName: true, motherEmail: true,
          fatherName: true, fatherEmail: true,
        },
      },
    },
  });

  if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  if (payment.status !== "paid")
    return NextResponse.json({ error: "El pago aún no está confirmado" }, { status: 400 });

  const dojo = await prisma.dojo.findUnique({
    where:  { id: dojoId },
    select: { name: true, email: true, logo: true, phone: true, slogan: true, ownerName: true },
  });

  const recipients = [
    payment.student.motherEmail
      ? { address: payment.student.motherEmail, name: payment.student.motherName ?? "Madre/Tutora" }
      : null,
    payment.student.fatherEmail
      ? { address: payment.student.fatherEmail, name: payment.student.fatherName ?? "Padre/Tutor" }
      : null,
  ].filter(Boolean) as { address: string; name: string }[];

  if (recipients.length === 0)
    return NextResponse.json({ error: "El alumno no tiene correos registrados" }, { status: 400 });

  const receiptNo   = payment.id.slice(-8).toUpperCase();
  const studentName = payment.student.fullName || `${payment.student.firstName} ${payment.student.lastName}`.trim();
  const paidDate    = payment.paidDate ? formatDate(payment.paidDate) : formatDate(payment.dueDate);
  const concept     = `Mensualidad ${new Date(payment.dueDate).toLocaleDateString("es-PA", {
    month: "long", year: "numeric",
  })}`;

  let sent = 0;
  for (const r of recipients) {
    try {
      await sendPaymentReceipt({
        to:          r.address,
        guardianName: r.name,
        studentName,
        studentCode: payment.student.studentCode,
        receiptNo,
        amount:      payment.amount,
        paidDate,
        concept,
        dojo:        dojo ?? undefined,
      });
      sent++;
    } catch (err) {
      console.error("Receipt send error:", err);
    }
  }

  return NextResponse.json({ sent, recipients: recipients.map(r => r.address) });
}
