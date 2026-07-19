import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import {
  generatePaymentLink,
  signReturnToken,
  buildAttemptId,
  currentCclw,
  getMode,
} from "@/lib/billing/paguelofacil";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";
import { sendPagueloFacilWelcomeEmail } from "@/lib/billing/paguelofacilNotify";
import { PaymentGateway, BillingCycle, InvoiceStatus, PagueloFacilLinkStatus } from "@prisma/client";

type SessionUser = { role?: string; dojoId?: string | null };

const LINK_EXPIRES_IN_SECONDS = 24 * 60 * 60; // 24 horas
const FREE_FIRST_MONTH_DAYS   = 30; // solo para dojos que nunca han tenido suscripción

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin")
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body?.planId || !body?.cycle) {
      return NextResponse.json({ error: "planId y cycle son requeridos" }, { status: 400 });
    }

    const { planId, cycle } = body as { planId: string; cycle: string };
    if (!["MONTHLY", "ANNUAL"].includes(cycle)) {
      return NextResponse.json({ error: "cycle debe ser MONTHLY o ANNUAL" }, { status: 400 });
    }
    const billingCycle = cycle as "MONTHLY" | "ANNUAL";

    const plan = await prisma.plan.findUnique({ where: { id: planId, isActive: true } });
    if (!plan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });

    const amount = billingCycle === "MONTHLY" ? plan.monthlyPrice : plan.annualPrice;
    const bCycle = billingCycle === "MONTHLY" ? BillingCycle.MONTHLY : BillingCycle.ANNUAL;

    // Un dojo "nuevo" es uno que nunca tuvo fila de Subscription — así se distingue
    // de un dojo existente que cambia de plan/gateway (ese sí paga de inmediato).
    const isNewDojo = !(await prisma.subscription.findUnique({ where: { dojoId }, select: { id: true } }));

    // Upsert subscription record — mismo patrón que PayPal/MercadoPago.
    // A diferencia de esos dos, PagueloFacil no tiene objeto de suscripción remoto:
    // cada ciclo se cobra generando un Invoice + link nuevo (ver Invoice más abajo).
    const subscription = await prisma.subscription.upsert({
      where:  { dojoId },
      create: {
        dojoId,
        planId,
        gateway:     PaymentGateway.PAGUELOFACIL,
        cycle:       bCycle,
        trialEndsAt: new Date(Date.now() + FREE_FIRST_MONTH_DAYS * 24 * 60 * 60 * 1000),
      },
      update: {
        planId,
        gateway: PaymentGateway.PAGUELOFACIL,
        cycle:   bCycle,
      },
    });

    // Primer mes gratis — solo para dojos nuevos. No se genera factura ni link
    // todavía; el cron de renovación (ya existente) lo detectará automáticamente
    // cuando falten ~3 días para trialEndsAt y enviará el link de cobro por correo,
    // igual que cualquier otra renovación.
    if (isNewDojo) {
      await logAudit({
        action:       "SUBSCRIPTION_TRIAL_STARTED",
        module:       AUDIT_MODULE.SYSADMIN,
        resourceType: "Subscription",
        resourceId:   subscription.id,
        dojoId,
        details:      JSON.stringify({ gateway: "PAGUELOFACIL", planId, cycle: billingCycle }),
      });
      await sendPagueloFacilWelcomeEmail(dojoId, plan.name, amount, subscription.trialEndsAt).catch(() => {});
      return NextResponse.json({ trial: true });
    }

    // Idempotencia: si ya existe un Invoice PENDING con un link vigente (no expirado)
    // para esta suscripción, se reutiliza en vez de generar uno nuevo por doble click.
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        subscriptionId: subscription.id,
        gateway:        PaymentGateway.PAGUELOFACIL,
        status:         InvoiceStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
      include: {
        pagueloFacilTransactions: {
          where:   { status: PagueloFacilLinkStatus.PENDING, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
          take:    1,
        },
      },
    });

    const reusableTx = existingInvoice?.pagueloFacilTransactions[0];
    if (reusableTx) {
      const generatedUrl = (reusableTx.rawResponse as { generatedUrl?: string } | null)?.generatedUrl;
      if (generatedUrl) {
        return NextResponse.json({ url: generatedUrl, reused: true });
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        dojoId,
        amount,
        currency: "USD",
        status:   InvoiceStatus.PENDING,
        gateway:  PaymentGateway.PAGUELOFACIL,
      },
    });

    const attemptId   = buildAttemptId(["manual", subscription.id, invoice.id]);
    const signedToken = signReturnToken(invoice.id, dojoId, attemptId);

    const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "https://dojomasteronline.com";
    const returnUrl =
      `${appUrl}/api/webhooks/paguelofacil` +
      `?invoiceId=${encodeURIComponent(invoice.id)}` +
      `&dojoId=${encodeURIComponent(dojoId)}` +
      `&attemptId=${encodeURIComponent(attemptId)}` +
      `&token=${encodeURIComponent(signedToken)}`;

    const link = await generatePaymentLink({
      amount,
      description:      `Suscripcion DojoMasterOnline - ${plan.name} (${billingCycle === "MONTHLY" ? "Mensual" : "Anual"})`,
      returnUrl,
      expiresInSeconds:  LINK_EXPIRES_IN_SECONDS,
    });

    await prisma.pagueloFacilTransaction.create({
      data: {
        invoiceId:      invoice.id,
        dojoId,
        linkCode:       link.code,
        cclw:           currentCclw(),
        amountExpected: amount,
        status:         PagueloFacilLinkStatus.PENDING,
        environment:    getMode(),
        signedToken,
        attemptId,
        expiresAt:      new Date(Date.now() + LINK_EXPIRES_IN_SECONDS * 1000),
        rawResponse:    { generatedUrl: link.url },
      },
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data:  { gatewayInvoiceId: link.code },
    });

    await logAudit({
      action:       "CHECKOUT_INITIATED",
      module:       AUDIT_MODULE.SYSADMIN,
      resourceType: "Invoice",
      resourceId:   invoice.id,
      dojoId,
      details:      JSON.stringify({ gateway: "PAGUELOFACIL", planId, cycle: billingCycle, linkCode: link.code, environment: getMode() }),
    });

    return NextResponse.json({ url: link.url });
  } catch (err) {
    console.error("POST /api/billing/checkout/paguelofacil error:", err);
    const message = err instanceof Error && err.message.includes("por debajo del mínimo")
      ? err.message
      : "Error al iniciar pago con PagueloFacil";
    const status = err instanceof Error && err.message.includes("por debajo del mínimo") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
