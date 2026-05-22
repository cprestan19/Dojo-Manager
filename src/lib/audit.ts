import type { NextRequest } from "next/server";
import { createHash } from "crypto";
import prisma from "@/lib/prisma";

// ── Módulos funcionales ──────────────────────────────────────────────────────
export const AUDIT_MODULE = {
  AUTH:        "AUTH",
  STUDENTS:    "STUDENTS",
  PAYMENTS:    "PAYMENTS",
  BELTS:       "BELTS",
  ATTENDANCE:  "ATTENDANCE",
  SCANNER:     "SCANNER",
  USERS:       "USERS",
  SETTINGS:    "SETTINGS",
  SYSADMIN:    "SYSADMIN",
  TOURNAMENTS: "TOURNAMENTS",
  PORTAL:      "PORTAL",
} as const;

export type AuditModule = typeof AUDIT_MODULE[keyof typeof AUDIT_MODULE];

// ── Interface completa de parámetros ────────────────────────────────────────
export interface AuditParams {
  // ── Qué se hizo ────────────────────────────────────────────────
  /** Acción realizada — convención: ENTIDAD_VERBO. Ej: STUDENT_CREATED, LOGIN_FAILED */
  action:          string;
  /** Módulo funcional de la app */
  module?:         AuditModule | string | null;
  /** Método HTTP de la petición */
  method?:         string | null;
  /** Tipo de entidad afectada: Student | User | Payment | BeltHistory | Dojo | Tournament */
  resourceType?:   string | null;
  /** ID del registro afectado */
  resourceId?:     string | null;
  /** Código HTTP del resultado (201=created, 400=bad, 403=forbidden, 500=error) */
  statusCode?:     number | null;

  // ── Quién lo hizo ───────────────────────────────────────────────
  /** ID del usuario que realiza la acción */
  userId?:         string | null;
  /** Nombre del usuario que realiza la acción */
  userName?:       string | null;
  /** Email del usuario que realiza la acción */
  userEmail?:      string | null;
  /** true cuando sysadmin opera usando contexto de otro dojo (cookie sx-dojo) */
  isSysadminProxy?: boolean;

  // ── Dónde ──────────────────────────────────────────────────────
  /** Dojo sobre el que se opera */
  dojoId?:         string | null;
  /** Slug del dojo */
  dojoSlug?:       string | null;

  // ── Sobre quién / qué ──────────────────────────────────────────
  /** ID del usuario/recurso objetivo de la acción (ej: usuario editado) */
  targetId?:       string | null;
  /** Email del objetivo (para acciones sobre usuarios) */
  targetEmail?:    string | null;

  // ── Red, dispositivo y geolocalización ─────────────────────────
  /** IP del cliente (IPv4 o IPv6) */
  ip?:             string | null;
  /** User-Agent completo del navegador/cliente */
  userAgent?:      string | null;
  /** Código ISO del país (PA, CO, ES) — extraído de headers Vercel/Cloudflare */
  country?:        string | null;
  /** Ciudad del usuario */
  city?:           string | null;
  /** Región/estado del usuario */
  region?:         string | null;

  // ── Correlación de sesión ───────────────────────────────────────
  /** UUID fijo por sesión — permite correlacionar todos los eventos del mismo login */
  sessionId?:      string | null;

  // ── Rendimiento y contexto ──────────────────────────────────────
  /** Duración de la operación en milisegundos */
  duration?:       number | null;
  /**
   * JSON con contexto adicional.
   * Formato estándar: { before?: object, after?: object, reason?: string, extra?: object }
   * — before/after: estado de campos clave antes y después del cambio
   * — reason: motivo o descripción del cambio
   * — extra: cualquier dato adicional relevante
   */
  details?:        string | null;

  // ── Integridad ─────────────────────────────────────────────────
  /** SHA-256 de los campos clave (acción, userId, dojoId, ip, timestamp) — detecta tampering */
  hash?:           string | null;
}

// ── Tipo interno de sesión ───────────────────────────────────────────────────
type SessionUser = {
  id?:        string;
  name?:      string | null;
  email?:     string | null;
  role?:      string;
  dojoId?:    string | null;
  sessionId?: string;
};

// ── hashAuditEntry ────────────────────────────────────────────────────────────
/**
 * Genera un SHA-256 sobre los campos inmutables del log.
 * Permite verificar posteriormente que el registro no fue alterado.
 *
 * Para verificar: recomputar el hash con los mismos campos y comparar con el almacenado.
 */
