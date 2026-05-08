import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const requests = await prisma.freeTrialRequest.findMany({
    where:   { dojoId, ...(status ? { status } : {}) },
    include: { schedule: { select: { id: true, name: true, startTime: true, endTime: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Count unread
  const unread = requests.filter(r => !r.read).length;

  return NextResponse.json({ requests, unread });
}
