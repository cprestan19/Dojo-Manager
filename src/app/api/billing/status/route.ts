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

    const isComplimentary   = sub.status === SubscriptionStatus.COMPLIMENTARY;
    const isSpecialAccess   = sub.status === SubscriptionStatus.SPECIAL_ACCESS;
    const isInTrial         = sub.status === SubscriptionStatus.TRIAL;
    const now               = new Date();

    // SPECIAL_ACCESS expira cuando pasa la fecha de acceso
    const specialExpired = isSpecialAccess && sub.trialEndsAt < now;

    const readOnly =
      specialExpired ||
      sub.status === SubscriptionStatus.READ_ONLY ||
      sub.status === SubscriptionStatus.PAST_DUE;

    let daysRemaining: number | null = null;
    if (isInTrial || isSpecialAccess) {
      const diff = sub.trialEndsAt.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    // Student limit — se aplica a todos excepto COMPLIMENTARY permanente
    const maxStudents = sub.plan?.maxStudents ?? null;
    let activeStudents: number | null = null;
    const enforceLimit = !isComplimentary && maxStudents != null;
    if (enforceLimit) {
      activeStudents = await prisma.student.count({
        where: { dojoId, active: true },
      });
    }

    return NextResponse.json({
      status:           sub.status,
      isReadOnly:       readOnly,
      isInTrial,
      isSpecialAccess,
      daysRemaining,
      plan: sub.plan
        ? {
            name:         sub.plan.name,
            monthlyPrice: sub.plan.monthlyPrice,
            annualPrice:  sub.plan.annualPrice,
            maxStudents,
          }
        : null,
      currentPeriodEnd:   sub.currentPeriodEnd ?? null,
      gateway:            sub.gateway ?? null,
      studentLimit:       maxStudents,
      activeStudents,
      atStudentLimit:     enforceLimit && activeStudents != null && activeStudents >= maxStudents!,
      hasPaidFeatures:    isComplimentary || isSpecialAccess || (sub.plan?.monthlyPrice ?? 0) > 0,
      // Info de acceso especial con fecha
      specialAccessEndsAt: isSpecialAccess ? sub.trialEndsAt : null,
    });
  } catch (err) {
    console.error("GET /api/billing/status error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
