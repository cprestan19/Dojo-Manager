import prisma from "@/lib/prisma";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";
import { generatePaymentLink, signReturnToken, getMode, currentCclw } from "@/lib/billing/paguelofacil";
import { sendEmail, escHtml } from "@/lib/email";
import {
  PaymentGateway, SubscriptionStatus, InvoiceStatus, PagueloFacilLinkStatus,
  type Subscription, type Plan,
} from "@prisma/client";

const RENEWAL_WINDOW_DAYS  = 3;               // genera el link N días antes de que venza el ciclo
const LINK_EXPIRES_IN_SECONDS = 5 * 24 * 60 * 60; // 5 días para pagar antes de que el link expire
const BATCH_SIZE = 10;                         // procesamiento por lotes — evita timeout y llamadas masivas simultáneas

type SubWithPlan = Subscription & { plan: Plan };

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface RenewalOutcome {
  subscriptionId: string;
  dojoId:         string;
  action:         "skipped" | "generated" | "reused" | "past_due" | "error";
  detail?:        string;
}

export async function runPagueloFacilRenewal(): Promise<{
  scanned: number; generated: number; pastDue: number; errors: number; results: RenewalOutcome[];
}> {
  const now = new Date();

  const eligible = await prisma.subscription.findMany({
    where: {
      gateway: PaymentGateway.PAGUELOFACIL,
      status:  { in: [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
    },
    include: { plan: true },
  });

  const results: RenewalOutcome[] = [];

  for (const batch of chunk(eligible, BATCH_SIZE)) {
    const settled = await Promise.allSettled(batch.map(sub => processSubscription(sub, now)));
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") {
        results.push(r.value);
      } else {
        results.push({ subscriptionId: batch[i].id, dojoId: batch[i].dojoId, action: "error", detail: String(r.reason) });
      }
    });
  }

  return {
    scanned:   eligible.length,
    generated: results.filter(r => r.action === "generated" || r.action === "reused").length,
    pastDue:   results.filter(r => r.action === "past_due").length,
    errors:    results.filter(r => r.action === "error").length,
    results,
  };
}

