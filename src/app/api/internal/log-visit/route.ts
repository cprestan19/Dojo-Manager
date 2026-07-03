import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST /api/internal/log-visit
// Called non-blocking from middleware on public page visits.
// No auth required — rate limited in middleware (30/min per IP).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.path !== "string") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const { path, ip, country, countryCode, city, region, lat, lng, referer, userAgent } = body as {
      path:        string;
      ip:          string | null;
      country:     string | null;
      countryCode: string | null;
      city:        string | null;
      region:      string | null;
      lat:         string | null;
      lng:         string | null;
      referer:     string | null;
      userAgent:   string | null;
    };

    await prisma.visitorLog.create({
      data: {
        ip:          ip          ?? "unknown",
        country:     country     ?? null,
        countryCode: countryCode ?? null,
        city:        city        ?? null,
        region:      region      ?? null,
        lat:         lat         ?? null,
        lng:         lng         ?? null,
        path:        path.slice(0, 500),
        userAgent:   userAgent   ?? null,
        referer:     referer     ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[log-visit]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
