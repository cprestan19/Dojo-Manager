import type { NextRequest } from "next/server";

/**
 * Returns the effective dojoId for the current request:
 * - admin / user  → session.dojoId (immutable, from JWT)
 * - sysadmin      → sx-dojo cookie (set when entering a dojo for maintenance)
 *
 * Returns null when sysadmin hasn't selected a dojo context yet.
 * API routes MUST reject with 403 when this returns null (except global routes).
 */
export function getEffectiveDojoId(
  role:          string | undefined,
  sessionDojoId: string | null | undefined,
  req:           NextRequest,
): string | null {
  if (role === "sysadmin") {
    return req.cookies.get("sx-dojo")?.value ?? null;
  }
  return sessionDojoId ?? null;
}

/** Standardised 403 response when sysadmin has no dojo context */
export const NO_DOJO_CONTEXT_ERROR =
  "Selecciona un dojo desde Gestión de Dojos para operar en él.";
