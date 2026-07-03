import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string; dojoId?: string | null };

const USER_ACTIONS = [
  "USER_CREATED", "USER_UPDATED", "USER_DELETED",
  "USER_ACTIVATED", "USER_DEACTIVATED", "USER_PASSWORD_CHANGED", "PASSWORD_CHANGED",
  "LOGIN_SUCCESS", "LOGIN_FAILED", "LOGOUT",
];

const REGISTRO_ACTIONS = [
  "PENDING_STUDENT_SUBMITTED", "PENDING_STUDENT_APPROVED",
  "PENDING_STUDENT_REJECTED", "PENDING_STUDENT_DELETED",
  "REGISTRATION_LINK_CREATED", "REGISTRATION_LINK_UPDATED", "REGISTRATION_LINK_DELETED",
];

const TOURNAMENT_ACTIONS = [
  "TOURNAMENT_ARCHIVED", "TOURNAMENT_REACTIVATED", "TOURNAMENT_DELETED",
  "BRACKET_REOPENED", "BRACKET_DELETED",
];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role } = session.user as SessionUser;
  if (role !== "sysadmin")
    return NextResponse.json({ error: "Solo sysadmin puede acceder al log de auditoría" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const filter   = searchParams.get("filter") ?? "all";
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 50;
  const search   = searchParams.get("search")?.trim() ?? "";
  const dojoId   = searchParams.get("dojoId")   ?? "";
  const country  = searchParams.get("country")  ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo   = searchParams.get("dateTo")   ?? "";

  const where: Record<string, unknown> = {};

  if (dojoId)  where.dojoId  = dojoId;
  if (country) where.country = { equals: country.toUpperCase() };
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
    };
  }

  if (filter === "users") {
    where.action = { in: USER_ACTIONS };
  } else if (filter === "registros") {
    where.action = { in: REGISTRO_ACTIONS };
  } else if (filter === "tournaments") {
    where.action = { in: TOURNAMENT_ACTIONS };
  } else if (filter === "logins") {
    where.action = { in: ["LOGIN_SUCCESS", "LOGIN_FAILED", "LOGOUT"] };
  } else if (filter === "suspicious") {
    // Actividad sospechosa: logins fallidos, accesos no autorizados, rate limits, sysadmin proxy
    where.OR = [
      { action: "LOGIN_FAILED" },
      { statusCode: { in: [401, 403, 429] } },
      { isSysadminProxy: true },
    ];
  }

  if (search) {
    const searchWhere = [
      { userEmail:  { contains: search, mode: "insensitive" } },
      { userName:   { contains: search, mode: "insensitive" } },
      { action:     { contains: search, mode: "insensitive" } },
      { details:    { contains: search, mode: "insensitive" } },
      { ip:         { contains: search } },
      { targetEmail:{ contains: search, mode: "insensitive" } },
    ];
    // Merge search with existing OR/AND
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchWhere }];
      delete where.OR;
    } else {
      where.OR = searchWhere;
    }
  }

  try {
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        select: {
          id:             true,
          action:         true,
          module:         true,
          method:         true,
          resourceType:   true,
          resourceId:     true,
          statusCode:     true,
          userId:         true,
          userName:       true,
          userEmail:      true,
          isSysadminProxy:true,
          dojoId:         true,
          dojoSlug:       true,
          targetId:       true,
          targetEmail:    true,
          ip:             true,
          userAgent:      true,
          country:        true,
          city:           true,
          region:         true,
          sessionId:      true,
          duration:       true,
          details:        true,
          createdAt:      true,
        },
      }),
    ]);

    return NextResponse.json({ logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    console.error("GET /api/audit-logs error:", err);
    return NextResponse.json({ error: "Error interno al cargar logs" }, { status: 500 });
  }
}
