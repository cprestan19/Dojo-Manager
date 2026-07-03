import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId } from "@/lib/sysadmin-context";

type SessionUser = {
  role?:      string;
  dojoId?:    string | null;
  studentId?: string | null;
  id?:        string;
};

// POST /api/push/subscribe — registra la suscripción push del dispositivo
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as SessionUser;
    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: "Sin contexto de dojo" }, { status: 403 });

    const body = await req.json() as {
      endpoint?:  string;
      p256dh?:    string;
      auth?:      string;
      deviceLabel?: string;
    };

    const { endpoint, p256dh, auth, deviceLabel } = body;
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") ?? null;

    // Determinar a quién pertenece la suscripción
    const isStudent = user.role === "student";
    const studentId = isStudent ? (user.studentId ?? null) : null;
    const userId    = !isStudent ? (user.id ?? null) : null;

    await prisma.pushSubscription.upsert({
      where:  { endpoint },
      create: {
        dojoId,
        studentId,
        userId,
        endpoint,
        p256dh,
        auth,
        deviceLabel: deviceLabel?.trim() || null,
        userAgent,
        active:    true,
        failCount: 0,
      },
      update: {
        dojoId,
        studentId,
        userId,
        p256dh,
        auth,
        deviceLabel: deviceLabel?.trim() || null,
        userAgent,
        active:    true,
        failCount: 0,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/push/subscribe", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
