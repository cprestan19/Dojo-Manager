import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { sendPushToSubscriptions } from "@/lib/push";

type SessionUser = { role?: string; dojoId?: string | null; id?: string };

// POST /api/push/test — envía push de prueba al dispositivo actual del admin
//   body: { endpoint } → prueba el dispositivo propio
//   body: { email }    → prueba todos los dispositivos del usuario con ese correo
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user   = session.user as SessionUser;
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const body = await req.json() as { endpoint?: string; email?: string };

    // --- Prueba por correo ---
    if (body.email) {
      const targetUser = await prisma.user.findFirst({
        where:  { email: body.email.toLowerCase().trim(), dojoId },
        select: { id: true, name: true, role: true, studentId: true },
      });
      if (!targetUser) {
        return NextResponse.json({ error: "No se encontró usuario con ese correo en este dojo" }, { status: 404 });
      }

      const subs = targetUser.role === "student" && targetUser.studentId
        ? await prisma.pushSubscription.findMany({
            where:  { studentId: targetUser.studentId, dojoId, active: true },
            select: { endpoint: true, p256dh: true, auth: true },
          })
        : await prisma.pushSubscription.findMany({
            where:  { userId: targetUser.id, dojoId, active: true },
            select: { endpoint: true, p256dh: true, auth: true },
          });

      if (subs.length === 0) {
        return NextResponse.json({ ok: false, name: targetUser.name, sent: 0, total: 0 });
      }

      const result = await sendPushToSubscriptions(subs, {
        title: "🥋 Prueba — Dojo Master",
        body:  "Las notificaciones push están funcionando correctamente.",
        url:   "/portal",
        tag:   "test-push",
      });

      return NextResponse.json({ ok: result.success > 0, name: targetUser.name, sent: result.success, total: subs.length });
    }

    // --- Prueba por endpoint (dispositivo propio) ---
    if (!body.endpoint) {
      return NextResponse.json({ error: "endpoint o email requerido" }, { status: 400 });
    }

    const sub = await prisma.pushSubscription.findUnique({
      where:  { endpoint: body.endpoint },
      select: { endpoint: true, p256dh: true, auth: true, dojoId: true },
    });

    if (!sub || sub.dojoId !== dojoId) {
      return NextResponse.json({ error: "Suscripción no encontrada" }, { status: 404 });
    }

    const result = await sendPushToSubscriptions([sub], {
      title: "🥋 Prueba — Dojo Master",
      body:  "Las notificaciones push están funcionando correctamente.",
      url:   "/dashboard/settings/push",
      tag:   "test-push",
    });

    return NextResponse.json({ ok: result.success > 0 });
  } catch (err) {
    console.error("POST /api/push/test", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
