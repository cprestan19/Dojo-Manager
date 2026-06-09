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
    if (role !== "admin" && role !== "sysadmin")
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const page  = Math.max(1, parseInt(req.nextUrl.searchParams.get("page")  ?? "1"));
    const limit = Math.min(50, parseInt(req.nextUrl.searchParams.get("limit") ?? "10"));
    const skip  = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where:   { dojoId },
        orderBy: { createdAt: "desc" },
        skip,
        take:    limit,
      }),
      prisma.invoice.count({ where: { dojoId } }),
    ]);

    return NextResponse.json({ invoices, total, page, limit });
  } catch (err) {
    console.error("GET /api/billing/invoices error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
