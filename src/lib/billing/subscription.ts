import prisma from "@/lib/prisma";
import { SubscriptionStatus, BillingCycle, type Plan, type Subscription } from "@prisma/client";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";

export const FREE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.COMPLIMENTARY,
  SubscriptionStatus.SPECIAL_ACCESS,
];

// ── Types ─────────────────────────────────────────────────────────────────────

export type SubscriptionWithPlan = Subscription & { plan: Plan };

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getDojoSubscription(
  dojoId: string,
): Promise<SubscriptionWithPlan | null> {
  return prisma.subscription.findUnique({
    where:   { dojoId },
    include: { plan: true },
  });
}

export async function isDojoReadOnly(dojoId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where:  { dojoId },
    select: { status: true, trialEndsAt: true },
  });

  if (!sub) return false;

  // Acceso permanente — nunca es read-only
  if (sub.status === SubscriptionStatus.COMPLIMENTARY) return false;

  // Acceso especial con fecha — read-only si expiró
  if (sub.status === SubscriptionStatus.SPECIAL_ACCESS) {
    return sub.trialEndsAt < new Date();
  }

  if (sub.status === SubscriptionStatus.READ_ONLY) return true;
  if (sub.status === SubscriptionStatus.PAST_DUE)  return true;

  return false;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

// Al crear un dojo nuevo se asigna suscripción ACTIVE directamente —
// sin período de prueba ni limitación de días.
export async function createTrialSubscription(
  dojoId: string,
  planId: string,
): Promise<Subscription> {
  const sub = await prisma.subscription.create({
    data: {
      dojoId,
      planId,
      status:      SubscriptionStatus.ACTIVE,
      cycle:       BillingCycle.MONTHLY,
      trialEndsAt: new Date(),
    },
  });

  await logAudit({
    action:       "SUBSCRIPTION_CREATED",
    module:       AUDIT_MODULE.SYSADMIN,
    resourceType: "Subscription",
    resourceId:   sub.id,
    dojoId,
    details:      JSON.stringify({ planId }),
  });

  return sub;
}

export async function checkExpiredTrials(): Promise<number> {
  const now = new Date();
  const expired = await prisma.subscription.findMany({
    where: {
      status:      SubscriptionStatus.TRIAL,
      trialEndsAt: { lt: now },
    },
    select: { id: true, dojoId: true },
  });

  if (expired.length === 0) return 0;

  await prisma.subscription.updateMany({
    where: { id: { in: expired.map(s => s.id) } },
    data:  { status: SubscriptionStatus.ACTIVE },
  });

  await Promise.allSettled(
    expired.map(s =>
      logAudit({
        action:       "TRIAL_EXPIRED",
        module:       AUDIT_MODULE.SYSADMIN,
        resourceType: "Subscription",
        resourceId:   s.id,
        dojoId:       s.dojoId,
        details:      "Trial expired — moved to ACTIVE",
      }),
    ),
  );

  return expired.length;
}

// ── Acceso especial permanente (COMPLIMENTARY) ────────────────────────────────

export async function grantComplimentary(
  dojoId:    string,
  grantedBy: string,
  note?:     string,
): Promise<Subscription> {
  const plan = await getOrCreateDefaultPlan();
  const sub  = await prisma.subscription.upsert({
    where:  { dojoId },
    create: {
      dojoId,
      planId:      plan.id,
      status:      SubscriptionStatus.COMPLIMENTARY,
      cycle:       BillingCycle.MONTHLY,
      trialEndsAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
      grantedBy,
      grantedAt:   new Date(),
      grantNote:   note ?? null,
    },
    update: {
      status:    SubscriptionStatus.COMPLIMENTARY,
      grantedBy,
      grantedAt: new Date(),
      grantNote: note ?? null,
    },
  });

  await logAudit({
    action:       "GRANT_COMPLIMENTARY",
    module:       AUDIT_MODULE.SYSADMIN,
    resourceType: "Subscription",
    resourceId:   sub.id,
    dojoId,
    details:      JSON.stringify({ grantedBy, note }),
  });

  return sub;
}

export async function revokeComplimentary(
  dojoId:    string,
  grantedBy: string,
): Promise<Subscription> {
  const sub = await prisma.subscription.update({
    where: { dojoId },
    data:  {
      status:    SubscriptionStatus.READ_ONLY,
      grantedBy: null,
      grantedAt: null,
      grantNote: null,
    },
  });

  await logAudit({
    action:       "REVOKE_COMPLIMENTARY",
    module:       AUDIT_MODULE.SYSADMIN,
    resourceType: "Subscription",
    resourceId:   sub.id,
    dojoId,
    details:      JSON.stringify({ revokedBy: grantedBy }),
  });

  return sub;
}

