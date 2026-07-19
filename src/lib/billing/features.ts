import { SubscriptionStatus } from "@prisma/client";
import { getDojoSubscription } from "./subscription";

/**
 * Funciones reservadas a planes pagos: Torneos, Tienda y Página pública
 * del dojo. Un dojo sin un plan pago vigente (monthlyPrice > 0) no las
 * incluye.
 */
export async function dojoHasPaidFeatures(dojoId: string): Promise<boolean> {
  const sub = await getDojoSubscription(dojoId);
  if (!sub) return true;
  if (sub.status === SubscriptionStatus.COMPLIMENTARY) return true;
  if (sub.status === SubscriptionStatus.SPECIAL_ACCESS) return true;
  return (sub.plan?.monthlyPrice ?? 0) > 0;
}