async function processSubscription(sub: SubWithPlan, now: Date): Promise<RenewalOutcome> {
  const referenceEnd = sub.status === SubscriptionStatus.TRIAL
    ? sub.trialEndsAt
    : (sub.currentPeriodEnd ?? sub.trialEndsAt);

  const overdue     = referenceEnd < now;
  const msUntilEnd   = referenceEnd.getTime() - now.getTime();
  const withinWindow = !overdue && msUntilEnd <= RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  // El ciclo venció sin que se completara un pago — bloquea acceso (isDojoReadOnly()
  // ya trata PAST_DUE como solo-lectura, no se requiere ningún cambio en ese guard).
  if (overdue && sub.status !== SubscriptionStatus.PAST_DUE) {
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: SubscriptionStatus.PAST_DUE } });
    await logAudit({
      action: "SUBSCRIPTION_PAST_DUE", module: AUDIT_MODULE.SYSADMIN,
      resourceType: "Subscription", resourceId: sub.id, dojoId: sub.dojoId,
      details: JSON.stringify({ gateway: "PAGUELOFACIL", referenceEnd: referenceEnd.toISOString() }),
    });
  }

  if (!overdue && !withinWindow) {
    return { subscriptionId: sub.id, dojoId: sub.dojoId, action: "skipped", detail: "fuera de la ventana de renovación" };
  }

  // periodKey a nivel de día — estable mientras no haya una renovación exitosa que
  // mueva currentPeriodEnd/trialEndsAt hacia adelante.
  const periodKey = referenceEnd.toISOString().slice(0, 10);
  const prefix     = `renewal:${sub.id}:${periodKey}:`;

  const priorAttempts = await prisma.pagueloFacilTransaction.findMany({
    where:   { dojoId: sub.dojoId, attemptId: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
  });

  const stillPending = priorAttempts.find(a => a.status === PagueloFacilLinkStatus.PENDING && a.expiresAt > now);
  if (stillPending) {
    return { subscriptionId: sub.id, dojoId: sub.dojoId, action: overdue ? "past_due" : "skipped", detail: "ya hay un link vigente para este ciclo" };
  }
  const alreadyPaid = priorAttempts.find(a => a.status === PagueloFacilLinkStatus.USED);
  if (alreadyPaid) {
    return { subscriptionId: sub.id, dojoId: sub.dojoId, action: "skipped", detail: "ciclo ya pagado" };
  }

  // Reutiliza el Invoice del ciclo si ya existe un intento previo (expirado/fallido);
  // si es el primer intento del ciclo, crea un Invoice nuevo.
  const amount        = sub.cycle === "MONTHLY" ? sub.plan.monthlyPrice : sub.plan.annualPrice;
  const generationIdx = priorAttempts.length;
  const attemptId      = `${prefix}${generationIdx}`;

  try {
    let invoiceId = priorAttempts[0]?.invoiceId;
    if (!invoiceId) {
      const invoice = await prisma.invoice.create({
        data: {
          subscriptionId: sub.id,
          dojoId:         sub.dojoId,
          amount,
          currency: "USD",
          status:   InvoiceStatus.PENDING,
          gateway:  PaymentGateway.PAGUELOFACIL,
        },
      });
      invoiceId = invoice.id;
    }

    const signedToken = signReturnToken(invoiceId, sub.dojoId, attemptId);
    const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? "https://dojomasteronline.com";
    const returnUrl    =
      `${appUrl}/api/webhooks/paguelofacil` +
      `?invoiceId=${encodeURIComponent(invoiceId)}` +
      `&dojoId=${encodeURIComponent(sub.dojoId)}` +
      `&attemptId=${encodeURIComponent(attemptId)}` +
      `&token=${encodeURIComponent(signedToken)}`;

    const link = await generatePaymentLink({
      amount,
      description:      `Renovacion DojoMasterOnline - ${sub.plan.name} (${sub.cycle === "MONTHLY" ? "Mensual" : "Anual"})`,
      returnUrl,
      expiresInSeconds: LINK_EXPIRES_IN_SECONDS,
    });

    await prisma.pagueloFacilTransaction.create({
      data: {
        invoiceId,
        dojoId:         sub.dojoId,
        linkCode:       link.code,
        cclw:           currentCclw(),
        amountExpected: amount,
        status:         PagueloFacilLinkStatus.PENDING,
        environment:    getMode(),
        signedToken,
        attemptId,
        expiresAt:      new Date(now.getTime() + LINK_EXPIRES_IN_SECONDS * 1000),
        rawResponse:    { generatedUrl: link.url },
      },
    });

    if (generationIdx === 0) {
      await prisma.invoice.update({ where: { id: invoiceId }, data: { gatewayInvoiceId: link.code } });
    }

    await logAudit({
      action: "PAGUELOFACIL_RENEWAL_LINK_GENERATED", module: AUDIT_MODULE.SYSADMIN,
      resourceType: "Invoice", resourceId: invoiceId, dojoId: sub.dojoId,
      details: JSON.stringify({ subscriptionId: sub.id, attemptId, amount, environment: getMode() }),
    });

    await notifyDojoAdmins(sub.dojoId, sub.plan.name, amount, link.url).catch(() => {});

    return { subscriptionId: sub.id, dojoId: sub.dojoId, action: overdue ? "past_due" : "generated" };
  } catch (err) {
    await logAudit({
      action: "PAGUELOFACIL_RENEWAL_ERROR", module: AUDIT_MODULE.SYSADMIN,
      resourceType: "Subscription", resourceId: sub.id, dojoId: sub.dojoId,
      details: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
    });
    return { subscriptionId: sub.id, dojoId: sub.dojoId, action: "error", detail: err instanceof Error ? err.message : String(err) };
  }
}

async function notifyDojoAdmins(dojoId: string, planName: string, amount: number, payUrl: string): Promise<void> {
  const admins = await prisma.user.findMany({
    where:  { dojoId, role: "admin", active: true },
    select: { email: true },
  });
  if (admins.length === 0) return;

  const html = `
    <p>Hola,</p>
    <p>Tu suscripción a DojoMasterOnline (plan <strong>${escHtml(planName)}</strong>) tiene un pago pendiente de
    <strong>US$ ${amount.toFixed(2)}</strong>.</p>
    <p><a href="${payUrl}">Pagar ahora con PagueloFacil</a></p>
    <p>Si el enlace expira, se generará uno nuevo automáticamente.</p>
  `;

  await Promise.allSettled(
    admins.map(a => sendEmail({ to: a.email, subject: "Pago pendiente — DojoMasterOnline", html })),
  );
}
