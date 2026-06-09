import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";
import { SubscriptionStatus, InvoiceStatus, PaymentGateway } from "@prisma/client";

// PayPal sends webhook events — we handle the key subscription lifecycle events.
// Signature verification uses the raw body + PayPal headers.

async function verifyPayPalSignature(req: NextRequest, rawBody: string): Promise<boolean> {
  try {
    const transmissionId  = req.headers.get("paypal-transmission-id")  ?? "";
    const transmissionTime= req.headers.get("paypal-transmission-time") ?? "";
    const certUrl         = req.headers.get("paypal-cert-url")          ?? "";
    const authAlgo        = req.headers.get("paypal-auth-algo")         ?? "";
    const transmissionSig = req.headers.get("paypal-transmission-sig")  ?? "";
    const webhookId       = process.env.PAYPAL_WEBHOOK_ID               ?? "";

    if (!webhookId) {
      console.error("[paypal-webhook] PAYPAL_WEBHOOK_ID no configurado — rechazando petición");
      return false;
    }

    const id     = process.env.PAYPAL_CLIENT_ID     ?? "";
    const secret = process.env.PAYPAL_CLIENT_SECRET ?? "";
    const creds  = Buffer.from(`${id}:${secret}`).toString("base64");
    const mode   = process.env.PAYPAL_MODE ?? "sandbox";
    const base   = mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

    const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
      method:  "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
      body:    "grant_type=client_credentials",
    });
    const { access_token } = await tokenRes.json() as { access_token: string };

    const verifyRes = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo:         authAlgo,
        cert_url:          certUrl,
        transmission_id:   transmissionId,
        transmission_sig:  transmissionSig,
        transmission_time: transmissionTime,
        webhook_id:        webhookId,
        webhook_event:     JSON.parse(rawBody),
      }),
    });
    const { verification_status } = await verifyRes.json() as { verification_status: string };
    return verification_status === "SUCCESS";
  } catch {
    return false;
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const valid   = await verifyPayPalSignature(req, rawBody);
    if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

    const event = JSON.parse(rawBody) as {
      event_type: string;
      resource: Record<string, unknown>;
    };

    const { event_type, resource } = event;

    switch (event_type) {
      // ── Activación inicial (primer pago aprobado) ─────────────────────────
      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        const subId = resource.id as string;
        const sub = await prisma.subscription.findFirst({ where: { paypalSubscriptionId: subId } });
        if (!sub) break;

        const now = new Date();
        const end = sub.cycle === "MONTHLY" ? addDays(now, 30) : addDays(now, 365);
        await prisma.subscription.update({
          where: { id: sub.id },
          data:  { status: SubscriptionStatus.ACTIVE, currentPeriodStart: now, currentPeriodEnd: end },
        });

        // Registrar factura del primer pago
        const lastPayment = (resource.billing_info as Record<string, unknown> | undefined)
          ?.last_payment as { amount?: { currency_code?: string; value?: string } } | undefined;
        const amount   = parseFloat(lastPayment?.amount?.value ?? "0");
        const currency = lastPayment?.amount?.currency_code ?? "USD";
        if (amount > 0) {
          await prisma.invoice.create({
            data: {
              subscriptionId: sub.id,
              dojoId:         sub.dojoId,
              amount,
              currency,
              status:         InvoiceStatus.PAID,
              gateway:        PaymentGateway.PAYPAL,
              gatewayInvoiceId: `activated-${subId}-${now.getTime()}`,
              paidAt:         now,
            },
          });
        }
        await logAudit({ action: "SUBSCRIPTION_ACTIVATED", module: AUDIT_MODULE.SYSADMIN, resourceType: "Subscription", resourceId: sub.id, dojoId: sub.dojoId });
        break;
      }

      // ── Reactivación tras suspensión ──────────────────────────────────────
      case "BILLING.SUBSCRIPTION.RE-ACTIVATED": {
        const subId = resource.id as string;
        const sub = await prisma.subscription.findFirst({ where: { paypalSubscriptionId: subId } });
        if (!sub) break;

        const now = new Date();
        const end = sub.cycle === "MONTHLY" ? addDays(now, 30) : addDays(now, 365);
        await prisma.subscription.update({
          where: { id: sub.id },
          data:  { status: SubscriptionStatus.ACTIVE, currentPeriodStart: now, currentPeriodEnd: end },
        });
        await logAudit({ action: "SUBSCRIPTION_REACTIVATED", module: AUDIT_MODULE.SYSADMIN, resourceType: "Subscription", resourceId: sub.id, dojoId: sub.dojoId });
        break;
      }

      // ── Renovación mensual exitosa (UPDATED con next_billing_time avanzado) ─
      case "BILLING.SUBSCRIPTION.UPDATED": {
        const subId = resource.id as string;
        const sub = await prisma.subscription.findFirst({ where: { paypalSubscriptionId: subId } });
        if (!sub || sub.status !== SubscriptionStatus.ACTIVE) break;

        const billingInfo = resource.billing_info as Record<string, unknown> | undefined;
        const nextBilling = billingInfo?.next_billing_time as string | undefined;
        const lastPayment = billingInfo?.last_payment as
          { amount?: { currency_code?: string; value?: string }; time?: string } | undefined;

        if (!lastPayment?.amount?.value || !nextBilling) break;

        const paidAt  = lastPayment.time ? new Date(lastPayment.time) : new Date();
        const amount  = parseFloat(lastPayment.amount.value);
        const currency = lastPayment.amount.currency_code ?? "USD";
        const gatewayInvoiceId = `renewal-${subId}-${paidAt.getTime()}`;

        // Deduplicar — evitar doble registro si el evento llega dos veces
        const already = await prisma.invoice.findFirst({
          where: { gatewayInvoiceId, gateway: PaymentGateway.PAYPAL },
          select: { id: true },
        });
        if (!already && amount > 0) {
          const newEnd = new Date(nextBilling);
          await prisma.invoice.create({
            data: {
              subscriptionId: sub.id,
              dojoId:         sub.dojoId,
              amount,
              currency,
              status:         InvoiceStatus.PAID,
              gateway:        PaymentGateway.PAYPAL,
              gatewayInvoiceId,
              paidAt,
            },
          });
          await prisma.subscription.update({
            where: { id: sub.id },
            data:  { currentPeriodEnd: newEnd },
          });
          await logAudit({ action: "INVOICE_PAID", module: AUDIT_MODULE.SYSADMIN, resourceType: "Invoice", dojoId: sub.dojoId });
        }
        break;
      }

      // ── Pago fallido ──────────────────────────────────────────────────────
      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
        const subId = resource.id as string;
        const sub = await prisma.subscription.findFirst({ where: { paypalSubscriptionId: subId } });
        if (!sub) break;

        const billingInfo = resource.billing_info as Record<string, unknown> | undefined;
        const lastFailedPayment = billingInfo?.last_failed_payment as
          { amount?: { currency_code?: string; value?: string } } | undefined;
        const amount   = parseFloat(lastFailedPayment?.amount?.value ?? "0");
        const currency = lastFailedPayment?.amount?.currency_code ?? "USD";

        await prisma.invoice.create({
          data: {
            subscriptionId: sub.id,
            dojoId:         sub.dojoId,
            amount,
            currency,
            status:         InvoiceStatus.FAILED,
            gateway:        PaymentGateway.PAYPAL,
          },
        });
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: SubscriptionStatus.PAST_DUE } });
        await logAudit({ action: "INVOICE_FAILED", module: AUDIT_MODULE.SYSADMIN, resourceType: "Invoice", dojoId: sub.dojoId });
        break;
      }

      // ── Suspensión ────────────────────────────────────────────────────────
      case "BILLING.SUBSCRIPTION.SUSPENDED": {
        const subId = resource.id as string;
        const sub = await prisma.subscription.findFirst({ where: { paypalSubscriptionId: subId } });
        if (!sub) break;
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: SubscriptionStatus.PAST_DUE } });
        await logAudit({ action: "SUBSCRIPTION_SUSPENDED", module: AUDIT_MODULE.SYSADMIN, resourceType: "Subscription", resourceId: sub.id, dojoId: sub.dojoId });
        break;
      }

      // ── Cancelación ───────────────────────────────────────────────────────
      case "BILLING.SUBSCRIPTION.CANCELLED": {
        const subId = resource.id as string;
        const sub = await prisma.subscription.findFirst({ where: { paypalSubscriptionId: subId } });
        if (!sub) break;
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: SubscriptionStatus.CANCELED } });
        await logAudit({ action: "SUBSCRIPTION_CANCELED", module: AUDIT_MODULE.SYSADMIN, resourceType: "Subscription", resourceId: sub.id, dojoId: sub.dojoId });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[paypal-webhook] error:", err);
    return NextResponse.json({ received: true }); // Always 200 to avoid PayPal retries on app errors
  }
}
