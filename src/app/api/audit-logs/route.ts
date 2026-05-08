import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string; dojoId?: string | null };

// Acciones relacionadas con usuarios (para filtro rápido)
const USER_ACTIONS = [
  "USER_CREATED", "USER_UPDATED", "USER_DELETED",
  "USER_ACTIVATED", "USER_DEACTIVATED", "USER_PASSWORD_CHANGED",
  "PASSWORD_CHANGED", "LOGIN_SUCCESS", "LOGIN_FAILED",
];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role } = session.user as SessionUser;
  // Solo sysadmin puede ver el audit log global
  if (role !== "sysadmin")
    return NextResponse.json({ error: "Solo sysadmin puede acceder al log de auditoría" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const filter   = searchParams.get("filter") ?? "all";   // all | users | tournaments | logins
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 50;
  const search   = searchParams.get("search") ?? "";

  const where: Record<string, unknown> = {};

  if (filter === "users") {
    where.action = { in: USER_ACTIONS };
  } else if (filter === "tournaments") {
    where.action = { in: [
      "TOURNAMENT_ARCHIVED", "TOURNAMENT_REACTIVATED", "TOURNAMENT_DELETED",
      "BRACKET_REOPENED", "BRACKET_DELETED",
    ]};
  } else if (filter === "logins") {
    where.action = { in: ["LOGIN_SUCCESS", "LOGIN_FAILED"] };
  }

  if (search.trim()) {
    where.OR = [
      { userEmail: { contains: search, mode: "insensitive" } },
      { action:    { contains: search, mode: "insensitive" } },
      { details:   { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
    ]);

    return NextResponse.json({ logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    console.error("GET /api/audit-logs error:", err);
    return NextResponse.json({ error: "Error interno al cargar logs" }, { status: 500 });
  }
}
