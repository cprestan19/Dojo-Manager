import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

const REGISTRATION_ACTIONS = [
  "REGISTRATION_FORM_VIEWED",
  "REGISTRATION_LINK_BLOCKED",
  "REGISTRATION_DUPLICATE_BLOCKED",
  "PENDING_STUDENT_SUBMITTED",
  "REGISTRATION_LINK_CREATED",
  "PENDING_STUDENT_APPROVED",
  "PENDING_STUDENT_REJECTED",
];

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit   = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);
    const linkId  = searchParams.get("linkId");

    const events = await prisma.auditLog.findMany({
      where: {
        dojoId,
        action:     { in: REGISTRATION_ACTIONS },
        ...(linkId ? { resourceId: linkId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take:    limit,
      select: {
        id: true, action: true, createdAt: true, ip: true,
        resourceId: true, details: true, userAgent: true,
      },
    });

    return NextResponse.json(events);
  } catch (err) {
    console.error("GET /api/registration-links/activity error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
