import { NextRequest, NextResponse } from "next/server";
import { checkExpiredTrials } from "@/lib/billing/subscription";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const expected   = `Bearer ${process.env.CRON_SECRET ?? ""}`;

    if (!process.env.CRON_SECRET || authHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const count = await checkExpiredTrials();
    return NextResponse.json({ updated: count, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[cron/trial-expiry] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
