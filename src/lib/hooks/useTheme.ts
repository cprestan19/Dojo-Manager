"use client";
import { useState, useEffect, useCallback } from "react";

export type ThemeId = "dark-saas" | "soft-neutral" | "executive-red";

export const THEMES: Array<{ id: ThemeId; label: string; preview: string }> = [
  { id: "dark-saas",      label: "Dark Premium",  preview: "#0B0F14" },
  { id: "soft-neutral",   label: "Light Minimal", preview: "#F9FAFB" },
  { id: "executive-red",  label: "Ejecutivo",     preview: "#0F172A" },
];

const DEFAULT_THEME: ThemeId = "dark-saas";

function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  // El SSR pone data-theme en #dojo-shell — actualizamos ese mismo elemento.
  // Si no existe (todavía montando), caemos al documentElement.
  const el = document.getElementById("dojo-shell") ?? document.documentElement;
  el.setAttribute("data-theme", theme);
}

export function useTheme() {
  // Estado inicial: sincroniza con el data-theme que puso el SSR en #dojo-shell.
  // No usamos localStorage — la DB es la fuente de verdad (el SSR ya leyó de allí).
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const el = document.getElementById("dojo-shell");
    const ssrTheme = (el?.getAttribute("data-theme") as ThemeId) ?? DEFAULT_THEME;
    setThemeState(ssrTheme);
  }, []);

  const setTheme = useCallback((newTheme: ThemeId) => {
    setThemeState(newTheme);
    applyTheme(newTheme);

    // Persistir en DB (fuente de verdad para SSR)
    fetch("/api/dojo/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: newTheme }),
    }).catch(() => {});
  }, []);

  return { theme, setTheme, themes: THEMES };
}
