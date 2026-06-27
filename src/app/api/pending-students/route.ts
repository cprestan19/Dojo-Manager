import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

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
    const statusFilter = searchParams.get("status");
    const countOnly    = searchParams.get("count") === "1";

    if (countOnly) {
      const total = await prisma.pendingStudent.count({
        where: { dojoId, status: "pending" },
      });
      return NextResponse.json({ total });
    }

    const pending = await prisma.pendingStudent.findMany({
      where: {
        dojoId,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: {
        registrationLink: { select: { label: true, token: true } },
      },
      orderBy: { submittedAt: "desc" },
    });

    return NextResponse.json(pending);
  } catch (err) {
    console.error("GET /api/pending-students error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
