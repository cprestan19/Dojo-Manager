"use client";
import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_CURRENCY } from "@/lib/currency";

const PortalCurrencyContext = createContext<string>(DEFAULT_CURRENCY);

/** portal/layout.tsx (Server Component) ya trae dojo.currency al resolver la sesión — se pasa una sola vez aquí. */
export function PortalCurrencyProvider({ currency, children }: { currency: string; children: ReactNode }) {
  return <PortalCurrencyContext.Provider value={currency}>{children}</PortalCurrencyContext.Provider>;
}

export function usePortalCurrency(): string {
  return useContext(PortalCurrencyContext);
}
