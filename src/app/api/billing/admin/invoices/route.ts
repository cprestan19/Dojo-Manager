import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { InvoiceStatus, PaymentGateway } from "@prisma/client";

type SessionUser = { role?: string };

// GET /api/billing/admin/invoices
// All invoices with full dojo + subscription context for claims/disputes.
// Query: ?dojoId=  ?status=PAID|FAILED|PENDING  ?gateway=PAYPAL|MERCADOPAGO
//        ?page=1   ?limit=50
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role } = session.user as SessionUser;
    if (role !== "sysadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const sp      = req.nextUrl.searchParams;
    const dojoId  = sp.get("dojoId")  ?? undefined;
    const status  = sp.get("status")  ?? undefined;
    const gateway = sp.get("gateway") ?? undefined;
    const page    = Math.max(1, parseInt(sp.get("page")  ?? "1"));
    const limit   = Math.min(100, parseInt(sp.get("limit") ?? "50"));
    const skip    = (page - 1) * limit;

    // Validate enum values to satisfy Prisma's strict typing
    const validStatus  = status  && Object.values(InvoiceStatus).includes(status as InvoiceStatus)
      ? (status as InvoiceStatus)
      : undefined;
    const validGateway = gateway && Object.values(PaymentGateway).includes(gateway as PaymentGateway)
      ? (gateway as PaymentGateway)
      : undefined;

    const where = {
      ...(dojoId        ? { dojoId }              : {}),
      ...(validStatus   ? { status:  validStatus  } : {}),
      ...(validGateway  ? { gateway: validGateway } : {}),
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id:               true,
          amount:           true,
          currency:         true,
          status:           true,
          gateway:          true,
          gatewayInvoiceId: true,
          paidAt:           true,
          createdAt:        true,
          subscriptionId:   true,
          dojoId:           true,
          subscription: {
            select: {
              status:               true,
              cycle:                true,
              paypalSubscriptionId: true,
              mpSubscriptionId:     true,
              dojo: {
                select: {
                  name:      true,
                  slug:      true,
                  ownerName: true,
                  email:     true,
                },
              },
            },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    const rows = invoices.map(inv => ({
      id:               inv.id,
      amount:           inv.amount,
      currency:         inv.currency,
      status:           inv.status,
      gateway:          inv.gateway,
      gatewayInvoiceId: inv.gatewayInvoiceId,
      paidAt:           inv.paidAt,
      createdAt:        inv.createdAt,
      subscriptionId:   inv.subscriptionId,
      subStatus:        inv.subscription.status,
      subCycle:         inv.subscription.cycle,
      paypalSubscriptionId: inv.subscription.paypalSubscriptionId,
      mpSubscriptionId:     inv.subscription.mpSubscriptionId,
      dojoId:    inv.dojoId,
      dojoName:  inv.subscription.dojo.name,
      dojoSlug:  inv.subscription.dojo.slug,
      senseiName: inv.subscription.dojo.ownerName,
      dojoEmail: inv.subscription.dojo.email,
    }));

    return NextResponse.json({ invoices: rows, total, page, limit });
  } catch (err) {
    console.error("GET /api/billing/admin/invoices error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
