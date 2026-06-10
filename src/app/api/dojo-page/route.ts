import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { withPaidPlanGuard } from "@/lib/billing/featureGuard";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const page = await prisma.dojoPage.findUnique({ where: { dojoId } });
  return NextResponse.json(page ?? null);
}

export const PUT = withPaidPlanGuard(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  try {
    const page = await prisma.dojoPage.upsert({
      where:  { dojoId },
      create: {
        dojoId,
        published:     body.published     ?? false,
        heroTitle:     body.heroTitle     || null,
        heroSubtitle:  body.heroSubtitle  || null,
        heroImage:     body.heroImage     || null,
        aboutText:     body.aboutText     || null,
        aboutImage:    body.aboutImage    || null,
        primaryColor:  body.primaryColor  || "#C0392B",
        showFreeTrial: body.showFreeTrial ?? true,
        showSchedules: body.showSchedules ?? true,
        showContact:   body.showContact   ?? true,
        showStore:     body.showStore     ?? false,
        address:       body.address       || null,
        galleryImages: Array.isArray(body.galleryImages) ? body.galleryImages : [],
        stats:         Array.isArray(body.stats)         ? body.stats         : [],
        testimonials:  Array.isArray(body.testimonials)  ? body.testimonials  : [],
        sensei:        body.sensei ?? null,
      },
      update: {
        ...(body.published     !== undefined && { published:     body.published }),
        ...(body.heroTitle     !== undefined && { heroTitle:     body.heroTitle     || null }),
        ...(body.heroSubtitle  !== undefined && { heroSubtitle:  body.heroSubtitle  || null }),
        ...(body.heroImage     !== undefined && { heroImage:     body.heroImage     || null }),
        ...(body.aboutText     !== undefined && { aboutText:     body.aboutText     || null }),
        ...(body.aboutImage    !== undefined && { aboutImage:    body.aboutImage    || null }),
        ...(body.primaryColor  !== undefined && { primaryColor:  body.primaryColor  || "#C0392B" }),
        ...(body.showFreeTrial !== undefined && { showFreeTrial: body.showFreeTrial }),
        ...(body.showSchedules !== undefined && { showSchedules: body.showSchedules }),
        ...(body.showContact   !== undefined && { showContact:   body.showContact   }),
        ...(body.showStore     !== undefined && { showStore:     body.showStore     }),
        ...(body.address       !== undefined && { address:       body.address       || null }),
        ...(body.galleryImages !== undefined && { galleryImages: Array.isArray(body.galleryImages) ? body.galleryImages : [] }),
        ...(body.stats         !== undefined && { stats:         Array.isArray(body.stats)         ? body.stats         : [] }),
        ...(body.testimonials  !== undefined && { testimonials:  Array.isArray(body.testimonials)  ? body.testimonials  : [] }),
        ...(body.sensei        !== undefined && { sensei:        body.sensei || null }),
      },
    });
    return NextResponse.json(page);
  } catch (err) {
    console.error("[dojo-page] PUT error:", err);
    return NextResponse.json({ error: "Error al guardar la página. Reinicia el servidor e intenta de nuevo." }, { status: 500 });
  }
});
