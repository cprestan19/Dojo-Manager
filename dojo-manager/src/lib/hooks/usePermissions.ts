"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import type { NavKey } from "@/lib/permissions";
import { DEFAULT_PERMISSIONS, SYSADMIN_NO_DOJO_PERMS } from "@/lib/permissions";

export function usePermissions() {
  const { data: session } = useSession();
  const role   = (session?.user as { role?: string })?.role ?? "user";
  const userId = (session?.user as { id?: string })?.id ?? null;

  // For sysadmin: read sx-dojo cookie client-side for immediate state
  const sysadminInitial = role === "sysadmin"
    ? (typeof document !== "undefined" && document.cookie.includes("sx-dojo=")
        ? DEFAULT_PERMISSIONS.sysadmin   // has context → full perms
        : SYSADMIN_NO_DOJO_PERMS)        // no context → restricted
    : null;

  const [keys, setKeys] = useState<Set<NavKey>>(
    () => new Set(sysadminInitial ?? DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS.user),
  );

  useEffect(() => {
    if (!userId) return;
    fetch("/api/roles/current")
      .then(r => r.ok ? r.json() : null)
      .then((data: { permissions: NavKey[] } | null) => {
        if (data?.permissions) setKeys(new Set(data.permissions));
      })
      .catch(() => {});
  // Re-fetch when role changes or when sx-dojo cookie changes (detected via a custom event)
  }, [userId, role]);

  return keys;
}
