import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/billing/admin/access-email-logs
// ?dojoId=xxx  (opcional) — filtra por dojo
// ?page=1&limit=50
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const { role } = session.user as { role?: string };
    if (role !== "sysadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const dojoId = searchParams.get("dojoId") ?? undefined;
    const page   = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));
    const skip   = (page - 1) * limit;

    const where = dojoId ? { dojoId } : {};

    const [logs, total] = await Promise.all([
      prisma.specialAccessEmailLog.findMany({
        where,
        orderBy: { sentAt: "desc" },
        skip,
        take: limit,
        include: { dojo: { select: { name: true, slug: true } } },
      }),
      prisma.specialAccessEmailLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total });
  } catch (err) {
    console.error("GET /api/billing/admin/access-email-logs error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
