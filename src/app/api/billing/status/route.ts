import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveDojoId } from "@/lib/sysadmin-context";
import { getDojoSubscription } from "@/lib/billing/subscription";
import { SubscriptionStatus } from "@prisma/client";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role === "student") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: "Sin contexto de dojo" }, { status: 403 });

    const sub = await getDojoSubscription(dojoId);

    if (!sub) {
      return NextResponse.json({
        status:           null,
        isReadOnly:       false,
        isInTrial:        false,
        daysRemaining:    null,
        plan:             null,
        currentPeriodEnd: null,
        gateway:          null,
        studentLimit:     null,
        activeStudents:   null,
        atStudentLimit:   false,
        hasPaidFeatures:  true,
      });
    }

    const isInTrial  = sub.status === SubscriptionStatus.TRIAL;
    const isComplimentary = sub.status === SubscriptionStatus.COMPLIMENTARY;
    const readOnly   =
      !isComplimentary && (
        sub.status === SubscriptionStatus.READ_ONLY ||
        sub.status === SubscriptionStatus.PAST_DUE
      );
    let daysRemaining: number | null = null;

    if (isInTrial) {
      const diff = sub.trialEndsAt.getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    // Student limit — only relevant if plan has a maxStudents cap and not complimentary
    const maxStudents = sub.plan?.maxStudents ?? null;
    let activeStudents: number | null = null;
    if (maxStudents != null && !isComplimentary) {
      activeStudents = await prisma.student.count({
        where: { dojoId, active: true },
      });
    }

    return NextResponse.json({
      status:           sub.status,
      isReadOnly:       readOnly,
      isInTrial,
      daysRemaining,
      plan: sub.plan
        ? {
            name:         sub.plan.name,
            monthlyPrice: sub.plan.monthlyPrice,
            annualPrice:  sub.plan.annualPrice,
            maxStudents,
          }
        : null,
      currentPeriodEnd: sub.currentPeriodEnd ?? null,
      gateway:          sub.gateway ?? null,
      studentLimit:     maxStudents,
      activeStudents,
      atStudentLimit:   maxStudents != null && activeStudents != null && activeStudents >= maxStudents,
      // Torneos, Tienda y Página pública — solo planes pagos (Silver/Gold)
      hasPaidFeatures:  isComplimentary || (sub.plan?.monthlyPrice ?? 0) > 0,
    });
  } catch (err) {
    console.error("GET /api/billing/status error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
