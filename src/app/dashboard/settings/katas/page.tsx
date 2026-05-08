"use client";
import { useState, useEffect, useCallback } from "react";
import { BookOpen, Plus, Edit2, Trash2, Save, X, Tag } from "lucide-react";
import { BeltBadge } from "@/components/ui/BeltBadge";
import { Modal } from "@/components/ui/Modal";
import { BELT_COLORS, MULTI_KATA_BELTS } from "@/lib/utils";
import { useToast, ToastContainer } from "@/components/ui/Toast";

interface Kata {
  id: string; name: string; beltColor: string;
  order: number; description: string | null; active: boolean;
}

const KATA_TYPES = [
  { value: "",                      label: "— Sin tipo —"         },
  { value: "Kata de Cinta",         label: "Kata de Cinta"        },
  { value: "Kata de Competencias",  label: "Kata de Competencias" },
];

const MAX_MULTI = 5;
const empty = (): Partial<Kata> => ({ name: "", beltColor: "blanca", order: 0, description: "" });
const emptyNames = (): string[] => Array(MAX_MULTI).fill("");

export default function KatasSettingsPage() {
  const [katas,      setKatas]    = useState<Kata[]>([]);
  const [loading,    setLoading]  = useState(true);
  const [modal,      setModal]    = useState(false);
  const [editing,    setEditing]  = useState<Partial<Kata>>(empty());
  const [kataNames,  setNames]    = useState<string[]>(emptyNames());
  const [saving,     setSaving]   = useState(false);
  const [saveError,  setSaveErr]  = useState("");
  const [deleting,   setDel]      = useState<string | null>(null);
  const { toasts, show: showToast, dismiss } = useToast();

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/katas");
    if (r.ok) setKatas(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  function openCreate() {
    setEditing(empty());
    setNames(emptyNames());
    setSaveErr("");
    setModal(true);
  }

  function openEdit(k: Kata) {
    setEditing({ ...k });
    setNames(emptyNames());
    setSaveErr("");
    setModal(true);
  }

  // ¿Está en modo multi-creación? (crear + cinta avanzada)
  const isMultiCreate = !editing.id && MULTI_KATA_BELTS.has(editing.beltColor ?? "");

  async function save() {
    setSaving(true);
    setSaveErr("");

    let r: Response;

    if (isMultiCreate) {
      const toCreate = kataNames
        .map((name, i) => ({
          name: name.trim(),
          beltColor:   editing.beltColor!,
          order:       (editing.order ?? 0) + i,
          description: editing.description || null,
        }))
        .filter(k => k.name.length > 0);

      if (toCreate.length === 0) {
        setSaveErr("Escribe al menos un nombre de kata.");
        setSaving(false);
        return;
      }

      r = await fetch("/api/katas", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ katas: toCreate }),
      });
    } else {
      const isEdit = Boolean(editing.id);
      r = await fetch(isEdit ? `/api/katas/${editing.id}` : "/api/katas", {
        method:  isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...editing, description: editing.description || null }),
      });
    }

    setSaving(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setSaveErr((d as { error?: string }).error ?? "Error al guardar");
      return;
    }
    setModal(false);
    showToast(isMultiCreate ? "Katas creados exitosamente" : editing.id ? "Kata actualizado exitosamente" : "Kata creado exitosamente");
    fetch_();
  }

  async function deleteKata(id: string) {
    if (!confirm("¿Eliminar este kata? Esta acción no se puede deshacer.")) return;
    setDel(id);
    await fetch(`/api/katas/${id}`, { method: "DELETE" });
    setDel(null);
    fetch_();
  }

  const grouped = BELT_COLORS.reduce<Record<string, Kata[]>>((acc, b) => {
    acc[b.value] = katas.filter(k => k.beltColor === b.value);
    return acc;
  }, {});

  const totalActive   = katas.filter(k => k.active).length;
  const totalInactive = katas.filter(k => !k.active).length;

  const saveDisabled = saving || (
    isMultiCreate
      ? kataNames.every(n => !n.trim())
      : !editing.name
  );

  const beltLabel = BELT_COLORS.find(b => b.value === editing.beltColor)?.label ?? "";
  const modalTitle = editing.id
    ? "Editar Kata"
    : isMultiCreate
      ? `Nuevos Katas — Cinta ${beltLabel}`
      : "Nuevo Kata";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
            <BookOpen size={24} className="text-dojo-red" /> Creación de Katas
          </h1>
          <p className="text-dojo-muted text-sm mt-1">
            {katas.length} kata(s) en total · {totalActive} activos · {totalInactive} inactivos
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18}/> Nuevo Kata
        </button>
      </div>

      {loading && <div className="text-center py-20 text-dojo-muted">Cargando...</div>}

      {/* Agrupado por cinta */}
      {!loading && BELT_COLORS.map(belt => {
        const list = grouped[belt.value] ?? [];
        if (list.length === 0) return null;
        return (
          <div key={belt.value} className="card p-0 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-dojo-border"
              style={{ backgroundColor: belt.hex + "15" }}>
              <span className="w-3 h-3 rounded-full border border-white/30" style={{ backgroundColor: belt.hex }}/>
              <p className="font-semibold text-sm" style={{ color: belt.hex === "#FFFFFF" ? "#ccc" : belt.hex }}>
                Cinta {belt.label}
              </p>
              <span className="text-xs text-dojo-muted ml-auto">{list.length} kata(s)</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {list.map(k => (
                  <tr key={k.id} className="border-b border-dojo-border/40 hover:bg-dojo-border/10 last:border-0">
                    <td className="px-5 py-3 w-10 text-dojo-muted text-center text-xs">{k.order}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-dojo-white">{k.name}</p>
                      {k.description && (
                        <p className="text-xs text-dojo-muted flex items-center gap-1 mt-0.5">
                          <Tag size={10}/> {k.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3"><BeltBadge beltColor={k.beltColor} /></td>
                    <td className="px-4 py-3">
                      <span className={k.active ? "badge-green" : "badge-red"}>
                        {k.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(k)}
                          className="btn-ghost p-1.5 text-dojo-muted hover:text-dojo-white">
                          <Edit2 size={15}/>
                        </button>
                        <button onClick={() => deleteKata(k.id)} disabled={deleting === k.id}
                          className="btn-ghost p-1.5 text-dojo-muted hover:text-red-400">
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {!loading && katas.length === 0 && (
        <div className="text-center py-16 text-dojo-muted">
          <BookOpen size={48} className="mx-auto mb-4 opacity-30"/>
          <p className="font-semibold">No hay katas registrados.</p>
          <p className="text-sm mt-1">Crea el primer kata usando el botón "Nuevo Kata".</p>
        </div>
      )}

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={modalTitle}>
        <div className="space-y-4">

          {/* Cinta (siempre visible) */}
          <div className={editing.id ? "grid grid-cols-2 gap-4" : ""}>
            <div className={editing.id ? "" : "grid grid-cols-2 gap-4 col-span-2"}>
              <div>
                <label className="form-label">Cinta Requerida *</label>
                <select
                  value={editing.beltColor ?? "blanca"}
                  onChange={e => {
                    setEditing(p => ({ ...p, beltColor: e.target.value, name: p.name }));
                    setNames(emptyNames());
                  }}
                  className="form-input"
                >
                  {BELT_COLORS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
                {!editing.id && MULTI_KATA_BELTS.has(editing.beltColor ?? "") && (
                  <p className="text-xs text-dojo-gold mt-1">
                    Puedes registrar hasta {MAX_MULTI} katas a la vez para esta cinta.
                  </p>
                )}
              </div>

              {/* Orden inicial */}
              <div>
                <label className="form-label">
                  {isMultiCreate ? "Orden inicial" : "Orden en lista"}
                </label>
                <input
                  type="number" min={0}
                  value={editing.order ?? 0}
                  onChange={e => setEditing(p => ({ ...p, order: Number(e.target.value) }))}
                  className="form-input"
                />
                {isMultiCreate && (
                  <p className="text-xs text-dojo-muted mt-1">
                    Los katas siguientes tendrán orden +1, +2…
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Tipo de Kata (siempre visible) */}
          <div>
            <label className="form-label flex items-center gap-1.5">
              <Tag size={12}/> Tipo de Kata
            </label>
            <select
              value={editing.description ?? ""}
              onChange={e => setEditing(p => ({ ...p, description: e.target.value || null }))}
              className="form-input"
            >
              {KATA_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* ── Modo multi-creación ── */}
          {isMultiCreate ? (
            <div className="space-y-2">
              <label className="form-label">Nombres de los Katas (deja vacío los que no apliquen)</label>
              {kataNames.map((name, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-dojo-muted w-14 shrink-0">Kata {i + 1}{i === 0 ? " *" : ""}</span>
                  <input
                    value={name}
                    onChange={e => {
                      const next = [...kataNames];
                      next[i] = e.target.value;
                      setNames(next);
                    }}
                    className="form-input flex-1"
                    placeholder={i === 0 ? "Nombre obligatorio" : "Opcional"}
                  />
                </div>
              ))}
            </div>
          ) : (
            /* ── Modo single (crear o editar) ── */
            <div>
              <label className="form-label">Nombre del Kata *</label>
              <input
                value={editing.name ?? ""}
                onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                className="form-input"
                placeholder="Ej. Heian Shodan"
              />
            </div>
          )}

          {/* Activo (solo edición) */}
          {editing.id && (
            <div className="flex items-center gap-3 p-3 bg-dojo-dark rounded-lg border border-dojo-border">
              <input type="checkbox" id="active" checked={editing.active ?? true}
                onChange={e => setEditing(p => ({ ...p, active: e.target.checked }))}
                className="w-4 h-4 accent-dojo-red" />
              <label htmlFor="active" className="text-sm text-dojo-white cursor-pointer select-none">
                Kata activo (visible en catálogo y al registrar cintas)
              </label>
            </div>
          )}

          {saveError && <p className="text-red-400 text-sm">{saveError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">
              <X size={16}/> Cancelar
            </button>
            <button type="button" onClick={save} disabled={saveDisabled} className="btn-primary">
              <Save size={16}/> {saving ? "Guardando..." : isMultiCreate ? "Crear Katas" : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
