"use client";
import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, RefreshCw, ScrollText, Users, Info } from "lucide-react";

interface Policy {
  id:        string;
  content:   string;
  version:   number;
  enabled:   boolean;
  updatedAt: string;
}

interface TermsData {
  policy:        Policy | null;
  acceptedCount: number;
  totalActive:   number;
}

export default function TermsSettingsPage() {
  const [data,     setData]     = useState<TermsData | null>(null);
  const [content,  setContent]  = useState("");
  const [enabled,  setEnabled]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [bumping,  setBumping]  = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [success,  setSuccess]  = useState("");
  const [error,    setError]    = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/dojo/terms");
    if (res.ok) {
      const d = await res.json() as TermsData;
      setData(d);
      setContent(d.policy?.content ?? "");
      setEnabled(d.policy?.enabled ?? false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(bumpVersion = false) {
    if (!content.trim()) { setError("El contenido no puede estar vacío."); return; }
    bumpVersion ? setBumping(true) : setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/dojo/terms", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ content, enabled, bumpVersion }),
      });
      const d = await res.json() as Policy & { error?: string };
      if (!res.ok) { setError(d.error ?? "Error al guardar"); return; }
      const msg = bumpVersion
        ? `Versión actualizada a v${d.version}. Todos los alumnos deberán aceptar nuevamente.`
        : "Cambios guardados correctamente.";
      setSuccess(msg);
      setSaved(true);
      setTimeout(() => { setSuccess(""); setSaved(false); }, 4000);
      await load();
    } finally {
      setSaving(false);
      setBumping(false);
    }
  }

  const version = data?.policy?.version ?? 1;
  const pct     = data && data.totalActive > 0
    ? Math.round((data.acceptedCount / data.totalActive) * 100)
    : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-dojo-gold/10 flex items-center justify-center shrink-0">
          <ScrollText size={20} className="text-dojo-gold" />
        </div>
        <div>
          <h1 className="font-display font-bold text-dojo-white text-xl">Políticas y Términos</h1>
          <p className="text-sm text-dojo-muted">Define el contrato que los alumnos deben aceptar para acceder a su portal.</p>
        </div>
      </div>

      {error   && <div className="bg-red-900/40 border border-red-800/50 rounded-lg p-3 text-red-400 text-sm">{error}</div>}
      {success && <div className="bg-green-900/40 border border-green-800/50 rounded-lg p-3 text-green-400 text-sm">{success}</div>}

      {/* Estadísticas */}
      {data?.policy && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center">
            <p className="text-2xl font-bold text-dojo-white">{data.acceptedCount}</p>
            <p className="text-xs text-dojo-muted mt-0.5">Han aceptado</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-dojo-white">{data.totalActive}</p>
            <p className="text-xs text-dojo-muted mt-0.5">Alumnos activos</p>
          </div>
          <div className="card text-center">
            <p className={`text-2xl font-bold ${pct === 100 ? "text-green-400" : pct > 50 ? "text-dojo-gold" : "text-red-400"}`}>
              {pct}%
            </p>
            <p className="text-xs text-dojo-muted mt-0.5">Cumplimiento</p>
          </div>
        </div>
      )}

      {/* Toggle habilitado */}
      <div className="card flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Users size={18} className="text-dojo-gold shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-dojo-white">Requerir aceptación de alumnos</p>
            <p className="text-xs text-dojo-muted mt-0.5">
              Cuando está activo, los alumnos deben aceptar los términos antes de entrar a su portal.
            </p>
          </div>
        </div>
        <button
          onClick={() => setEnabled(v => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
            enabled ? "bg-dojo-gold" : "bg-dojo-border"
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`} />
        </button>
      </div>

      {/* Editor de contenido */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="form-label">Contenido de las políticas y términos</label>
          {data?.policy && (
            <span className="text-xs text-dojo-muted badge-blue px-2 py-0.5 rounded-full">
              Versión {version}
            </span>
          )}
        </div>
        <textarea
          className="form-input w-full font-mono text-sm leading-relaxed"
          rows={18}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={"TÉRMINOS Y CONDICIONES DEL DOJO\n\n1. INSCRIPCIÓN Y MEMBRESÍA\n...\n\n2. PAGOS\n...\n\n3. NORMAS DE CONDUCTA\n..."}
        />
        <div className="flex items-start gap-2 text-xs text-dojo-muted">
          <Info size={13} className="shrink-0 mt-0.5" />
          <span>Escribe el texto con saltos de línea para párrafos. Este contenido se mostrará exactamente como lo escribas.</span>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => save(false)}
          disabled={saving || bumping || saved}
          className="btn-primary flex items-center justify-center gap-2 flex-1"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Guardar cambios
        </button>
        <button
          onClick={() => {
            if (!confirm(
              `¿Actualizar a versión ${version + 1}?\n\nTodos los alumnos tendrán que volver a aceptar los términos aunque ya los hayan aceptado anteriormente.`
            )) return;
            save(true);
          }}
          disabled={saving || bumping || saved || !data?.policy}
          className="btn-secondary flex items-center justify-center gap-2 sm:w-auto"
          title="Incrementa la versión y obliga a todos los alumnos a re-aceptar"
        >
          {bumping ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Nueva versión (forzar re-aceptación)
        </button>
      </div>

      {data?.policy && (
        <p className="text-xs text-dojo-muted text-right">
          Última actualización: {new Date(data.policy.updatedAt).toLocaleDateString("es-PA", {
            timeZone: "America/Panama",
            day: "2-digit", month: "long", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
