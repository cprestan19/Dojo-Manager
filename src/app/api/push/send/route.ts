import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { sendPushToSubscriptions, logPushSent } from "@/lib/push";

type SessionUser = { role?: string; dojoId?: string | null; id?: string };

// Rate limit: máx 5 envíos manuales por dojo en la última hora
const RATE_LIMIT    = 5;
const RATE_WINDOW   = 60 * 60 * 1000; // 1 hora en ms

// POST /api/push/send — envío manual a alumnos del dojo
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

    // Rate limiting por dojo
    const windowStart = new Date(Date.now() - RATE_WINDOW);
    const recentCount = await prisma.pushNotificationLog.count({
      where: { dojoId, type: "manual", sentAt: { gte: windowStart } },
    });
    if (recentCount >= RATE_LIMIT) {
      return NextResponse.json({
        error: `Límite alcanzado. Máximo ${RATE_LIMIT} envíos manuales por hora.`,
      }, { status: 429 });
    }

    const body = await req.json() as {
      title?:   string;
      message?: string;
      url?:     string;
    };

    const title   = body.title?.trim();
    const message = body.message?.trim();
    if (!title)   return NextResponse.json({ error: "Título requerido" },  { status: 400 });
    if (!message) return NextResponse.json({ error: "Mensaje requerido" }, { status: 400 });
    if (title.length   > 80)  return NextResponse.json({ error: "Título demasiado largo (máx 80 car.)"   }, { status: 400 });
    if (message.length > 300) return NextResponse.json({ error: "Mensaje demasiado largo (máx 300 car.)" }, { status: 400 });

    const subs = await prisma.pushSubscription.findMany({
      where:  { dojoId, active: true, studentId: { not: null } },
      select: { endpoint: true, p256dh: true, auth: true },
    });

    if (subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: "No hay dispositivos suscritos." });
    }

    const result = await sendPushToSubscriptions(subs, {
      title,
      body: message,
      url:  body.url || "/portal",
      tag:  "manual-dojo",
    });

    await logPushSent({
      dojoId,
      type:   "manual",
      title,
      body:   message,
      url:    body.url || "/portal",
      result,
      sentBy: user.id,
    });

    return NextResponse.json({
      ok:      true,
      sent:    result.success,
      failed:  result.failed,
      total:   subs.length,
    });
  } catch (err) {
    console.error("POST /api/push/send", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
