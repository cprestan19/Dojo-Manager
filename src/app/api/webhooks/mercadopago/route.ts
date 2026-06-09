import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";
import { getMPSubscription, getMPPayment } from "@/lib/billing/mercadopago";
import { SubscriptionStatus, InvoiceStatus, PaymentGateway } from "@prisma/client";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// MercadoPago HMAC-SHA256 signature verification.
// Header x-signature format: "ts={timestamp},v1={hash}"
// Manifest template: "id:{dataId};request-id:{xRequestId};ts:{ts};"
function verifyMPSignature(req: NextRequest, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[mp-webhook] MP_WEBHOOK_SECRET no configurado — rechazando petición");
    return false;
  }

  const xSignature = req.headers.get("x-signature") ?? "";
  const xRequestId = req.headers.get("x-request-id") ?? "";

  // Parse ts and v1 from x-signature
  const parts = Object.fromEntries(
    xSignature.split(",").map(p => p.split("=") as [string, string]),
  );
  const ts = parts["ts"] ?? "";
  const v1 = parts["v1"] ?? "";
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac     = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const topic = req.nextUrl.searchParams.get("topic")
               ?? req.nextUrl.searchParams.get("type");
    const body  = await req.json().catch(() => ({})) as { id?: string | number; data?: { id?: string | number } };

    const resourceId = String(body.data?.id ?? body.id ?? "");
    if (!resourceId) return NextResponse.json({ ok: true });

    // Verify signature using the resource ID from the notification
    if (!verifyMPSignature(req, resourceId)) {
      console.warn("[mp-webhook] Invalid signature for resourceId:", resourceId);
      return NextResponse.json({ ok: true }); // 200 to avoid MP retries on signature errors
    }

    if (topic === "subscription_preapproval" || topic === "preapproval") {
      const mpSub = await getMPSubscription(resourceId);
      const sub   = await prisma.subscription.findFirst({ where: { mpSubscriptionId: resourceId } });
      if (!sub) return NextResponse.json({ ok: true });

      const now = new Date();

      if (mpSub.status === "authorized") {
        const end = sub.cycle === "MONTHLY" ? addDays(now, 30) : addDays(now, 365);
        await prisma.subscription.update({
          where: { id: sub.id },
          data:  { status: SubscriptionStatus.ACTIVE, currentPeriodStart: now, currentPeriodEnd: end },
        });
        await logAudit({ action: "SUBSCRIPTION_ACTIVATED", module: AUDIT_MODULE.SYSADMIN, resourceType: "Subscription", resourceId: sub.id, dojoId: sub.dojoId });
      } else if (mpSub.status === "paused") {
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: SubscriptionStatus.PAST_DUE } });
        await logAudit({ action: "SUBSCRIPTION_PAUSED", module: AUDIT_MODULE.SYSADMIN, resourceType: "Subscription", resourceId: sub.id, dojoId: sub.dojoId });
      } else if (mpSub.status === "cancelled") {
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: SubscriptionStatus.CANCELED } });
        await logAudit({ action: "SUBSCRIPTION_CANCELED", module: AUDIT_MODULE.SYSADMIN, resourceType: "Subscription", resourceId: sub.id, dojoId: sub.dojoId });
      }
    }

    if (topic === "payment") {
      const payment = await getMPPayment(resourceId);
      // Find subscription by preapproval_id
      const preapprovalId = payment.preapproval_id;
      const sub = preapprovalId
        ? await prisma.subscription.findFirst({ where: { mpSubscriptionId: preapprovalId } })
        : null;

      if (!sub) return NextResponse.json({ ok: true });

      if (payment.status === "approved") {
        const gatewayInvoiceId = String(payment.id);
        const already = await prisma.invoice.findFirst({
          where: { gatewayInvoiceId, gateway: PaymentGateway.MERCADOPAGO },
          select: { id: true },
        });
        if (!already) {
          await prisma.invoice.create({
            data: {
              subscriptionId:   sub.id,
              dojoId:           sub.dojoId,
              amount:           payment.transaction_amount ?? 0,
              currency:         "USD",
              status:           InvoiceStatus.PAID,
              gateway:          PaymentGateway.MERCADOPAGO,
              gatewayInvoiceId,
              paidAt:           new Date(),
            },
          });
          await logAudit({ action: "INVOICE_PAID", module: AUDIT_MODULE.SYSADMIN, resourceType: "Invoice", dojoId: sub.dojoId });
        }
      } else if (payment.status === "rejected") {
        await prisma.invoice.create({
          data: {
            subscriptionId: sub.id,
            dojoId:         sub.dojoId,
            amount:         payment.transaction_amount ?? 0,
            status:         InvoiceStatus.FAILED,
            gateway:        PaymentGateway.MERCADOPAGO,
          },
        });
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: SubscriptionStatus.PAST_DUE } });
        await logAudit({ action: "INVOICE_FAILED", module: AUDIT_MODULE.SYSADMIN, resourceType: "Invoice", dojoId: sub.dojoId });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mp-webhook] error:", err);
    return NextResponse.json({ ok: true }); // Always 200
  }
}
