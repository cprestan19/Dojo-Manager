import { NextRequest, NextResponse } from "next/server";
import { runPagueloFacilRenewal } from "@/lib/billing/paguelofacilRenewal";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const expected   = `Bearer ${process.env.CRON_SECRET ?? ""}`;

    if (!process.env.CRON_SECRET || authHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runPagueloFacilRenewal();
    return NextResponse.json({ ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[cron/paguelofacil-renewal] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
