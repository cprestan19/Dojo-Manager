import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { SubscriptionStatus, InvoiceStatus, PaymentGateway } from "@prisma/client";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";

// ⚠️  DEV / SANDBOX ONLY — simula la activación de una suscripción PayPal
// sin necesitar ngrok ni un webhook real.
//
// Autenticación: header Authorization: Bearer <CRON_SECRET>
// Body: { dojoId, event?: "ACTIVATED"|"PAYMENT"|"CANCELLED"|"SUSPENDED" }
//
// Esta ruta NO debe ser accesible en producción.

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function POST(req: NextRequest) {
  // Bloquear en producción
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  // Autenticación con CRON_SECRET
  const auth = req.headers.get("authorization") ?? "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null) as {
      dojoId: string;
      event?: "ACTIVATED" | "PAYMENT" | "CANCELLED" | "SUSPENDED";
    } | null;

    if (!body?.dojoId) {
      return NextResponse.json({ error: "dojoId requerido" }, { status: 400 });
    }

    const event = body.event ?? "ACTIVATED";

    const sub = await prisma.subscription.findUnique({
      where:   { dojoId: body.dojoId },
      include: { plan: true, dojo: { select: { name: true } } },
    });

    if (!sub) {
      return NextResponse.json({
        error: "No hay suscripción para ese dojoId",
        tip:   "Primero inicia un checkout desde /dashboard/billing",
      }, { status: 404 });
    }

    const now = new Date();
    let result: Record<string, unknown> = {};

    switch (event) {
      case "ACTIVATED": {
        const end = sub.cycle === "MONTHLY" ? addDays(now, 30) : addDays(now, 365);
        await prisma.subscription.update({
          where: { id: sub.id },
          data:  { status: SubscriptionStatus.ACTIVE, currentPeriodStart: now, currentPeriodEnd: end },
        });
        await logAudit({
          action: "SUBSCRIPTION_ACTIVATED", module: AUDIT_MODULE.SYSADMIN,
          resourceType: "Subscription", resourceId: sub.id, dojoId: sub.dojoId,
          details: "DEV simulate-payment: ACTIVATED",
        });
        result = { status: "ACTIVE", currentPeriodEnd: end };
        break;
      }

      case "PAYMENT": {
        const amount = sub.cycle === "MONTHLY" ? sub.plan.monthlyPrice : sub.plan.annualPrice;
        const inv = await prisma.invoice.create({
          data: {
            subscriptionId:   sub.id,
            dojoId:           sub.dojoId,
            amount,
            currency:         "USD",
            status:           InvoiceStatus.PAID,
            gateway:          sub.gateway ?? PaymentGateway.PAYPAL,
            gatewayInvoiceId: `SIMULATED-${Date.now()}`,
            paidAt:           now,
          },
        });
        await logAudit({
          action: "INVOICE_PAID", module: AUDIT_MODULE.SYSADMIN,
          resourceType: "Invoice", resourceId: inv.id, dojoId: sub.dojoId,
          details: `DEV simulate-payment: PAYMENT $${amount}`,
        });
        result = { invoiceId: inv.id, amount, currency: "USD" };
        break;
      }

      case "CANCELLED": {
        await prisma.subscription.update({
          where: { id: sub.id },
          data:  { status: SubscriptionStatus.CANCELED },
        });
        await logAudit({
          action: "SUBSCRIPTION_CANCELED", module: AUDIT_MODULE.SYSADMIN,
          resourceType: "Subscription", resourceId: sub.id, dojoId: sub.dojoId,
          details: "DEV simulate-payment: CANCELLED",
        });
        result = { status: "CANCELED" };
        break;
      }

      case "SUSPENDED": {
        await prisma.subscription.update({
          where: { id: sub.id },
          data:  { status: SubscriptionStatus.PAST_DUE },
        });
        await logAudit({
          action: "SUBSCRIPTION_SUSPENDED", module: AUDIT_MODULE.SYSADMIN,
          resourceType: "Subscription", resourceId: sub.id, dojoId: sub.dojoId,
          details: "DEV simulate-payment: SUSPENDED",
        });
        result = { status: "PAST_DUE" };
        break;
      }
    }

    return NextResponse.json({
      ok:      true,
      event,
      dojoId:  sub.dojoId,
      dojo:    sub.dojo.name,
      plan:    sub.plan.name,
      gateway: sub.gateway,
      paypalSubscriptionId: sub.paypalSubscriptionId,
      ...result,
    });

  } catch (err) {
    console.error("[dev/simulate-payment] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
