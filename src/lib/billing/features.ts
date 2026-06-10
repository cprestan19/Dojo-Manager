import { SubscriptionStatus } from "@prisma/client";
import { getDojoSubscription } from "./subscription";

/**
 * Funciones reservadas a planes pagos (Silver/Gold): Torneos, Tienda y
 * Página pública del dojo. El Plan Bronce (gratuito, hasta 20 alumnos)
 * no las incluye.
 */
export async function dojoHasPaidFeatures(dojoId: string): Promise<boolean> {
  const sub = await getDojoSubscription(dojoId);
  if (!sub) return true; // sin suscripción → sin restricción (periodo de gracia)
  if (sub.status === SubscriptionStatus.COMPLIMENTARY) return true;
  return (sub.plan?.monthlyPrice ?? 0) > 0;
}
