import { getCachedDojoMeta } from "@/lib/queries";
import { DEFAULT_CURRENCY } from "@/lib/currency";

/** Moneda configurada del dojo (cacheada 5 min junto al resto del meta del dojo) */
export async function resolveDojoCurrency(dojoId: string | null | undefined): Promise<string> {
  if (!dojoId) return DEFAULT_CURRENCY;
  const meta = await getCachedDojoMeta(dojoId).catch(() => null);
  return meta?.currency ?? DEFAULT_CURRENCY;
}
