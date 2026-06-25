/**
 * Public endpoint — returns dojo + page data for the public website.
 * No authentication required. Only published dojos are returned.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug requerido" }, { status: 400 });

  const dojo = await prisma.dojo.findUnique({
    where:  { slug, active: true },
    select: {
      id: true, name: true, slug: true, slogan: true,
      phone: true, email: true, instagramUrl: true,
      logo: true,
      schedules: {
        where:   { active: true },
        select:  { id: true, name: true, days: true, startTime: true, endTime: true, description: true, availableForTrial: true },
        orderBy: { name: "asc" },
      },
      organizations: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select:  { id: true, name: true, logoUrl: true },
      },
      dojoPage: {
        select: {
          published: true, heroTitle: true, heroSubtitle: true,
          aboutText: true, aboutImage: true,
          primaryColor: true, showFreeTrial: true,
        },
      },
    },
  });

  if (!dojo) return NextResponse.json({ error: "Dojo no encontrado" }, { status: 404 });
  if (!dojo.dojoPage?.published)
    return NextResponse.json({ error: "Página no publicada" }, { status: 404 });

  // Registrar visita — no bloqueante, no falla el request
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          ?? req.headers.get("x-real-ip")
          ?? req.headers.get("cf-connecting-ip")
          ?? "unknown";
  logAudit({
    action:       "PUBLIC_PAGE_VISITED",
    module:       AUDIT_MODULE.PORTAL,
    method:       "GET",
    resourceType: "Dojo",
    resourceId:   dojo.id,
    dojoId:       dojo.id,
    ip,
    userAgent:    req.headers.get("user-agent"),
    country:      req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? null,
    city:         req.headers.get("x-vercel-ip-city") ?? null,
    statusCode:   200,
  }).catch(() => {});

  // Sanitize logo — never return base64
  return NextResponse.json({
    ...dojo,
    logo: dojo.logo?.startsWith("http") ? dojo.logo : null,
    dojoPage: {
      ...dojo.dojoPage,
      aboutImage: dojo.dojoPage?.aboutImage?.startsWith("http") ? dojo.dojoPage.aboutImage : null,
    },
  });
}
