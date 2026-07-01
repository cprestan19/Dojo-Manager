"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ScrollText, CheckCircle2 } from "lucide-react";

interface Props {
  content: string;
  version: number;
  dojoName: string;
}

export default function TermsGate({ content, version, dojoName }: Props) {
  const router   = useRouter();
  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState("");
  const [agreed, setAgreed]   = useState(false);
  const [done,   setDone]     = useState(false);

  async function handleAccept() {
    if (!agreed) { setError("Debes marcar la casilla para continuar."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/portal/terms", { method: "POST" });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "No se pudo registrar la aceptación");
        return;
      }
      setDone(true);
      setTimeout(() => router.refresh(), 600);
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-dojo-darker flex flex-col">
      {/* Header */}
      <div className="border-b border-dojo-border px-4 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-dojo-gold/10 flex items-center justify-center shrink-0">
          <ScrollText size={18} className="text-dojo-gold" />
        </div>
        <div>
          <p className="font-display font-bold text-dojo-white text-base leading-tight">{dojoName}</p>
          <p className="text-xs text-dojo-muted">Políticas y Términos — Versión {version}</p>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="font-display font-bold text-dojo-white text-lg">
            Términos y Condiciones del Dojo
          </h2>
          <p className="text-xs text-dojo-muted">
            Debes leer y aceptar estas políticas antes de acceder a tu portal de alumno.
          </p>
          <div
            className="bg-dojo-dark border border-dojo-border rounded-xl p-5 text-sm text-dojo-white/90 whitespace-pre-wrap leading-relaxed"
            style={{ minHeight: "200px" }}
          >
            {content}
          </div>
        </div>
      </div>

      {/* Footer con checkbox + botón */}
      <div className="border-t border-dojo-border px-4 py-4 bg-dojo-dark">
        <div className="max-w-2xl mx-auto space-y-3">
          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-dojo-border accent-dojo-gold shrink-0"
            />
            <span className="text-sm text-dojo-white/80 group-hover:text-dojo-white transition-colors leading-snug">
              He leído y acepto las políticas, términos y condiciones del dojo.
            </span>
          </label>
          <button
            onClick={handleAccept}
            disabled={saving || done}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            {done ? (
              <>
                <CheckCircle2 size={16} className="text-green-400" />
                <span>¡Aceptado! Ingresando...</span>
              </>
            ) : saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Registrando...</span>
              </>
            ) : (
              "Aceptar y continuar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
