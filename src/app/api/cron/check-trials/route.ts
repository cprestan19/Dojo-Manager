import { NextRequest, NextResponse } from "next/server";
import { checkExpiredTrials } from "@/lib/billing/subscription";

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("x-cron-secret")
      ?? req.nextUrl.searchParams.get("secret");

    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const count = await checkExpiredTrials();
    return NextResponse.json({ ok: true, expired: count });
  } catch (err) {
    console.error("[cron/check-trials] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
