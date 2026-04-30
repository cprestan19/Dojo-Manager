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
import { DEFAULT_PERMISSIONS, SYSADMIN_NO_DOJO_PERMS } from "@/lib/permissions";

interface AppCtx {
  dojo:         DojoInfo | null;
  perms:        Set<NavKey>;
  /** Call after entering/exiting a dojo as sysadmin to refresh nav items */
  refreshPerms: () => void;
}

const AppContext = createContext<AppCtx>({
  dojo:         null,
  perms:        new Set(DEFAULT_PERMISSIONS.user),
  refreshPerms: () => {},
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

  useEffect(() => {
    setPerms(getInitialPerms(role));
  }, [role]);

  // Fetch dojo info ONCE per userId (not per page navigation)
  useEffect(() => {
    if (!userId || role === "sysadmin") return;
    fetch("/api/dojo")
      .then(r => r.ok ? r.json() : null)
      .then((d: DojoInfo | null) => { if (d) setDojo(d); })
      .catch(() => {});
  }, [userId, role]);

  // Stable reference: re-created only when userId or role changes
  const fetchPerms = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await fetch("/api/roles/current");
      if (!r.ok) return;
      const d = await r.json() as { permissions: NavKey[] } | null;
      if (d?.permissions) setPerms(new Set(d.permissions));
    } catch {
      // keep default perms on network error — non-fatal
    }
    // role is intentionally in deps: re-fetch when role changes (e.g. sysadmin enters dojo)
  }, [userId, role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchPerms(); }, [fetchPerms]);

  return (
    <AppContext.Provider value={{ dojo, perms, refreshPerms: fetchPerms }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppCtx {
  return useContext(AppContext);
}
