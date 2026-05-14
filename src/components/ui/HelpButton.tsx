"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { HelpDrawer } from "@/components/ui/HelpDrawer";
import { getHelpContent } from "@/lib/help-content";

export function HelpButton() {
  const pathname = usePathname();
  const [open, setOpen]  = useState(false);
  const content = getHelpContent(pathname);

  // No mostrar si no hay contenido de ayuda para esta ruta
  if (!content) return null;

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen(true)}
        title="Ayuda — cómo usar este módulo"
        className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full
                   bg-dojo-red shadow-lg shadow-dojo-red/30
                   flex items-center justify-center
                   hover:scale-110 active:scale-95
                   transition-transform duration-150
                   focus:outline-none focus:ring-2 focus:ring-dojo-red focus:ring-offset-2 focus:ring-offset-dojo-darker"
        aria-label="Abrir ayuda"
      >
        <HelpCircle size={20} className="text-white" />
      </button>

      {/* Drawer */}
      <HelpDrawer
        content={open ? content : null}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
