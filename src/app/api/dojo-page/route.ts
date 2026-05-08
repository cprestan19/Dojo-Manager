import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const page = await prisma.dojoPage.findUnique({ where: { dojoId } });
  return NextResponse.json(page ?? {
    published: false, heroTitle: null, heroSubtitle: null,
    aboutText: null, aboutImage: null, primaryColor: "#C0392B", showFreeTrial: true,
  });
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "sysadmin" && role !== "admin")
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const body = await req.json();

    const page = await prisma.dojoPage.upsert({
      where:  { dojoId },
      create: { dojoId, ...sanitize(body) },
      update: sanitize(body),
    });

    return NextResponse.json(page);
  } catch (err) {
    console.error("[dojo-page] PUT error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

function sanitize(b: Record<string, unknown>) {
  return {
    published:     typeof b.published    === "boolean"  ? b.published    : undefined,
    heroTitle:     typeof b.heroTitle    === "string"   ? b.heroTitle.trim()    || null : undefined,
    heroSubtitle:  typeof b.heroSubtitle === "string"   ? b.heroSubtitle.trim() || null : undefined,
    aboutText:     typeof b.aboutText    === "string"   ? b.aboutText.trim()    || null : undefined,
    aboutImage:    typeof b.aboutImage   === "string" && b.aboutImage.startsWith("http") ? b.aboutImage : null,
    primaryColor:  typeof b.primaryColor === "string"   ? b.primaryColor : undefined,
    showFreeTrial: typeof b.showFreeTrial === "boolean" ? b.showFreeTrial : undefined,
  };
}
