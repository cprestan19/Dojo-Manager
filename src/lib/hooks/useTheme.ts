"use client";
import { useState, useEffect, useCallback } from "react";

export type ThemeId = "dark-saas" | "soft-neutral" | "executive-red";

export const THEMES: Array<{ id: ThemeId; label: string; preview: string }> = [
  { id: "dark-saas",      label: "Dark Premium",  preview: "#0B0F14" },
  { id: "soft-neutral",   label: "Light Minimal", preview: "#F9FAFB" },
  { id: "executive-red",  label: "Ejecutivo",     preview: "#0F172A" },
];

const STORAGE_KEY = "dojo-theme";
const DEFAULT_THEME: ThemeId = "dark-saas";

function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  // Aplicar theme en el primer render (desde localStorage o default)
  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as ThemeId) ?? DEFAULT_THEME;
    setThemeState(saved);
    applyTheme(saved);
  }, []);

  const setTheme = useCallback((newTheme: ThemeId) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);

    // Sincronizar con el servidor (persistencia por dojo en DB)
    // Fire-and-forget — no bloquea la UI
    fetch("/api/dojo/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: newTheme }),
    }).catch(() => {});
  }, []);

  return { theme, setTheme, themes: THEMES };
}
