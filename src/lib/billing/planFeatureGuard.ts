import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveDojoId } from "@/lib/sysadmin-context";
import { hasFeature, hasTournamentsAccess } from "@/lib/billing/featureGate";
import type { NavKey } from "@/lib/permissions";

type RouteHandler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse> | NextResponse;

const FEATURE_LOCKED_RESPONSE = () => NextResponse.json(
  { error: "FEATURE_NOT_INCLUDED", message: "Tu plan actual no incluye esta función." },
  { status: 403 },
);

/**
 * Resuelve el dojoId efectivo, o null si no aplica el chequeo.
 * sysadmin SIEMPRE se salta el feature-gating por plan — con o sin dojo
 * activo (cookie sx-dojo) — igual que ya tenía acceso total antes de esto.
 * El feature-gating es una restricción para clientes según lo que pagan,
 * nunca para el equipo de la plataforma operando/soportando un dojo.
 */
async function resolveGuardedDojoId(req: NextRequest): Promise<{ dojoId: string | null; skip: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session) return { dojoId: null, skip: true }; // deja que la ruta maneje el 401

  const { role, dojoId: sessionDojoId } = session.user as { role?: string; dojoId?: string | null };
  if (role === "sysadmin") return { dojoId: null, skip: true };

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return { dojoId: null, skip: true };

  return { dojoId, skip: false };
}

/**
 * Bloquea una ruta cuando el plan del dojo no incluye la función indicada
 * (Plan.featureKeys). Más granular que withPaidPlanGuard (que solo distingue
 * "sin plan pago vigente" de "cualquier plan pago") — este permite que cada
 * plan pago incluya un subconjunto distinto de funciones.
 *
 * No reemplaza withPaidPlanGuard donde ya está aplicado (Torneos-eventos,
 * Tienda, Página pública) — coexisten. Este guard es para funciones nuevas
 * que todavía no tenían ningún control de acceso por plan.
 *
 * A diferencia de withReadOnlyGuard (solo bloquea escrituras), bloquea
 * también lectura — si el plan no incluye la función, no debe ver los datos
 * existentes tampoco.
 */
export function withPlanFeatureGuard(key: NavKey, handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx: unknown) => {
    const { dojoId, skip } = await resolveGuardedDojoId(req);
    if (skip || !dojoId) return handler(req, ctx);

    if (!(await hasFeature(dojoId, key))) return FEATURE_LOCKED_RESPONSE();
    return handler(req, ctx);
  };
}

/**
 * Variante para Torneo Pro: respeta el interruptor manual histórico
 * Dojo.tournamentPro (ver hasTournamentsAccess) además del plan — aplicado
 * por ahora solo en el endpoint raíz de torneos (listar/crear). Las
 * subrutas (brackets, jueces, tatamis, etc.) ya validan que el torneo
 * pertenezca al dojo, pero no verifican el plan de forma independiente
 * todavía — queda como mejora de seguimiento si se necesita blindaje total.
 */
export function withTournamentsGuard(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx: unknown) => {
    const { dojoId, skip } = await resolveGuardedDojoId(req);
    if (skip || !dojoId) return handler(req, ctx);

    if (!(await hasTournamentsAccess(dojoId))) return FEATURE_LOCKED_RESPONSE();
    return handler(req, ctx);
  };
}
