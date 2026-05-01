import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

// Absence thresholds (days since last "entry" attendance)
const THRESHOLD_ALERTA = 3;   // leve — starting to disengage
const THRESHOLD_RIESGO = 14;  // high dropout risk

function absenceStatus(daysSince: number | null, enrolledDaysAgo: number): "ACTIVO" | "ALERTA" | "RIESGO" {
  // New students enrolled < THRESHOLD_ALERTA days ago → ACTIVO (too early to flag)
  if (daysSince === null) {
    if (enrolledDaysAgo < THRESHOLD_ALERTA) return "ACTIVO";
    if (enrolledDaysAgo >= THRESHOLD_RIESGO)  return "RIESGO";
    return "ALERTA";
  }
  if (daysSince >= THRESHOLD_RIESGO)  return "RIESGO";
  if (daysSince >= THRESHOLD_ALERTA)  return "ALERTA";
  return "ACTIVO";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const now = new Date();

  // ── 1. Late payments ───────────────────────────────────────────
  const latePaymentsAgg = await prisma.payment.aggregate({
    where: { student: { dojoId }, status: "late" },
    _count: true,
    _sum:   { amount: true },
  });

  const latePaymentsList = await prisma.payment.findMany({
    where:   { student: { dojoId }, status: "late" },
    orderBy: { dueDate: "asc" },
    take:    10,
    select: {
      id: true, amount: true, dueDate: true,
      student: { select: { id: true, fullName: true } },
    },
  });

  // ── 2. Absence alerts ──────────────────────────────────────────
  // Get all active students with their last "entry" attendance
  const students = await prisma.student.findMany({
    where:   { dojoId, active: true },
    select:  {
      id: true, fullName: true, createdAt: true, attendanceStatus: true,
      attendances: {
        where:   { type: "entry" },
        orderBy: { markedAt: "desc" },
        take:    1,
        select:  { markedAt: true },
      },
    },
    orderBy: { fullName: "asc" },
  });

  // Compute current status for each student
  const withStatus = students.map(s => {
    const lastEntry     = s.attendances[0]?.markedAt ?? null;
    const daysSince     = lastEntry ? Math.floor((now.getTime() - lastEntry.getTime()) / 86_400_000) : null;
    const enrolledDays  = Math.floor((now.getTime() - s.createdAt.getTime()) / 86_400_000);
    const status        = absenceStatus(daysSince, enrolledDays);
    return { ...s, daysSince, computedStatus: status };
  });

  const alertStudents = withStatus.filter(s => s.computedStatus === "ALERTA");
  const riskStudents  = withStatus.filter(s => s.computedStatus === "RIESGO");

  // ── 3. Totals ──────────────────────────────────────────────────
  const total =
    latePaymentsAgg._count +
    alertStudents.length +
    riskStudents.length;

  return NextResponse.json({
    total,
    latePayments: {
      count:    latePaymentsAgg._count,
      amount:   latePaymentsAgg._sum.amount ?? 0,
      items:    latePaymentsList.map(p => ({
        id:         p.id,
        studentId:  p.student.id,
        studentName:p.student.fullName,
        amount:     p.amount,
        dueDate:    p.dueDate.toISOString(),
        daysLate:   Math.floor((now.getTime() - p.dueDate.getTime()) / 86_400_000),
      })),
    },
    attendance: {
      alert: {
        count:    alertStudents.length,
        students: alertStudents.slice(0, 10).map(s => ({
          id:         s.id,
          fullName:   s.fullName,
          daysSince:  s.daysSince,
          status:     "ALERTA",
        })),
      },
      risk: {
        count:    riskStudents.length,
        students: riskStudents.slice(0, 10).map(s => ({
          id:         s.id,
          fullName:   s.fullName,
          daysSince:  s.daysSince,
          status:     "RIESGO",
        })),
      },
    },
  });
}
