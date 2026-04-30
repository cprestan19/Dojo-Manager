"use client";
import { useAppContext } from "@/lib/context/AppContext";

export interface DojoInfo {
  id:        string;
  name:      string;
  slug:      string;
  logo:      string | null;
  ownerName: string | null;
  phone:     string | null;
  slogan:    string | null;
  active:    boolean;
}

/**
 * Returns the current dojo info from the shared AppContext.
 * No API call is made here — AppContextProvider fetches once per session.
 * The overrideId parameter is kept for backward compat but is ignored
 * (sysadmin dojo context is managed via the sx-dojo cookie instead).
 */
export function useDojo(_overrideId?: string | null): DojoInfo | null {
  return useAppContext().dojo;
}
