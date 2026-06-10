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
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);

  // sysadmin puede consultar cualquier dojo vía ?id= o por cookie sx-dojo (contexto activo)
  const targetId = role === "sysadmin"
    ? (new URL(req.url).searchParams.get("id") ?? getEffectiveDojoId(role, sessionDojoId, req))
    : dojoId;

  if (!targetId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const qp = new URL(req.url).searchParams;
  // ?logo=1 → incluye loginBgImage (base64, solo para Settings).
  // Por defecto se incluye `logo` (URL corta de Cloudinary, seguro) pero NO loginBgImage.
  const includeLoginBg = qp.get("logo") === "1";

  const dojo = await prisma.dojo.findUnique({
    where: { id: targetId },
    select: {
      id: true, name: true, slug: true, ownerName: true,
      email: true, phone: true, slogan: true, active: true,
      locale: true, tournamentPro: true,
      createdAt: true, updatedAt: true,
      reminderToleranceDays: true, lateInterestPct: true,
      autoRemindersEnabled: true,
      cardPrimaryColor: true, cardSecondaryColor: true, cardTertiaryColor: true,
      logo:         true,              // siempre — es URL corta de Cloudinary
      loginBgImage: includeLoginBg,    // solo cuando Settings lo pide
    },
  });
  if (!dojo) return NextResponse.json({ error: "Dojo no encontrado" }, { status: 404 });

  // Sanitize: never return base64 — only Cloudinary URLs
  return NextResponse.json(
    {
      ...dojo,
      logo:         dojo.logo         ? (dojo.logo.startsWith("http")         ? dojo.logo         : null) : null,
      loginBgImage: dojo.loginBgImage ? (dojo.loginBgImage.startsWith("http") ? dojo.loginBgImage : null) : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
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

  if (body.name !== undefined && !String(body.name ?? "").trim()) {
    return NextResponse.json({ error: "El nombre del dojo no puede estar vacío" }, { status: 400 });
  }

  const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
  for (const key of ["cardPrimaryColor", "cardSecondaryColor", "cardTertiaryColor"] as const) {
    if (body[key] != null && !HEX_COLOR_RE.test(body[key])) {
      return NextResponse.json({ error: `${key} debe ser un color hexadecimal válido (#RRGGBB)` }, { status: 400 });
    }
  }

  const t0   = Date.now();
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
      locale:                body.locale === "en" ? "en" : body.locale === "es" ? "es" : undefined,
      cardPrimaryColor:   "cardPrimaryColor"   in body ? (body.cardPrimaryColor   ?? null) : undefined,
      cardSecondaryColor: "cardSecondaryColor" in body ? (body.cardSecondaryColor ?? null) : undefined,
      cardTertiaryColor:  "cardTertiaryColor"  in body ? (body.cardTertiaryColor  ?? null) : undefined,
    },
    select: {
      id: true, name: true, slug: true, ownerName: true,
      email: true, phone: true, slogan: true, active: true,
      locale: true, tournamentPro: true,
      reminderToleranceDays: true, lateInterestPct: true,
      autoRemindersEnabled: true, logo: true,
      cardPrimaryColor: true, cardSecondaryColor: true, cardTertiaryColor: true,
    },
  });

  revalidateTag(CACHE_TAGS.dojo(targetId));

  const ctx = buildAuditCtx(session, req, { startTime: t0, dojoId: targetId });
  await logAudit({
    ...ctx,
    action:       "DOJO_SETTINGS_UPDATED",
    module:       AUDIT_MODULE.SETTINGS,
    resourceType: "Dojo",
    resourceId:   targetId,
    statusCode:   200,
    details:      JSON.stringify({
      changed: Object.keys(body).filter(k => k !== "logo" && k !== "loginBgImage"),
    }),
  });

  return NextResponse.json({
    ...dojo,
    logo: dojo.logo?.startsWith("http") ? dojo.logo : null,
  });
}
