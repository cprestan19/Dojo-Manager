import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId)
    return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const body       = await req.json().catch(() => ({})) as { month?: string };
  const targetDate = body.month ? new Date(body.month) : new Date();
  const year       = targetDate.getFullYear();
  const month      = targetDate.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59);

  const students = await prisma.student.findMany({
    where:   { dojoId, active: true },
    include: { inscription: true },
  });

  const eligible = students.filter(
    s => s.inscription && s.inscription.monthlyAmount > 0
  );

  if (eligible.length === 0) {
    return NextResponse.json({ created: 0, skipped: students.length });
  }

  // 1 query para detectar todos los pagos existentes del mes — evita N+1
  const existingPayments = await prisma.payment.findMany({
    where: {
      studentId: { in: eligible.map(s => s.id) },
      type:      "monthly",
      dueDate:   { gte: monthStart, lte: monthEnd },
    },
    select: { studentId: true },
  });
  const alreadyPaid = new Set(existingPayments.map(p => p.studentId));

  const toCreate = eligible
    .filter(s => !alreadyPaid.has(s.id))
    .map(s => ({
      studentId: s.id,
      type:      "monthly",
      amount:    Math.max(0, s.inscription!.monthlyAmount + s.inscription!.discountAmount),
      dueDate:   monthStart,
      status:    "pending",
    }));

  // 1 query para crear todos en lote — en vez de N creates seriales
  if (toCreate.length > 0) {
    await prisma.payment.createMany({ data: toCreate, skipDuplicates: true });
  }

  const skipped = students.length - toCreate.length;
  return NextResponse.json({ created: toCreate.length, skipped });
}
