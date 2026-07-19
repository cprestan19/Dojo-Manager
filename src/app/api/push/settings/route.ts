import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { withPlanFeatureGuard } from "@/lib/billing/planFeatureGuard";
import { NAV_KEYS } from "@/lib/permissions";

type SessionUser = { role?: string; dojoId?: string | null };

// GET /api/push/settings — configuración de notificaciones push del dojo
async function _GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user   = session.user as SessionUser;
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const [settings, subscriberCount, recentLogs] = await Promise.all([
      prisma.pushSettings.findUnique({ where: { dojoId } }),
      prisma.pushSubscription.count({ where: { dojoId, active: true } }),
      prisma.pushNotificationLog.findMany({
        where:   { dojoId },
        orderBy: { sentAt: "desc" },
        take:    20,
        select:  { id: true, type: true, title: true, body: true, url: true, targetCount: true, successCount: true, failCount: true, sentBy: true, sentAt: true },
      }),
    ]);

    const defaults = {
      enabled:               true,
      notifyAttendance:      true,
      notifyPaymentReminder: true,
      notifyNewVideo:        true,
      notifyNewEvent:        true,
      notifyBirthday:        true,
      notifyExamPublished:   true,
      notifyExamResult:      true,
      notifyExamDeadline:    true,
    };

    return NextResponse.json({
      settings:        settings ?? defaults,
      subscriberCount,
      logs:            recentLogs,
    });
  } catch (err) {
    console.error("GET /api/push/settings", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PUT /api/push/settings — actualiza configuración
async function _PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user   = session.user as SessionUser;
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const body = await req.json() as {
      enabled?:               boolean;
      notifyAttendance?:      boolean;
      notifyPaymentReminder?: boolean;
      notifyNewVideo?:        boolean;
      notifyNewEvent?:        boolean;
      notifyBirthday?:        boolean;
      notifyExamPublished?:   boolean;
      notifyExamResult?:      boolean;
      notifyExamDeadline?:    boolean;
    };

    const data = {
      enabled:               body.enabled               ?? true,
      notifyAttendance:      body.notifyAttendance      ?? true,
      notifyPaymentReminder: body.notifyPaymentReminder ?? true,
      notifyNewVideo:        body.notifyNewVideo        ?? true,
      notifyNewEvent:        body.notifyNewEvent        ?? true,
      notifyBirthday:        body.notifyBirthday        ?? true,
      notifyExamPublished:   body.notifyExamPublished   ?? true,
      notifyExamResult:      body.notifyExamResult      ?? true,
      notifyExamDeadline:    body.notifyExamDeadline    ?? true,
    };

    const settings = await prisma.pushSettings.upsert({
      where:  { dojoId },
      create: { dojoId, ...data },
      update: data,
    });

    return NextResponse.json(settings);
  } catch (err) {
    console.error("PUT /api/push/settings", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export const GET = withPlanFeatureGuard(NAV_KEYS.SETTINGS_PUSH, _GET);
export const PUT = withPlanFeatureGuard(NAV_KEYS.SETTINGS_PUSH, _PUT);
