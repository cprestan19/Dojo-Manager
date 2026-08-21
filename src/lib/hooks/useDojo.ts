"use client";
import { useAppContext } from "@/lib/context/AppContext";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { DEFAULT_CURRENCY } from "@/lib/currency";

export interface DojoInfo {
  id:        string;
  name:      string;
  slug:      string;
  logo:      string | null;   // Cloudinary URL or null (never base64)
  ownerName: string | null;
  phone:     string | null;
  slogan:    string | null;
  active:         boolean;
  locale:         string;    // "es" | "en"
  timezone:       string;    // IANA, ej. "America/Panama"
  currency:       string;    // ISO 4217, ej. "USD" — moneda en la que paga el alumno
  tournamentPro:  boolean;   // Módulo Torneo Pro activado
  showFepakaField:   boolean;  // Mostrar campo "FEPAKA ID" en el perfil/formulario del alumno
  showRyoBukaiField: boolean;  // Mostrar campo "RYO BUKAI ID" en el perfil/formulario del alumno
}

/**
 * Returns the current dojo info from the shared AppContext.
 * No API call is made here — AppContextProvider fetches once per session.
 * The overrideId parameter is kept for backward compat but is ignored
 * (sysadmin dojo context is managed via the sx-dojo cookie instead).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- parámetro conservado por compatibilidad hacia atrás (ver comentario arriba)
export function useDojo(_overrideId?: string | null): DojoInfo | null {
  return useAppContext().dojo;
}

/** Zona horaria del dojo activo (dashboard) — DEFAULT_TIMEZONE si aún no cargó o no hay dojo (sysadmin sin contexto) */
export function useDojoTimeZone(): string {
  return useAppContext().dojo?.timezone ?? DEFAULT_TIMEZONE;
}

/** Moneda del dojo activo (dashboard) — DEFAULT_CURRENCY si aún no cargó o no hay dojo (sysadmin sin contexto) */
export function useDojoCurrency(): string {
  return useAppContext().dojo?.currency ?? DEFAULT_CURRENCY;
}
