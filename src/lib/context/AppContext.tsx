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
  /** Funciones de Torneos, Tienda y Página pública — solo con plan pago vigente */
  hasPaidFeatures: boolean;
  /** true cuando sysadmin está en modo "Vista previa" de un dojo — ve exactamente
   *  lo que vería el admin real (permisos + plan), no acceso total. */
  isPreview: boolean;
  /** Torneo Pro: interruptor manual (Dojo.tournamentPro) O plan que lo incluya —
   *  calculado server-side por hasTournamentsAccess(), no solo el flag manual. */
  hasTournamentsAccess: boolean;
  /** Call after entering/exiting a dojo as sysadmin to refresh nav items */
  refreshPerms: () => void;
  /** Call after saving dojo settings (logo, name…) so the sidebar updates immediately */
  refreshDojo:  () => void;
}

const AppContext = createContext<AppCtx>({
  dojo:         null,
  perms:        new Set(DEFAULT_PERMISSIONS.user),
  hasPaidFeatures: true,
  isPreview:    false,
  hasTournamentsAccess: false,
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
  const [isPreview, setIsPreview] = useState(false);
  const [hasTournamentsAccess, setHasTournamentsAccess] = useState(false);

  useEffect(() => {
    setPerms(getInitialPerms(role));
  }, [role]);

  // Fetch dojo info (extracted so it can be called manually after saves).
  // sysadmin normalmente no tiene dojo propio — salvo en Vista Previa, donde sí
  // debe cargar el dojo real que está visualizando (logo, nombre, tournamentPro).
  const fetchDojo = useCallback(() => {
    if (!userId) return;
    if (role === "sysadmin" && !isPreview) return;
    // Sin ?logo=1 — evita fetchar loginBgImage (base64, varios MB) innecesariamente.
    // El logo de Cloudinary (URL corta) se incluye por defecto en el endpoint.
    fetch("/api/dojo")
      .then(r => r.ok ? r.json() : null)
      .then((d: DojoInfo | null) => { if (d) setDojo(d); })
      .catch(() => {});
  }, [userId, role, isPreview]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchDojo(); }, [fetchDojo]);

  // Stable reference: re-created only when userId or role changes.
  // Sin caché en sessionStorage: AppContextProvider vive en el layout
  // persistente del dashboard y no se remonta al navegar entre páginas, así
  // que este efecto ya solo corre una vez por carga de página — cachear en
  // sessionStorage no evitaba nada y sí causaba permisos desactualizados
  // hasta 5 minutos después de cerrar/reabrir sesión o cambiar de plan.
  const fetchPerms = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await fetch("/api/roles/current");
      if (!r.ok) return;
      const d = await r.json() as { permissions: NavKey[]; isPreview?: boolean; hasTournamentsAccess?: boolean } | null;
      if (d?.permissions) {
        setPerms(new Set(d.permissions));
        setIsPreview(!!d.isPreview);
        setHasTournamentsAccess(!!d.hasTournamentsAccess);
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
    <AppContext.Provider value={{ dojo, perms, hasPaidFeatures, isPreview, hasTournamentsAccess, refreshPerms: fetchPerms, refreshDojo: fetchDojo }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppCtx {
  return useContext(AppContext);
}