// ── Acceso especial con fecha (SPECIAL_ACCESS) ────────────────────────────────

export async function grantSpecialAccess(
  dojoId:    string,
  grantedBy: string,
  endsAt:    Date,
  planId:    string,
  note?:     string,
): Promise<Subscription> {
  const sub = await prisma.subscription.upsert({
    where:  { dojoId },
    create: {
      dojoId,
      planId,
      status:      SubscriptionStatus.SPECIAL_ACCESS,
      cycle:       BillingCycle.MONTHLY,
      trialEndsAt: endsAt,
      grantedBy,
      grantedAt:   new Date(),
      grantNote:   note ?? null,
    },
    update: {
      planId,
      status:      SubscriptionStatus.SPECIAL_ACCESS,
      trialEndsAt: endsAt,
      grantedBy,
      grantedAt:   new Date(),
      grantNote:   note ?? null,
    },
  });

  await logAudit({
    action:       "GRANT_SPECIAL_ACCESS",
    module:       AUDIT_MODULE.SYSADMIN,
    resourceType: "Subscription",
    resourceId:   sub.id,
    dojoId,
    details:      JSON.stringify({ grantedBy, endsAt: endsAt.toISOString(), planId, note }),
  });

  return sub;
}

export async function extendSpecialAccess(
  dojoId:    string,
  grantedBy: string,
  newEndsAt: Date,
): Promise<Subscription> {
  const sub = await prisma.subscription.update({
    where: { dojoId },
    data:  {
      trialEndsAt: newEndsAt,
      grantedBy,
      grantedAt:   new Date(),
    },
  });

  await logAudit({
    action:       "EXTEND_SPECIAL_ACCESS",
    module:       AUDIT_MODULE.SYSADMIN,
    resourceType: "Subscription",
    resourceId:   sub.id,
    dojoId,
    details:      JSON.stringify({ grantedBy, newEndsAt: newEndsAt.toISOString() }),
  });

  return sub;
}

// ── Mes gratis (TRIAL) ────────────────────────────────────────────────────────

export async function grantFreeMonth(
  dojoId:    string,
  grantedBy: string,
  months     = 1,
  note?:     string,
): Promise<Subscription> {
  const plan      = await getOrCreateDefaultPlan();
  const now       = new Date();
  const daysToAdd = months * 30;

  const existing = await prisma.subscription.findUnique({ where: { dojoId } });

  const newTrialEnd = existing?.status === SubscriptionStatus.TRIAL
    ? new Date(Math.max(existing.trialEndsAt.getTime(), now.getTime()) + daysToAdd * 86_400_000)
    : new Date(now.getTime() + daysToAdd * 86_400_000);

  const sub = await prisma.subscription.upsert({
    where:  { dojoId },
    create: {
      dojoId,
      planId:      plan.id,
      status:      SubscriptionStatus.TRIAL,
      cycle:       BillingCycle.MONTHLY,
      trialEndsAt: newTrialEnd,
      grantedBy,
      grantedAt:   now,
      grantNote:   note ?? null,
    },
    update: {
      status:      SubscriptionStatus.TRIAL,
      trialEndsAt: newTrialEnd,
      grantedBy,
      grantedAt:   now,
      grantNote:   note ?? null,
    },
  });

  await logAudit({
    action:       "GRANT_FREE_MONTH",
    module:       AUDIT_MODULE.SYSADMIN,
    resourceType: "Subscription",
    resourceId:   sub.id,
    dojoId,
    details:      JSON.stringify({ months, newTrialEnd, grantedBy, note }),
  });

  return sub;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function getOrCreateDefaultPlan(): Promise<Plan> {
  const existing = await prisma.plan.findFirst({
    where:   { isActive: true },
    orderBy: { monthlyPrice: "asc" },
  });
  if (existing) return existing;

  return prisma.plan.create({
    data: {
      name:         "Pro",
      description:  "Plan completo para dojos en crecimiento",
      monthlyPrice: 39,
      annualPrice:  390,
      maxStudents:  null,
      features:     JSON.stringify([
        "Alumnos ilimitados",
        "Torneos Pro",
        "Asistencia QR",
        "Portal de padres",
        "Reportes",
      ]),
      isActive:     true,
    },
  });
}
