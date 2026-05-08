/**
 * Public endpoint — returns dojo + page data for the public website.
 * No authentication required. Only published dojos are returned.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
        select:  { id: true, name: true, days: true, startTime: true, endTime: true, description: true },
        orderBy: { name: "asc" },
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
