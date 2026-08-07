import { getCachedDojoMeta } from "@/lib/queries";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

/** Zona horaria configurada del dojo (cacheada 5 min junto al resto del meta del dojo) */
export async function resolveDojoTimezone(dojoId: string | null | undefined): Promise<string> {
  if (!dojoId) return DEFAULT_TIMEZONE;
  const meta = await getCachedDojoMeta(dojoId).catch(() => null);
  return meta?.timezone ?? DEFAULT_TIMEZONE;
}
