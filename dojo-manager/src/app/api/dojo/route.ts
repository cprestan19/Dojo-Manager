/**
 * API: Configuración del dojo actual
 * Desarrollado por Cristhian Paul Prestán — 2025
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/queries";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);

  // sysadmin puede consultar cualquier dojo vía ?id=
  const targetId = role === "sysadmin"
    ? (new URL(req.url).searchParams.get("id") ?? null)
    : dojoId;

  if (!targetId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  // ?logo=1 incluye el campo logo (base64 pesado). Por defecto se excluye
  // para que el sidebar y otros consumidores no descarguen cientos de KB innecesariamente.
  const qp          = new URL(req.url).searchParams;
  const includeLogo  = qp.get("logo") === "1";

  const dojo = await prisma.dojo.findUnique({
    where: { id: targetId },
    select: {
      id: true, name: true, slug: true, ownerName: true,
      email: true, phone: true, slogan: true, active: true,
      createdAt: true, updatedAt: true,
      reminderToleranceDays: true, lateInterestPct: true,
      autoRemindersEnabled: true,
      logo:          includeLogo,
      loginBgImage:  includeLogo,
    },
  });
  if (!dojo) return NextResponse.json({ error: "Dojo no encontrado" }, { status: 404 });

  // Sanitize: never return base64 images — only Cloudinary URLs
  return NextResponse.json({
    ...dojo,
    logo:         dojo.logo         ? (dojo.logo.startsWith("http")         ? dojo.logo         : null) : null,
    loginBgImage: dojo.loginBgImage ? (dojo.loginBgImage.startsWith("http") ? dojo.loginBgImage : null) : null,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const targetId = role === "sysadmin"
    ? (searchParams.get("id") ?? dojoId)
    : dojoId;

  if (!targetId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const body = await req.json();

  const dojo = await prisma.dojo.update({
    where: { id: targetId },
    data: {
      name:      body.name,
      email:     body.email     ?? null,
      ownerName: body.ownerName ?? null,
      phone:     body.phone    ?? null,
      slogan:    body.slogan   ?? null,
      logo:         body.logo         ?? null,
      loginBgImage: "loginBgImage" in body ? (body.loginBgImage ?? null) : undefined,
      reminderToleranceDays: body.reminderToleranceDays != null ? Number(body.reminderToleranceDays) : undefined,
      lateInterestPct:       body.lateInterestPct       != null ? Number(body.lateInterestPct)       : undefined,
      autoRemindersEnabled:  body.autoRemindersEnabled  != null ? Boolean(body.autoRemindersEnabled)  : undefined,
    },
  });

  revalidateTag(CACHE_TAGS.dojo(targetId));
  return NextResponse.json(dojo);
}