function hashAuditEntry(params: AuditParams, timestamp: string): string {
  const payload = JSON.stringify({
    action:       params.action,
    module:       params.module       ?? null,
    userId:       params.userId       ?? null,
    userEmail:    params.userEmail    ?? null,
    dojoId:       params.dojoId       ?? null,
    resourceType: params.resourceType ?? null,
    resourceId:   params.resourceId   ?? null,
    ip:           params.ip           ?? null,
    statusCode:   params.statusCode   ?? null,
    sessionId:    params.sessionId    ?? null,
    timestamp,  // incluido para que el hash sea único por instancia
  });
  return createHash("sha256").update(payload).digest("hex");
}

// ── buildAuditCtx ─────────────────────────────────────────────────────────────
/**
 * Extrae automáticamente el contexto de auditoría de la sesión y el request.
 *
 * Captura:
 * - Identidad: userId, userName, userEmail, sessionId
 * - Contexto dojo: dojoId, isSysadminProxy
 * - Red: ip, userAgent
 * - Geolocalización: country, city, region (vía headers Vercel/Cloudflare — sin costo)
 * - HTTP: method
 * - Rendimiento: duration (si se pasa startTime)
 *
 * Uso:
 *   const t0  = Date.now();
 *   const ctx = buildAuditCtx(session, req, { startTime: t0, dojoId });
 *   await logAudit({ ...ctx, action: "STUDENT_CREATED", module: AUDIT_MODULE.STUDENTS });
 */
export function buildAuditCtx(
  session: { user: SessionUser } | null,
  req: NextRequest,
  opts?: { startTime?: number; dojoId?: string | null }
): Partial<AuditParams> {
  const user: SessionUser = (session?.user ?? {}) as SessionUser;

  // ── IP — soporta proxies, Vercel edge y Cloudflare ──────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? req.headers.get("cf-connecting-ip")
    ?? "unknown";

  // ── Geolocalización sin costo — headers de Vercel y Cloudflare ──
  // Vercel: x-vercel-ip-country, x-vercel-ip-city, x-vercel-ip-region
  // Cloudflare: cf-ipcountry (solo código país)
  const country =
    req.headers.get("x-vercel-ip-country")
    ?? req.headers.get("cf-ipcountry")
    ?? null;

  const city   = req.headers.get("x-vercel-ip-city")   ?? null;
  const region = req.headers.get("x-vercel-ip-region")  ?? null;

  // ── Sysadmin proxy: cuando sysadmin opera dentro de un dojo ajeno ──
  const sxDojo          = req.cookies.get("sx-dojo")?.value ?? null;
  const isSysadminProxy = user.role === "sysadmin" && !!sxDojo;

  // ── dojoId efectivo — override explícito > sxDojo > JWT ──────
  const effectiveDojoId =
    opts?.dojoId !== undefined
      ? opts.dojoId
      : isSysadminProxy ? sxDojo : (user.dojoId ?? null);

  return {
    userId:          user.id        ?? null,
    userName:        user.name      ?? null,
    userEmail:       user.email     ?? null,
    sessionId:       user.sessionId ?? null,
    dojoId:          effectiveDojoId,
    method:          req.method,
    ip,
    userAgent:       req.headers.get("user-agent"),
    country,
    city,
    region,
    isSysadminProxy,
    duration:        opts?.startTime != null ? Date.now() - opts.startTime : null,
  };
}

// ── logAudit ─────────────────────────────────────────────────────────────────
/**
 * Registra un evento en la tabla audit_logs con firma SHA-256 de integridad.
 * NUNCA lanza error — un fallo de auditoría no debe interrumpir el flujo normal.
 *
 * El campo `hash` permite verificar que el registro no fue alterado posteriormente:
 *   const expected = sha256(JSON.stringify({ action, userId, dojoId, ip, ... }));
 *   assert(log.hash === expected);
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const hash = hashAuditEntry(params, new Date().toISOString());
    await prisma.auditLog.create({
      data: { ...params, hash },
    });
  } catch {
    // Silencioso — nunca interrumpir el flujo de negocio por un fallo de log
  }
}

// ── getIp — compatibilidad legacy ────────────────────────────────────────────
export function getIp(
  req: Request | { headers: Record<string, string | string[] | undefined> }
): string {
  const get = (k: string): string | null => {
    if (req instanceof Request) return req.headers.get(k);
    const v = (req.headers as Record<string, string | string[] | undefined>)[k];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
  return get("x-forwarded-for")?.split(",")[0]?.trim() ?? get("x-real-ip") ?? "unknown";
}
