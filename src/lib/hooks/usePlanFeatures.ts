"use client";
import { useAppContext } from "@/lib/context/AppContext";

/**
 * true si el dojo tiene un plan pago (Silver/Gold) — habilita Torneos,
 * Tienda y Página pública. El Plan Bronce (gratuito) no las incluye.
 */
export function usePlanFeatures(): { hasPaidFeatures: boolean } {
  return { hasPaidFeatures: useAppContext().hasPaidFeatures };
}
