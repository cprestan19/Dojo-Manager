"use client";
import { useTheme, THEMES } from "@/lib/hooks/useTheme";
import { Palette } from "lucide-react";
import { useState } from "react";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
        style={{
          background:   "var(--card)",
          border:       "1px solid var(--border)",
          color:        "var(--text-secondary)",
        }}
        title="Cambiar tema"
      >
        <Palette size={15} />
        <span className="hidden sm:inline">Tema</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-full mt-2 w-48 rounded-xl z-50 shadow-xl overflow-hidden"
            style={{
              background: "var(--card)",
              border:     "1px solid var(--border)",
            }}
          >
            <p
              className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Apariencia
            </p>
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors text-left"
                style={{
                  background: theme === t.id ? "var(--primary-subtle)" : "transparent",
                  color:      theme === t.id ? "var(--primary)" : "var(--text-secondary)",
                  fontWeight: theme === t.id ? 600 : 400,
                }}
              >
                <span
                  className="w-5 h-5 rounded-full border-2 flex-shrink-0"
                  style={{
                    background:   t.preview,
                    borderColor:  theme === t.id ? "var(--primary)" : "var(--border)",
                  }}
                />
                {t.label}
                {theme === t.id && (
                  <span className="ml-auto text-xs" style={{ color: "var(--primary)" }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
