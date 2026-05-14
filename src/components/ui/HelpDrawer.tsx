"use client";
import { useEffect } from "react";
import { X, CheckCircle2, Lightbulb } from "lucide-react";
import type { HelpContent } from "@/lib/help-content";

interface Props {
  content: HelpContent | null;
  onClose: () => void;
}

export function HelpDrawer({ content, onClose }: Props) {
  // Cerrar con Escape
  useEffect(() => {
    if (!content) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [content, onClose]);

  // Bloquear scroll del body mientras está abierto
  useEffect(() => {
    document.body.style.overflow = content ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [content]);

  if (!content) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-sm z-[61] flex flex-col bg-dojo-dark border-l border-dojo-border shadow-2xl animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dojo-border shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none">{content.emoji}</span>
            <div>
              <p className="font-display font-bold text-dojo-sidebar-text text-base leading-tight">
                {content.title}
              </p>
              <p className="text-xs text-dojo-sidebar-muted mt-0.5">Guía de uso</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-dojo-sidebar-muted hover:text-dojo-sidebar-text hover:bg-dojo-border transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* Descripción */}
          <p className="text-sm text-dojo-sidebar-text leading-relaxed">
            {content.description}
          </p>

          {/* Pasos */}
          <div>
            <p className="text-xs font-bold text-dojo-sidebar-text uppercase tracking-widest mb-3 flex items-center gap-2">
              <CheckCircle2 size={13} className="text-dojo-red" /> Cómo usar
            </p>
            <ol className="space-y-3">
              {content.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-dojo-border text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-dojo-sidebar-text leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* Consejos */}
          {content.tips && content.tips.length > 0 && (
            <div className="bg-dojo-border/10 border border-dojo-border/40 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-dojo-gold uppercase tracking-widest flex items-center gap-2">
                <Lightbulb size={13} /> Consejos
              </p>
              <ul className="space-y-2">
                {content.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-sm text-dojo-sidebar-text leading-relaxed">
                    <span className="text-dojo-gold shrink-0 mt-0.5">·</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-dojo-border shrink-0">
          <button onClick={onClose}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                       border border-dojo-border bg-dojo-border/30 text-dojo-sidebar-text
                       hover:bg-dojo-border transition-colors duration-200">
            <X size={15} /> Cerrar ayuda
          </button>
        </div>
      </div>
    </>
  );
}
