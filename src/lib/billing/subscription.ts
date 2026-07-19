import prisma from "@/lib/prisma";
import { SubscriptionStatus, BillingCycle, PaymentGateway, type Plan, type Subscription } from "@prisma/client";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";

// Error cuyo mensaje es seguro para mostrar tal cual al cliente (a diferencia
// de errores internos/Prisma, que nunca deben llegar sin filtrar a la UI).
export class SubscriptionUserError extends Error {}

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

// Al crear un dojo nuevo se otorga 1 mes gratis desde hoy (status TRIAL,
// gateway PAGUELOFACIL). No requiere ninguna otra acción: el cron diario
// runPagueloFacilRenewal (src/lib/billing/paguelofacilRenewal.ts) detecta
// automáticamente cuando faltan ~3 días para trialEndsAt, genera el link de
// pago y lo envía por correo — igual que cualquier renovación posterior.
// No existe ya un esquema separado de "trial" con expiración manual: el
// vencimiento y el cobro los maneja siempre ese mismo cron.
export async function createFreeMonthSubscription(
  dojoId: string,
  planId: string,
): Promise<Subscription> {
  const sub = await prisma.subscription.create({
    data: {
      dojoId,
      planId,
      status:      SubscriptionStatus.TRIAL,
      cycle:       BillingCycle.MONTHLY,
      gateway:     PaymentGateway.PAGUELOFACIL,
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await logAudit({
    action:       "SUBSCRIPTION_CREATED",
    module:       AUDIT_MODULE.SYSADMIN,
    resourceType: "Subscription",
    resourceId:   sub.id,
    dojoId,
    details:      JSON.stringify({ planId, freeMonthEndsAt: sub.trialEndsAt }),
  });

  return sub;
}

// ── Cambio de plan (mantiene status y fechas de facturación intactas) ─────────

// Cambia el plan de un dojo que sigue en facturación normal (TRIAL/ACTIVE/
// PAST_DUE/etc.) sin tocar su status ni sus fechas de ciclo — a diferencia de
// los grants de arriba, que fuerzan al dojo a un estado de acceso especial.
// Uso típico: un dojo ya activo pide subir o bajar de plan (downgrade vía
// WhatsApp, ver buildDowngradeWhatsApp en PlanSelector.tsx). El límite de
// alumnos del plan nuevo aplica de inmediato (ver validación en
// POST /api/students). No re-cobra ni prorratea nada — el próximo cobro
// (cron de renovación PagueloFacil) ya sale con el precio del plan nuevo.
export async function changeSubscriptionPlan(
  dojoId:    string,
  planId:    string,
  changedBy: string,
  note?:     string,
): Promise<Subscription> {
  const existing = await prisma.subscription.findUnique({ where: { dojoId } });
  if (!existing) throw new SubscriptionUserError("El dojo no tiene una suscripción — usa 'Acceso' para crear una.");

  // isActive: true — un plan retirado/oculto (soft-deleted) no debe poder
  // asignarse a una suscripción en curso, aunque el id siga existiendo.
  const plan = await prisma.plan.findFirst({ where: { id: planId, isActive: true } });
  if (!plan) throw new SubscriptionUserError("El plan seleccionado no existe o ya no está activo.");

  const sub = await prisma.subscription.update({
    where: { dojoId },
    data:  { planId: plan.id },
  });

  await logAudit({
    action:       "SUBSCRIPTION_PLAN_CHANGED",
    module:       AUDIT_MODULE.SYSADMIN,
    resourceType: "Subscription",
    resourceId:   sub.id,
    dojoId,
    details:      JSON.stringify({ changedBy, newPlanId: plan.id, newPlanName: plan.name, note }),
  });

  return sub;
}

// ── Acceso especial permanente (COMPLIMENTARY) ────────────────────────────────

export async function grantComplimentary(
  dojoId:    string,
  grantedBy: string,
  note?:     string,
  planId?:   string,
): Promise<Subscription> {
  const plan = planId
    ? await prisma.plan.findUniqueOrThrow({ where: { id: planId } })
    : await getOrCreateDefaultPlan();

  // COMPLIMENTARY es acceso permanente — nunca debe leer como si fuera a
  // expirar. trialEndsAt se normaliza a +100 años (no se usa para nada en
  // este status, pero evita que quede una fecha próxima confusa si se
  // consulta directo en BD) y currentPeriodStart/End se limpian porque son
  // del último ciclo pagado (si el dojo venía de un plan de pago) y ya no
  // representan nada una vez que pasa a cortesía — se aplica igual en
  // create y update para que un dojo que ya tenía suscripción no arrastre
  // datos de facturación vencidos.
  const farFuture = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);

  const sub  = await prisma.subscription.upsert({
    where:  { dojoId },
    create: {
      dojoId,
      planId:      plan.id,
      status:      SubscriptionStatus.COMPLIMENTARY,
      cycle:       BillingCycle.MONTHLY,
      trialEndsAt: farFuture,
      grantedBy,
      grantedAt:   new Date(),
      grantNote:   note ?? null,
    },
    update: {
      planId:             plan.id,
      status:             SubscriptionStatus.COMPLIMENTARY,
      trialEndsAt:        farFuture,
      currentPeriodStart: null,
      currentPeriodEnd:   null,
      cancelAtPeriodEnd:  false,
      grantedBy,
      grantedAt:          new Date(),
      grantNote:          note ?? null,
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
