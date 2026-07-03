import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { VAPID_PUBLIC_KEY } from "@/lib/push";

// GET /api/push/status?endpoint=xxx — verifica si este dispositivo está suscrito
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ subscribed: false });

    const endpoint = new URL(req.url).searchParams.get("endpoint");
    if (!endpoint) {
      return NextResponse.json({ subscribed: false, vapidPublicKey: VAPID_PUBLIC_KEY });
    }

    const sub = await prisma.pushSubscription.findUnique({
      where:  { endpoint },
      select: { id: true, active: true },
    });

    return NextResponse.json({
      subscribed:    !!sub?.active,
      vapidPublicKey: VAPID_PUBLIC_KEY,
    });
  } catch {
    return NextResponse.json({ subscribed: false });
  }
}
