import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { createMPPreapprovalPlan, createMPSubscription } from "@/lib/billing/mercadopago";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";
import { PaymentGateway, BillingCycle } from "@prisma/client";

type SessionUser = { role?: string; dojoId?: string | null; email?: string };

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId, email } = session.user as SessionUser;
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

    const price = billingCycle === "MONTHLY" ? plan.monthlyPrice : plan.annualPrice;

    const { planId: mpPlanId } = await createMPPreapprovalPlan(plan.name, price, billingCycle);

    const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "https://dojomasteronline.com";
    const payerEmail = email ?? "user@dojomasteronline.com";

    const { subscriptionId, initPoint } = await createMPSubscription(
      mpPlanId,
      payerEmail,
      `${appUrl}/dashboard/billing`,
    );

    // Upsert subscription record
    await prisma.subscription.upsert({
      where:  { dojoId },
      create: {
        dojoId,
        planId,
        gateway:         PaymentGateway.MERCADOPAGO,
        mpSubscriptionId: subscriptionId,
        cycle:           billingCycle === "MONTHLY" ? BillingCycle.MONTHLY : BillingCycle.ANNUAL,
        trialEndsAt:     new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      update: {
        planId,
        gateway:         PaymentGateway.MERCADOPAGO,
        mpSubscriptionId: subscriptionId,
        cycle:           billingCycle === "MONTHLY" ? BillingCycle.MONTHLY : BillingCycle.ANNUAL,
      },
    });

    await logAudit({
      action:       "CHECKOUT_INITIATED",
      module:       AUDIT_MODULE.SYSADMIN,
      resourceType: "Subscription",
      dojoId,
      details:      JSON.stringify({ gateway: "MERCADOPAGO", planId, cycle: billingCycle, subscriptionId }),
    });

    return NextResponse.json({ initPoint });
  } catch (err) {
    console.error("POST /api/billing/checkout/mercadopago error:", err);
    return NextResponse.json({ error: "Error al iniciar pago con MercadoPago" }, { status: 500 });
  }
}
