"use client";
import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

const PortalTimeZoneContext = createContext<string>(DEFAULT_TIMEZONE);

/** portal/layout.tsx (Server Component) ya trae dojo.timezone al resolver la sesión — se pasa una sola vez aquí. */
export function PortalTimeZoneProvider({ timezone, children }: { timezone: string; children: ReactNode }) {
  return <PortalTimeZoneContext.Provider value={timezone}>{children}</PortalTimeZoneContext.Provider>;
}

export function usePortalTimeZone(): string {
  return useContext(PortalTimeZoneContext);
}
