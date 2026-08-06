/**
 * GET /api/public/realtime-status
 * Chequeo liviano para que el cliente sepa si vale la pena abrir el
 * EventSource de tiempo real, o si debe quedarse solo con polling.
 */
import { NextResponse } from "next/server";
import { isAblyEnabled } from "@/lib/ably-server";

export async function GET() {
  return NextResponse.json(
    { enabled: isAblyEnabled() },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
