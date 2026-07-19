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

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  // Mark as read on fetch
  await prisma.freeTrialRequest.updateMany({
    where: { dojoId, read: false },
    data:  { read: true },
  });

  const leads = await prisma.freeTrialRequest.findMany({
    where: {
      dojoId,
      ...(status && status !== "all" ? { status } : {}),
    },
    include: {
      schedule: { select: { id: true, name: true, days: true, startTime: true, endTime: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(leads);
}

export const GET = withPlanFeatureGuard(NAV_KEYS.LEADS, _GET);
