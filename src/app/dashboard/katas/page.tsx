"use client";
import { useState, useEffect, useCallback } from "react";
import { BookOpen, Plus, Edit2, Trash2, Save, X } from "lucide-react";
import { BeltBadge } from "@/components/ui/BeltBadge";
import { Modal } from "@/components/ui/Modal";
import { BELT_COLORS } from "@/lib/utils";

interface Kata {
  id: string; name: string; beltColor: string;
  order: number; description: string | null; active: boolean;
}

const empty = (): Partial<Kata> => ({ name: "", beltColor: "blanca", order: 0, description: "" });

export default function KatasPage() {
  const [katas,   setKatas]   = useState<Kata[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState<Partial<Kata>>(empty());
  const [saving,  setSaving]  = useState(false);
  const [deleting, setDel]    = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/katas");
    if (r.ok) setKatas(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  function openCreate() { setEditing(empty()); setModal(true); }
  function openEdit(k: Kata) { setEditing({ ...k }); setModal(true); }

  async function save() {
    setSaving(true);
    const isEdit = Boolean(editing.id);
    const url    = isEdit ? `/api/katas/${editing.id}` : "/api/katas";
    const method = isEdit ? "PUT" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    setModal(false);
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

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
            <BookOpen size={24} className="text-dojo-red" /> Catálogo de Katas
          </h1>
          <p className="text-dojo-muted text-sm mt-1">{katas.length} katas registrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18}/> Nuevo Kata
        </button>
      </div>

      {loading && <div className="text-center py-20 text-dojo-muted">Cargando...</div>}

      {/* Grouped by belt */}
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
                {list.map((k) => (
                  <tr key={k.id} className="border-b border-dojo-border/40 hover:bg-dojo-border/10 last:border-0">
                    <td className="px-5 py-3 w-10 text-dojo-muted text-center">{k.order}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-dojo-white">{k.name}</p>
                      {k.description && <p className="text-xs text-dojo-muted">{k.description}</p>}
                    </td>
                    <td className="px-4 py-3"><BeltBadge beltColor={k.beltColor} /></td>
                    <td className="px-4 py-3">
                      <span className={k.active ? "badge-green" : "badge-red"}>
                        {k.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(k)} className="btn-ghost p-1.5 text-dojo-muted hover:text-dojo-white">
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
          <p>No hay katas registrados.</p>
          <p className="text-sm mt-1">Crea el primer kata o ejecuta el seed inicial.</p>
        </div>
      )}

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? "Editar Kata" : "Nuevo Kata"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label">Nombre del Kata *</label>
              <input
                value={editing.name ?? ""}
                onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                className="form-input" placeholder="Ej. Heian Shodan"
              />
            </div>
            <div>
              <label className="form-label">Cinta Requerida *</label>
              <select
                value={editing.beltColor ?? "blanca"}
                onChange={e => setEditing(p => ({ ...p, beltColor: e.target.value }))}
                className="form-input"
              >
                {BELT_COLORS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Orden (para lista)</label>
              <input
                type="number"
                value={editing.order ?? 0}
                onChange={e => setEditing(p => ({ ...p, order: Number(e.target.value) }))}
                className="form-input"
              />
            </div>
            <div className="col-span-2">
              <label className="form-label">Descripción</label>
              <textarea
                value={editing.description ?? ""}
                onChange={e => setEditing(p => ({ ...p, description: e.target.value }))}
                className="form-input min-h-[70px] resize-none"
                placeholder="Descripción breve del kata..."
              />
            </div>
            {editing.id && (
              <div className="col-span-2 flex items-center gap-3 p-3 bg-dojo-dark rounded-lg border border-dojo-border">
                <input type="checkbox" id="active" checked={editing.active ?? true}
                  onChange={e => setEditing(p => ({ ...p, active: e.target.checked }))}
                  className="w-4 h-4 accent-dojo-red" />
                <label htmlFor="active" className="text-sm text-dojo-white cursor-pointer">Kata activo</label>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">
              <X size={16}/> Cancelar
            </button>
            <button type="button" onClick={save} disabled={saving || !editing.name} className="btn-primary">
              <Save size={16}/> {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
