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
import { deleteResource, extractCloudinaryPublicId } from "@/lib/cloudinary";
import { isOwnMediaUrl } from "@/lib/upload-validation";

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
  // ?logo=1 → incluye campos extendidos (base64/URLs largos, solo para Settings).
  const includeExtended = qp.get("logo") === "1";

  const dojo = await prisma.dojo.findUnique({
    where: { id: targetId },
    select: {
      id: true, name: true, slug: true, ownerName: true,
      email: true, phone: true, slogan: true, active: true,
      locale: true, tournamentPro: true, timezone: true, currency: true,
      createdAt: true, updatedAt: true,
      reminderToleranceDays: true, lateInterestPct: true,
      autoRemindersEnabled: true, lateToleranceMinutes: true,
      cardPrimaryColor: true, cardSecondaryColor: true, cardTertiaryColor: true,
      logo:             true,              // siempre — es URL corta de Cloudinary
      cardTemplateImage: includeExtended,    // solo cuando Settings lo pide
      cardLayout:        includeExtended,    // solo cuando card-template editor lo pide
      cardTemplateImage2: includeExtended,
      cardLayout2:        includeExtended,
      cardTemplateImage3: includeExtended,
      cardLayout3:        includeExtended,
      activeCardSlot:     true,             // siempre incluir el slot activo
      contractPolicy:   includeExtended,     // solo cuando Settings lo pide
    },
  });
  if (!dojo) return NextResponse.json({ error: "Dojo no encontrado" }, { status: 404 });

  // Sanitize: never return base64 — only Cloudinary URLs
  return NextResponse.json(
    {
      ...dojo,
      logo:               dojo.logo               ? (dojo.logo.startsWith("http")               ? dojo.logo               : null) : null,
      cardTemplateImage:  dojo.cardTemplateImage  ? (dojo.cardTemplateImage.startsWith("http")  ? dojo.cardTemplateImage  : null) : null,
      cardTemplateImage2: dojo.cardTemplateImage2 ? (dojo.cardTemplateImage2.startsWith("http") ? dojo.cardTemplateImage2 : null) : null,
      cardTemplateImage3: dojo.cardTemplateImage3 ? (dojo.cardTemplateImage3.startsWith("http") ? dojo.cardTemplateImage3 : null) : null,
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

  // Correo/teléfono/nombre del propietario — autoritativa, el cliente ya
  // valida esto mismo en src/app/dashboard/settings/page.tsx, pero nunca se
  // confía solo en eso. Motivada por dojos reales con estos campos vacíos
  // o incompletos (Ate Uke, Dojo Kobushi, Dojo Natsuki).
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (body.email !== undefined) {
    const v = String(body.email ?? "").trim();
    if (!v) return NextResponse.json({ error: "El correo del dojo es obligatorio" }, { status: 400 });
    if (!EMAIL_RE.test(v)) return NextResponse.json({ error: "El correo del dojo no es válido" }, { status: 400 });
  }
  if (body.phone !== undefined) {
    const v = String(body.phone ?? "").trim();
    if (!v) return NextResponse.json({ error: "El teléfono del dojo es obligatorio" }, { status: 400 });
    if (v.replace(/\D/g, "").length < 7) return NextResponse.json({ error: "El teléfono del dojo no es válido (mínimo 7 dígitos)" }, { status: 400 });
  }
  if (body.ownerName !== undefined) {
    const v = String(body.ownerName ?? "").trim();
    if (!v) return NextResponse.json({ error: "El nombre del propietario es obligatorio" }, { status: 400 });
    if (v.split(/\s+/).filter(Boolean).length < 2) return NextResponse.json({ error: "Ingresá nombre y apellido del propietario" }, { status: 400 });
  }

  const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
  for (const key of ["cardPrimaryColor", "cardSecondaryColor", "cardTertiaryColor"] as const) {
    if (body[key] != null && !HEX_COLOR_RE.test(body[key])) {
      return NextResponse.json({ error: `${key} debe ser un color hexadecimal válido (#RRGGBB)` }, { status: 400 });
    }
  }

  if (body.reminderToleranceDays != null) {
    const v = Number(body.reminderToleranceDays);
    if (!Number.isInteger(v) || v < 0 || v > 30)
      return NextResponse.json({ error: "reminderToleranceDays debe ser un entero entre 0 y 30" }, { status: 400 });
  }
  if (body.lateInterestPct != null) {
    const v = Number(body.lateInterestPct);
    if (isNaN(v) || v < 0 || v > 100)
      return NextResponse.json({ error: "lateInterestPct debe estar entre 0 y 100" }, { status: 400 });
  }
  if (body.lateToleranceMinutes != null) {
    const v = Number(body.lateToleranceMinutes);
    if (!Number.isInteger(v) || v < 0 || v > 120)
      return NextResponse.json({ error: "lateToleranceMinutes debe ser un entero entre 0 y 120" }, { status: 400 });
  }
  if (body.timezone != null) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: String(body.timezone) }); }
    catch { return NextResponse.json({ error: "timezone no es un identificador IANA válido" }, { status: 400 }); }
  }
  if (body.currency != null) {
    try { new Intl.NumberFormat("en-US", { style: "currency", currency: String(body.currency) }); }
    catch { return NextResponse.json({ error: "currency no es un código ISO 4217 válido" }, { status: 400 }); }
  }

  // Los campos de imagen se fetchean server-side después (logo del dojo en el
  // recibo PDF de WhatsApp, template de carnet, etc.) — deben venir siempre
  // de nuestro propio Cloudinary/ImageKit, nunca de una URL arbitraria del
  // body, o un admin de dojo podría convertir el campo en un vector de SSRF
  // hacia hosts internos. Ver src/lib/upload-validation.ts.
  const IMAGE_FIELDS = ["logo", "cardTemplateImage", "cardTemplateImage2", "cardTemplateImage3"] as const;
  for (const field of IMAGE_FIELDS) {
    const value = body[field];
    if (value != null && value !== "" && !isOwnMediaUrl(String(value))) {
      return NextResponse.json({ error: `${field} debe ser una URL de Cloudinary o ImageKit` }, { status: 400 });
    }
  }

  // Borrar imágenes antiguas de Cloudinary cuando se reemplazan o eliminan
  const hasImageChange = IMAGE_FIELDS.some(f => f in body);
  if (hasImageChange) {
    const current = await prisma.dojo.findUnique({
      where:  { id: targetId },
      select: { logo: true, cardTemplateImage: true, cardTemplateImage2: true, cardTemplateImage3: true },
    });
    if (current) {
      const toDelete: string[] = [];
      for (const field of IMAGE_FIELDS) {
        if (field in body && body[field] !== current[field]) {
          const pid = extractCloudinaryPublicId(current[field]);
          if (pid) toDelete.push(pid);
        }
      }
      if (toDelete.length > 0)
        Promise.all(toDelete.map(pid => deleteResource(pid).catch(() => {})));
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
      cardTemplateImage: "cardTemplateImage" in body ? (body.cardTemplateImage ?? null) : undefined,
      reminderToleranceDays: body.reminderToleranceDays != null ? Number(body.reminderToleranceDays) : undefined,
      lateInterestPct:       body.lateInterestPct       != null ? Number(body.lateInterestPct)       : undefined,
      autoRemindersEnabled:  body.autoRemindersEnabled  != null ? Boolean(body.autoRemindersEnabled)  : undefined,
      lateToleranceMinutes:  body.lateToleranceMinutes  != null ? Number(body.lateToleranceMinutes)   : undefined,
      timezone:              body.timezone != null ? String(body.timezone) : undefined,
      currency:              body.currency != null ? String(body.currency) : undefined,
      locale:                body.locale === "en" ? "en" : body.locale === "es" ? "es" : undefined,
      cardPrimaryColor:   "cardPrimaryColor"   in body ? (body.cardPrimaryColor   ?? null) : undefined,
      cardSecondaryColor: "cardSecondaryColor" in body ? (body.cardSecondaryColor ?? null) : undefined,
      cardTertiaryColor:  "cardTertiaryColor"  in body ? (body.cardTertiaryColor  ?? null) : undefined,
      contractPolicy:     "contractPolicy"     in body ? (body.contractPolicy     ?? null) : undefined,
      cardLayout:         "cardLayout"         in body ? (body.cardLayout         ?? null) : undefined,
      cardLayout2:        "cardLayout2"        in body ? (body.cardLayout2        ?? null) : undefined,
      cardTemplateImage2: "cardTemplateImage2" in body ? (body.cardTemplateImage2 ?? null) : undefined,
      cardLayout3:        "cardLayout3"        in body ? (body.cardLayout3        ?? null) : undefined,
      cardTemplateImage3: "cardTemplateImage3" in body ? (body.cardTemplateImage3 ?? null) : undefined,
      activeCardSlot:     "activeCardSlot"     in body ? Number(body.activeCardSlot ?? 1)  : undefined,
    },
    select: {
      id: true, name: true, slug: true, ownerName: true,
      email: true, phone: true, slogan: true, active: true,
      locale: true, tournamentPro: true, timezone: true, currency: true,
      reminderToleranceDays: true, lateInterestPct: true,
      autoRemindersEnabled: true, lateToleranceMinutes: true, logo: true,
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
      changed: Object.keys(body).filter(k => k !== "logo"),
    }),
  });

  return NextResponse.json({
    ...dojo,
    logo: dojo.logo?.startsWith("http") ? dojo.logo : null,
  });
}
