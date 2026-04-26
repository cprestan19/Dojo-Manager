/**
 * Hook: información del dojo activo
 * Desarrollado por Cristhian Paul Prestán — 2025
 */
"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export interface DojoInfo {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  ownerName: string | null;
  phone: string | null;
  slogan: string | null;
  active: boolean;
}

export function useDojo(overrideId?: string | null) {
  const { data: session } = useSession();
  const [dojo, setDojo]   = useState<DojoInfo | null>(null);

  // Extraer primitivos estables: evita que el efecto se dispare cada vez
  // que NextAuth recrea el objeto session con los mismos datos.
  const userId = (session?.user as { id?: string })?.id   ?? null;
  const role   = (session?.user as { role?: string })?.role ?? null;

  useEffect(() => {
    if (!userId) return;
    if (role === "sysadmin" && !overrideId) return;

    const url = overrideId ? `/api/dojo?id=${overrideId}` : "/api/dojo";
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setDojo(data); })
      .catch(() => {});
  }, [userId, role, overrideId]); // strings: solo re-dispara cuando cambia usuario/rol real

  return dojo;
}
