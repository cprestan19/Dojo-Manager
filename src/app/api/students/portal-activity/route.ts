/**
 * GET /api/students/portal-activity
 * Devuelve actividad del portal de alumnos: quién tiene acceso, cuándo
 * entraron por última vez, cuántas veces han ingresado.
 * Solo lee — no modifica ningún dato existente.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  // 1. Todos los alumnos del dojo con su usuario portal
  const students = await prisma.student.findMany({
    where:   { dojoId, active: true },
    select: {
      id: true, fullName: true, studentCode: true, photo: true,
      beltHistory: { orderBy: { changeDate: "desc" }, take: 1, select: { beltColor: true } },
      portalUser:  { select: { id: true, email: true, active: true } },
    },
    orderBy: { fullName: "asc" },
  });

  // 2. Recopilar IDs de usuarios portal para buscar sus logins en audit_log
  const portalUserIds = students
    .map(s => s.portalUser?.id)
    .filter(Boolean) as string[];

  // 3. Último login por userId (una sola query, sin N+1)
  const lastLogins = portalUserIds.length > 0
    ? await prisma.auditLog.findMany({
        where:   { action: "LOGIN_SUCCESS", userId: { in: portalUserIds } },
        select:  { userId: true, createdAt: true, ip: true, country: true, city: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // 4. Agrupar por userId: último login y conteo
  const loginMap: Record<string, { lastLogin: string; count: number; ip: string | null; country: string | null; city: string | null }> = {};
  for (const log of lastLogins) {
    if (!log.userId) continue;
    if (!loginMap[log.userId]) {
      loginMap[log.userId] = {
        lastLogin: log.createdAt.toISOString(),
        count:     1,
        ip:        log.ip,
        country:   log.country,
        city:      log.city,
      };
    } else {
      loginMap[log.userId].count++;
    }
  }

  // 5. Combinar
  const result = students.map(s => {
    const pUser   = s.portalUser;
    const activity = pUser ? loginMap[pUser.id] : null;
    return {
      studentId:    s.id,
      fullName:     s.fullName,
      studentCode:  s.studentCode,
      photo:        s.photo?.startsWith("http") ? s.photo : null,
      belt:         s.beltHistory[0]?.beltColor ?? null,
      // Portal
      portalActive: pUser?.active ?? false,
      portalEmail:  pUser?.email  ?? null,
      hasAccess:    !!pUser?.active,
      // Actividad
      lastLogin:    activity?.lastLogin ?? null,
      loginCount:   activity?.count    ?? 0,
      lastIp:       activity?.ip       ?? null,
      lastCountry:  activity?.country  ?? null,
      lastCity:     activity?.city     ?? null,
    };
  });

  // Resumen
  const total     = result.length;
  const withAccess = result.filter(r => r.hasAccess).length;
  const hasLogged  = result.filter(r => r.loginCount > 0).length;
  const neverLogged = result.filter(r => r.hasAccess && r.loginCount === 0).length;

  return NextResponse.json({ total, withAccess, hasLogged, neverLogged, students: result });
}
