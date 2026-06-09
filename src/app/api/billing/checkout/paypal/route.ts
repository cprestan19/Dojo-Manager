import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { createPayPalProduct, createPayPalPlan, createPayPalSubscription } from "@/lib/billing/paypal";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";
import { PaymentGateway, BillingCycle } from "@prisma/client";

type SessionUser = { role?: string; dojoId?: string | null };

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

    // Ensure PayPal product exists for this plan
    let productId = plan.paypalProductId;
    if (!productId) {
      const { productId: newProductId } = await createPayPalProduct(
        plan.name,
        plan.description ?? plan.name,
      );
      productId = newProductId;
      await prisma.plan.update({
        where: { id: planId },
        data:  { paypalProductId: productId },
      });
    }

    const { planId: paypalPlanId } = await createPayPalPlan(
      productId,
      plan.name,
      plan.monthlyPrice,
      plan.annualPrice,
      billingCycle,
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://dojomasteronline.com";
    const { subscriptionId, approveUrl } = await createPayPalSubscription(
      paypalPlanId,
      `${appUrl}/dashboard/billing?paypal=success`,
      `${appUrl}/dashboard/billing?paypal=canceled`,
    );

    const bCycle = billingCycle === "MONTHLY" ? BillingCycle.MONTHLY : BillingCycle.ANNUAL;

    // Upsert subscription record
    await prisma.subscription.upsert({
      where:  { dojoId },
      create: {
        dojoId,
        planId,
        gateway:             PaymentGateway.PAYPAL,
        paypalSubscriptionId: subscriptionId,
        cycle:               bCycle,
        trialEndsAt:         new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      update: {
        planId,
        gateway:             PaymentGateway.PAYPAL,
        paypalSubscriptionId: subscriptionId,
        cycle:               bCycle,
      },
    });

    await logAudit({
      action:       "CHECKOUT_INITIATED",
      module:       AUDIT_MODULE.SYSADMIN,
      resourceType: "Subscription",
      dojoId,
      details:      JSON.stringify({ gateway: "PAYPAL", planId, cycle: billingCycle, subscriptionId }),
    });

    return NextResponse.json({ approveUrl });
  } catch (err) {
    console.error("POST /api/billing/checkout/paypal error:", err);
    return NextResponse.json({ error: "Error al iniciar pago con PayPal" }, { status: 500 });
  }
}
