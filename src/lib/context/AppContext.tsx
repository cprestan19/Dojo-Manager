"use client";
/**
 * AppContext — shared dojo info + permissions fetched ONCE per session.
 *
 * Problem solved: useDojo() and usePermissions() were calling separate API
 * endpoints on every page navigation because both hooks lived inside Sidebar
 * and MobileNav, which re-mount on each route change.
 *
 * Solution: wrap the dashboard layout children with this provider so both
 * hooks read from a single in-memory cache instead of firing new requests.
 */
import {
  createContext, useContext, useState, useEffect,
  useCallback, type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import type { DojoInfo } from "@/lib/hooks/useDojo";
import type { NavKey } from "@/lib/permissions";
import { DEFAULT_PERMISSIONS, SYSADMIN_NO_DOJO_PERMS, ALL_DOJO_KEYS } from "@/lib/permissions";

interface AppCtx {
  dojo:         DojoInfo | null;
  perms:        Set<NavKey>;
  /** Funciones de Torneos, Tienda y Página pública — solo planes pagos (Silver/Gold) */
  hasPaidFeatures: boolean;
  /** Call after entering/exiting a dojo as sysadmin to refresh nav items */
  refreshPerms: () => void;
  /** Call after saving dojo settings (logo, name…) so the sidebar updates immediately */
  refreshDojo:  () => void;
}

const AppContext = createContext<AppCtx>({
  dojo:         null,
  perms:        new Set(DEFAULT_PERMISSIONS.user),
  hasPaidFeatures: true,
  refreshPerms: () => {},
  refreshDojo:  () => {},
});

function getInitialPerms(role: string): Set<NavKey> {
  if (role === "sysadmin" && typeof document !== "undefined") {
    const hasDojoCtx = document.cookie.includes("sx-dojo=");
    return new Set(hasDojoCtx ? DEFAULT_PERMISSIONS.sysadmin : SYSADMIN_NO_DOJO_PERMS);
  }
  return new Set(DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS.user);
}

export function AppContextProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id    ?? null;
  const role   = (session?.user as { role?: string })?.role ?? "user";

  const [dojo,  setDojo]  = useState<DojoInfo | null>(null);
  const [perms, setPerms] = useState<Set<NavKey>>(() => getInitialPerms(role));
  const [hasPaidFeatures, setHasPaidFeatures] = useState(true);

  useEffect(() => {
    setPerms(getInitialPerms(role));
  }, [role]);

  // Fetch dojo info (extracted so it can be called manually after saves)
  const fetchDojo = useCallback(() => {
    if (!userId || role === "sysadmin") return;
    // Sin ?logo=1 — evita fetchar loginBgImage (base64, varios MB) innecesariamente.
    // El logo de Cloudinary (URL corta) se incluye por defecto en el endpoint.
    fetch("/api/dojo")
      .then(r => r.ok ? r.json() : null)
      .then((d: DojoInfo | null) => { if (d) setDojo(d); })
      .catch(() => {});
  }, [userId, role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchDojo(); }, [fetchDojo]);

  // Stable reference: re-created only when userId or role changes
  const fetchPerms = useCallback(async () => {
    if (!userId) return;
    // Check sessionStorage cache first — avoids redundant fetch on soft navigations
    const cacheKey = `perms-${userId}-${role}-${ALL_DOJO_KEYS.length}`;
    const cached = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(cacheKey) : null;
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as NavKey[];
        setPerms(new Set(parsed));
        return;
      } catch { /* invalid cache — refetch */ }
    }
    try {
      const r = await fetch("/api/roles/current");
      if (!r.ok) return;
      const d = await r.json() as { permissions: NavKey[] } | null;
      if (d?.permissions) {
        setPerms(new Set(d.permissions));
        // Cache for 5 minutes in sessionStorage
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(cacheKey, JSON.stringify(d.permissions));
          setTimeout(() => sessionStorage.removeItem(cacheKey), 5 * 60 * 1000);
        }
      }
    } catch {
      // keep default perms on network error — non-fatal
    }
  }, [userId, role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchPerms(); }, [fetchPerms]);

  // Funciones exclusivas de planes pagos (Torneos, Tienda, Página pública)
  useEffect(() => {
    if (!userId) return;
    fetch("/api/billing/status")
      .then(r => r.ok ? r.json() : null)
      .then((d: { hasPaidFeatures?: boolean } | null) => {
        if (d && typeof d.hasPaidFeatures === "boolean") setHasPaidFeatures(d.hasPaidFeatures);
      })
      .catch(() => {});
  }, [userId, role]);

  return (
    <AppContext.Provider value={{ dojo, perms, hasPaidFeatures, refreshPerms: fetchPerms, refreshDojo: fetchDojo }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppCtx {
  return useContext(AppContext);
}
