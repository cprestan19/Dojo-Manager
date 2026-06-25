import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const user = session.user as { id?: string; dojoId?: string | null };

  try {
    const body = await req.json();
    const event   = typeof body.event === "string" ? body.event.slice(0, 50) : "UNKNOWN";
    const message = typeof body.message === "string" ? body.message.slice(0, 200) : "";
    const context = typeof body.context === "string" ? body.context.slice(0, 200) : "";

    await logAudit({
      action:       `SCANNER_${event}`,
      module:       AUDIT_MODULE.ATTENDANCE,
      method:       "POST",
      userId:       user.id,
      dojoId:       user.dojoId ?? undefined,
      ip:           req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent:    req.headers.get("user-agent"),
      statusCode:   200,
      details:      JSON.stringify({ event, message, context }),
    });
  } catch { /* never fail the scanner flow */ }

  return NextResponse.json({ ok: true });
}
