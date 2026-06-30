import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string };

// GET /api/billing/admin
// Returns all dojo subscriptions with plan + dojo info.
// Optional ?dojoId=xxx to get a single dojo.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role } = session.user as SessionUser;
    if (role !== "sysadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const dojoId = req.nextUrl.searchParams.get("dojoId");

    const subscriptions = await prisma.subscription.findMany({
      where: dojoId ? { dojoId } : undefined,
      include: {
        plan: {
          select: { id: true, name: true, monthlyPrice: true, annualPrice: true },
        },
        dojo: {
          select: {
            id:        true,
            name:      true,
            slug:      true,
            ownerName: true,
            email:     true,
            active:    true,
            createdAt: true,
          },
        },
        invoices: {
          select: { id: true, status: true, amount: true, currency: true, paidAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Dojos that have no subscription yet
    const subscribedDojoIds = new Set(subscriptions.map(s => s.dojoId));
    const unsubscribed = await prisma.dojo.findMany({
      where: {
        id:     { notIn: Array.from(subscribedDojoIds) },
        active: true,
      },
      select: {
        id: true, name: true, slug: true,
        ownerName: true, email: true, active: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Augment each subscription with computed stats
    const data = subscriptions.map(s => {
      const paidInvoices = s.invoices.filter(i => i.status === "PAID");
      const totalRevenue = paidInvoices.reduce((acc, i) => acc + i.amount, 0);
      const now          = new Date();
      const daysRemaining =
        s.status === "TRIAL" || s.status === "SPECIAL_ACCESS"
          ? Math.max(0, Math.ceil((s.trialEndsAt.getTime() - now.getTime()) / 86_400_000))
          : null;

      return {
        id:                   s.id,
        status:               s.status,
        cycle:                s.cycle,
        gateway:              s.gateway,
        paypalSubscriptionId: s.paypalSubscriptionId,
        mpSubscriptionId:     s.mpSubscriptionId,
        trialEndsAt:          s.trialEndsAt,
        currentPeriodStart:   s.currentPeriodStart,
        currentPeriodEnd:     s.currentPeriodEnd,
        cancelAtPeriodEnd:    s.cancelAtPeriodEnd,
        createdAt:            s.createdAt,
        updatedAt:            s.updatedAt,
        grantedBy:            s.grantedBy,
        grantedAt:            s.grantedAt,
        grantNote:            s.grantNote,
        daysRemaining,
        invoiceCount:         s.invoices.length,
        paidCount:            paidInvoices.length,
        totalRevenue,
        plan: s.plan,
        dojo: s.dojo,
      };
    });

    return NextResponse.json({ subscriptions: data, unsubscribed });
  } catch (err) {
    console.error("GET /api/billing/admin error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
