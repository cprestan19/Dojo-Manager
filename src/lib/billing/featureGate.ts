import prisma from "@/lib/prisma";
import { ALL_DOJO_KEYS, NAV_KEYS, type NavKey } from "@/lib/permissions";
import { SubscriptionStatus } from "@prisma/client";

// ALL_DOJO_KEYS es la lista de ítems de navegación del dashboard (rol) — no
// incluye PORTAL_ACCESS porque no es un ítem de nav. Para los casos de "acceso
// total" (COMPLIMENTARY, planes legado, sin suscripción) sí debe incluir
// también el acceso al portal, para no romper el portal de alumnos de dojos
// que nunca tuvieron esta restricción.
const ALL_FEATURE_KEYS: NavKey[] = [...ALL_DOJO_KEYS, NAV_KEYS.PORTAL_ACCESS];

/**
 * Funciones efectivamente incluidas en el plan de un dojo.
 *
 * Reglas (en orden):
 * - Sin fila de Subscription (dato legado/inconsistente) → todas las funciones,
 *   nunca romper acceso por falta de datos.
 * - status COMPLIMENTARY → todas las funciones. Es el mecanismo ya existente de
 *   acceso especial otorgado a mano (ej. Dojo Natsuki, Dojo Kyodai) — el
 *   feature-gating por plan nunca debe restringir a estos dojos.
 * - Plan.featureKeys null (planes legado: Bronce/Silver/Gold/Pro) → todas las
 *   funciones. Estos planes no se tocan hasta que se decida su migración.
 * - En cualquier otro caso → exactamente lo que liste featureKeys.
 */
export async function getEffectivePlanFeatures(dojoId: string): Promise<Set<NavKey>> {
  const sub = await prisma.subscription.findUnique({
    where:  { dojoId },
    select: { status: true, plan: { select: { featureKeys: true } } },
  });

  if (!sub) return new Set(ALL_FEATURE_KEYS);
  if (sub.status === SubscriptionStatus.COMPLIMENTARY) return new Set(ALL_FEATURE_KEYS);
  if (!sub.plan?.featureKeys) return new Set(ALL_FEATURE_KEYS);

  try {
    const keys = JSON.parse(sub.plan.featureKeys) as NavKey[];
    return new Set(keys);
  } catch {
    return new Set(ALL_FEATURE_KEYS);
  }
}

export async function hasFeature(dojoId: string, key: NavKey): Promise<boolean> {
  const features = await getEffectivePlanFeatures(dojoId);
  return features.has(key);
}

/**
 * Torneo Pro tiene su propio interruptor histórico (Dojo.tournamentPro,
 * activado a mano por sysadmin) que ya existía antes del feature-gating por
 * plan. Se preserva ese mecanismo sin tocarlo — el acceso final es "cualquiera
 * de los dos": el interruptor manual sigue funcionando exactamente igual que
 * antes para los dojos que ya lo tenían, y el plan lo otorga automáticamente
 * para los que lo incluyan (o si el dojo está en COMPLIMENTARY).
 */
export async function hasTournamentsAccess(dojoId: string): Promise<boolean> {
  const [dojo, features] = await Promise.all([
    prisma.dojo.findUnique({ where: { id: dojoId }, select: { tournamentPro: true } }),
    getEffectivePlanFeatures(dojoId),
  ]);
  return !!dojo?.tournamentPro || features.has(NAV_KEYS.TOURNAMENTS);
}
