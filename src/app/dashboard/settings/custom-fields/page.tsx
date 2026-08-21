"use client";
import { useState, useEffect, useCallback } from "react";
import { IdCard, Loader2, Plus, Trash2, Power, AlertTriangle, ChevronRight } from "lucide-react";
import { MAX_STUDENT_CUSTOM_FIELDS } from "@/lib/utils";
import { useDojo } from "@/lib/hooks/useDojo";
import { useAppContext } from "@/lib/context/AppContext";

interface CustomField {
  id: string;
  label: string;
  order: number;
  active: boolean;
}

export default function CustomFieldsPage() {
  const dojo = useDojo();
  const { refreshDojo } = useAppContext();
  const [fields,  setFields]  = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [confirmDelete, setConfirmDelete] = useState<CustomField | null>(null);

  // Predefinidos (FEPAKA/Ryo Bukai) — ocultos por defecto para que un dojo
  // nuevo (o cualquiera probando el producto) vea esta pantalla como un
  // sistema de campos genérico, no como algo hecho a la medida de esas dos
  // federaciones puntuales. Solo se despliegan solos si el dojo ya los usa.
  const [orgExpanded, setOrgExpanded] = useState(false);
  const [orgSaving,   setOrgSaving]   = useState<"fepaka" | "ryoBukai" | null>(null);
  useEffect(() => {
    if (dojo && (dojo.showFepakaField || dojo.showRyoBukaiField)) setOrgExpanded(true);
  }, [dojo]);

  async function toggleOrgField(field: "showFepakaField" | "showRyoBukaiField", value: boolean) {
    setOrgSaving(field === "showFepakaField" ? "fepaka" : "ryoBukai");
    try {
      const res = await fetch("/api/dojo", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) refreshDojo();
    } finally { setOrgSaving(null); }
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/student-custom-fields");
    if (res.ok) setFields(await res.json() as CustomField[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addField() {
    setError("");
    const label = newLabel.trim();
    if (!label) { setError("Escribe un nombre para el campo"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/student-custom-fields", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const d = await res.json() as CustomField & { error?: string };
      if (!res.ok) { setError(d.error ?? "Error al agregar"); return; }
      setFields(prev => [...prev, d]);
      setNewLabel("");
    } finally { setSaving(false); }
  }

  async function toggleActive(field: CustomField) {
    const res = await fetch(`/api/student-custom-fields/${field.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !field.active }),
    });
    if (res.ok) setFields(prev => prev.map(f => f.id === field.id ? { ...f, active: !field.active } : f));
  }

  async function deleteField(field: CustomField) {
    const res = await fetch(`/api/student-custom-fields/${field.id}`, { method: "DELETE" });
    if (res.ok) { setFields(prev => prev.filter(f => f.id !== field.id)); setConfirmDelete(null); }
  }

  const atLimit = fields.length >= MAX_STUDENT_CUSTOM_FIELDS;

  if (loading) return <div className="p-6 flex justify-center"><Loader2 size={24} className="animate-spin text-dojo-gold" /></div>;

  return (
    <div className="p-6 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-display font-bold text-dojo-white flex items-center gap-2">
          <IdCard size={20} className="text-dojo-red" /> Campos Personalizados
        </h1>
        <p className="text-sm text-dojo-muted mt-1">
          Agrega el ID de la organización, federación o competencia que use tu dojo — cada dojo define los suyos.
        </p>
      </div>

      {/* Predefinidos (FEPAKA / Ryo Bukai) — colapsados salvo que el dojo ya los use */}
      {orgExpanded ? (
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-dojo-white">Campos predefinidos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-3 p-3 bg-dojo-dark rounded-lg border border-dojo-border cursor-pointer">
              <input
                type="checkbox"
                checked={!!dojo?.showFepakaField}
                disabled={orgSaving === "fepaka"}
                onChange={e => toggleOrgField("showFepakaField", e.target.checked)}
                className="w-4 h-4 accent-dojo-red shrink-0"
              />
              <span className="text-sm text-dojo-white font-medium">Código Fepaka</span>
            </label>
            <label className="flex items-center gap-3 p-3 bg-dojo-dark rounded-lg border border-dojo-border cursor-pointer">
              <input
                type="checkbox"
                checked={!!dojo?.showRyoBukaiField}
                disabled={orgSaving === "ryoBukai"}
                onChange={e => toggleOrgField("showRyoBukaiField", e.target.checked)}
                className="w-4 h-4 accent-dojo-red shrink-0"
              />
              <span className="text-sm text-dojo-white font-medium">Pasaporte Ryo Bukai</span>
            </label>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOrgExpanded(true)}
          className="text-xs text-dojo-muted hover:text-dojo-gold transition-colors flex items-center gap-1"
        >
          <ChevronRight size={13} /> ¿Tu organización es FEPAKA o Ryo Bukai? Actívalo aquí
        </button>
      )}

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-dojo-white">Campos del dojo</h2>
          <span className={`text-xs font-medium ${atLimit ? "text-orange-400" : "text-dojo-muted"}`}>
            {fields.length} / {MAX_STUDENT_CUSTOM_FIELDS}
          </span>
        </div>

        {error && <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-2">
          {fields.map(f => (
            <div key={f.id} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${f.active ? "bg-green-400" : "bg-dojo-border"}`} title={f.active ? "Activo" : "Desactivado"} />
              <span className="text-sm text-dojo-white flex-1 min-w-0 truncate">{f.label}</span>
              <button onClick={() => toggleActive(f)} className="p-1.5 rounded-lg text-dojo-muted hover:text-dojo-white hover:bg-dojo-border/40 transition-colors" title={f.active ? "Desactivar" : "Activar"}>
                <Power size={14} className={f.active ? "text-green-400" : ""} />
              </button>
              <button onClick={() => setConfirmDelete(f)} className="p-1.5 rounded-lg text-dojo-muted hover:text-red-400 hover:bg-red-900/20 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {fields.length === 0 && <p className="text-sm text-dojo-muted">Todavía no hay campos personalizados.</p>}
        </div>

        {!atLimit ? (
          <div className="flex gap-2 pt-2 border-t border-dojo-border">
            <input
              className="form-input text-sm flex-1"
              placeholder='Nombre del campo (ej. "ID Federación Nacional")'
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addField(); }}
              maxLength={60}
            />
            <button onClick={addField} disabled={saving} className="btn-secondary text-sm shrink-0 flex items-center gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Agregar
            </button>
          </div>
        ) : (
          <p className="text-xs text-orange-400 pt-2 border-t border-dojo-border">
            Llegaste al máximo de {MAX_STUDENT_CUSTOM_FIELDS} campos. Desactiva o elimina uno para agregar otro.
          </p>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dojo-dark border border-dojo-border rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-dojo-red/10 flex items-center justify-center">
                <AlertTriangle size={20} className="text-dojo-red" />
              </div>
              <div>
                <p className="font-semibold text-dojo-white">Eliminar campo</p>
                <p className="text-xs text-dojo-muted">Se borran también los valores guardados de cada alumno para &quot;{confirmDelete.label}&quot;</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={() => deleteField(confirmDelete)} className="flex-1 text-sm bg-dojo-red hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
