"use client";
import { useAppContext } from "@/lib/context/AppContext";

/**
 * true si el dojo tiene un plan pago — habilita Torneos, Tienda y Página
 * pública. Un dojo sin plan pago vigente (mes gratis vencido sin pagar) no
 * las incluye.
 */
export function usePlanFeatures(): { hasPaidFeatures: boolean } {
  return { hasPaidFeatures: useAppContext().hasPaidFeatures };
}
