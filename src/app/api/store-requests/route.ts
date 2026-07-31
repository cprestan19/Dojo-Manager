import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { withPlanFeatureGuard } from "@/lib/billing/planFeatureGuard";
import { NAV_KEYS } from "@/lib/permissions";

type SessionUser = { role?: string; dojoId?: string | null };

async function _GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const requests = await prisma.storePurchaseRequest.findMany({
    where:   { dojoId },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { name: true, price: true, currency: true, imageUrl: true } },
      student: { select: { fullName: true, studentCode: true, motherPhone: true, fatherPhone: true } },
    },
  });

  return NextResponse.json(requests);
}

export const GET = withPlanFeatureGuard(NAV_KEYS.STORE, _GET);
