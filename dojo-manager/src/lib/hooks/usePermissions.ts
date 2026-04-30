"use client";
import { useAppContext } from "@/lib/context/AppContext";
import type { NavKey } from "@/lib/permissions";

/**
 * Returns the current user's allowed nav keys from the shared AppContext.
 * No API call is made here — AppContextProvider fetches once per session.
 */
export function usePermissions(): Set<NavKey> {
  return useAppContext().perms;
}
