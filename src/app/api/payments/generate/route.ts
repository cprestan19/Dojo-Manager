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

  // Date range for existence checks
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59);
  const midMonth   = new Date(year, month, 15);  // 15th for biweekly second payment

  // Single query — fetch all active students with their inscription period + amounts
  const students = await prisma.student.findMany({
    where:  { dojoId, active: true },
    select: {
      id: true,
      inscription: {
        select: {
          paymentPeriod:  true,
          monthlyAmount:  true,
          biweeklyAmount: true,
          discountAmount: true,
        },
      },
    },
  });

  // ── MONTHLY (unchanged logic) ──────────────────────────────────────────────
  // Includes students whose paymentPeriod is "monthly" or unset (default).
  // discountAmount is an adjustment (+/-) applied on top of the base amount.
  const monthlyEligible = students.filter(
    s => s.inscription
      && (s.inscription.paymentPeriod === "monthly" || !s.inscription.paymentPeriod)
      && s.inscription.monthlyAmount > 0,
  );

  const existingMonthly = monthlyEligible.length > 0
    ? await prisma.payment.findMany({
        where: {
          studentId: { in: monthlyEligible.map(s => s.id) },
          type:      "monthly",
          dueDate:   { gte: monthStart, lte: monthEnd },
        },
        select: { studentId: true },
      })
    : [];
  const alreadyMonthly = new Set(existingMonthly.map(p => p.studentId));

  const toCreateMonthly = monthlyEligible
    .filter(s => !alreadyMonthly.has(s.id))
    .map(s => ({
      studentId: s.id,
      type:      "monthly",
      amount:    Math.max(0, s.inscription!.monthlyAmount + s.inscription!.discountAmount),
      dueDate:   monthStart,
      status:    "pending" as const,
    }));

  // ── BIWEEKLY (new — generates TWO payments per month: 1st and 15th) ────────
  // Uses the same discountAmount adjustment as monthly.
  // Late-payment rules (toleranceDays, interestPct, reminderSent) apply
  // identically because they operate on Payment.status + Payment.dueDate,
  // not on Payment.type.
  const biweeklyEligible = students.filter(
    s => s.inscription
      && s.inscription.paymentPeriod === "biweekly"
      && s.inscription.biweeklyAmount > 0,
  );

  let toCreateBiweekly: {
    studentId: string; type: string; amount: number; dueDate: Date; status: string;
  }[] = [];

  if (biweeklyEligible.length > 0) {
    const existingBiweekly = await prisma.payment.findMany({
      where: {
        studentId: { in: biweeklyEligible.map(s => s.id) },
        type:      "biweekly",
        dueDate:   { gte: monthStart, lte: monthEnd },
      },
      select: { studentId: true, dueDate: true },
    });

    // Track which (studentId, dueDate-day) combos already exist
    const existingSet = new Set(
      existingBiweekly.map(p => `${p.studentId}:${new Date(p.dueDate).getDate()}`),
    );

    for (const s of biweeklyEligible) {
      const amount = Math.max(0, s.inscription!.biweeklyAmount + s.inscription!.discountAmount);

      // 1st of month payment
      if (!existingSet.has(`${s.id}:1`)) {
        toCreateBiweekly.push({
          studentId: s.id, type: "biweekly",
          amount, dueDate: monthStart, status: "pending",
        });
      }
      // 15th of month payment
      if (!existingSet.has(`${s.id}:15`)) {
        toCreateBiweekly.push({
          studentId: s.id, type: "biweekly",
          amount, dueDate: midMonth, status: "pending",
        });
      }
    }
  }

  // ── Batch create both sets ────────────────────────────────────────────────
  const allToCreate = [...toCreateMonthly, ...toCreateBiweekly];

  if (allToCreate.length > 0) {
    await prisma.payment.createMany({ data: allToCreate, skipDuplicates: true });
  }

  return NextResponse.json({
    created:          allToCreate.length,
    createdMonthly:   toCreateMonthly.length,
    createdBiweekly:  toCreateBiweekly.length,
    skipped:          students.length - allToCreate.length,
  });
}
