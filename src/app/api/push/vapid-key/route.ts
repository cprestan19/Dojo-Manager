import { NextResponse } from "next/server";
import { VAPID_PUBLIC_KEY } from "@/lib/push";

// GET /api/push/vapid-key — clave pública VAPID (sin auth requerida)
export async function GET() {
  if (!VAPID_PUBLIC_KEY) {
    return NextResponse.json({ error: "Push no configurado" }, { status: 503 });
  }
  return NextResponse.json({ publicKey: VAPID_PUBLIC_KEY });
}
