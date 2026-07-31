"use client";
import { Printer } from "lucide-react";

export function PrintCardButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print btn-secondary text-xs py-1.5 px-3"
    >
      <Printer size={13} /> Imprimir / Guardar PDF
    </button>
  );
}
