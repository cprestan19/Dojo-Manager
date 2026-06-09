"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, PowerOff, Loader2, X, Check } from "lucide-react";

interface Plan {
  id:           string;
  name:         string;
  description:  string | null;
  monthlyPrice: number;
  annualPrice:  number;
  maxStudents:  number | null;
  features:     string;
  isActive:     boolean;
}

interface FormState {
  name:         string;
  description:  string;
  monthlyPrice: string;
  annualPrice:  string;
  maxStudents:  string;
  features:     string;
  isActive:     boolean;
}

const EMPTY_FORM: FormState = {
  name: "", description: "", monthlyPrice: "", annualPrice: "",
  maxStudents: "", features: "", isActive: true,
};

function planToForm(p: Plan): FormState {
  let features: string[] = [];
  try { features = JSON.parse(p.features) as string[]; } catch { /* ignore */ }
  return {
    name:         p.name,
    description:  p.description ?? "",
    monthlyPrice: String(p.monthlyPrice),
    annualPrice:  String(p.annualPrice),
    maxStudents:  p.maxStudents != null ? String(p.maxStudents) : "",
    features:     features.join("\n"),
    isActive:     p.isActive,
  };
}

export function PlanManager() {
  const [plans,   setPlans]   = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [modal,   setModal]   = useState<"new" | "edit" | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form,    setForm]    = useState<FormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/billing/plans");
      const data = await res.json() as Plan[];
      setPlans(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setModal("new");
  }

  function openEdit(p: Plan) {
    setEditing(p);
    setForm(planToForm(p));
    setError("");
    setModal("edit");
  }

  function closeModal() {
    setModal(null);
    setEditing(null);
    setError("");
  }

  async function handleDeactivate(p: Plan) {
    if (!window.confirm(`¿Desactivar el plan "${p.name}"?`)) return;
    try {
      const res = await fetch("/api/billing/plans", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: p.id }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        alert(d.error ?? "Error al desactivar");
        return;
      }
      await load();
    } catch { alert("Error de conexión"); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const featuresArr = form.features
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean);

    const payload = {
      ...(modal === "edit" && editing ? { id: editing.id } : {}),
      name:         form.name.trim(),
      description:  form.description.trim() || null,
      monthlyPrice: parseFloat(form.monthlyPrice),
      annualPrice:  parseFloat(form.annualPrice),
      maxStudents:  form.maxStudents.trim() ? parseInt(form.maxStudents, 10) : null,
      features:     featuresArr,
      isActive:     form.isActive,
    };

    if (!payload.name || isNaN(payload.monthlyPrice) || isNaN(payload.annualPrice)) {
      setError("Nombre, precio mensual y precio anual son requeridos.");
      setSaving(false);
      return;
    }
    if (payload.monthlyPrice < 0 || payload.annualPrice < 0) {
      setError("Los precios no pueden ser negativos.");
      setSaving(false);
      return;
    }

    try {
      const method = modal === "edit" ? "PATCH" : "POST";
      const res    = await fetch("/api/billing/plans", {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Error al guardar"); setSaving(false); return; }
      closeModal();
      await load();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white">Gestión de Planes</h1>
          <p className="text-dojo-muted text-sm mt-1">Administra los planes de suscripción disponibles.</p>
        </div>
        <button type="button" onClick={openNew} className="btn-primary gap-2">
          <Plus size={16} /> Nuevo plan
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dojo-border bg-dojo-darker/60">
                {["Nombre", "Mensual", "Anual", "Máx alumnos", "Features", "Activo", "Acciones"].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-dojo-muted">
                    <Loader2 size={20} className="animate-spin mx-auto" />
                  </td>
                </tr>
              ) : plans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-dojo-muted text-sm">
                    No hay planes aún.
                  </td>
                </tr>
              ) : plans.map(p => {
                let features: string[] = [];
                try { features = JSON.parse(p.features) as string[]; } catch { /* ignore */ }
                return (
                  <tr key={p.id} className="border-b border-dojo-border/50 hover:bg-dojo-border/10">
                    <td className="px-4 py-3 font-semibold text-dojo-white">{p.name}</td>
                    <td className="px-4 py-3 text-dojo-muted">${p.monthlyPrice.toFixed(0)}/mes</td>
                    <td className="px-4 py-3 text-dojo-muted">${p.annualPrice.toFixed(0)}/año</td>
                    <td className="px-4 py-3 text-dojo-muted">
                      {p.maxStudents != null ? p.maxStudents : "Ilimitado"}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <ul className="space-y-0.5">
                        {features.slice(0, 3).map((f, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-xs text-dojo-muted">
                            <span className="text-green-400">•</span> {f}
                          </li>
                        ))}
                        {features.length > 3 && (
                          <li className="text-xs text-dojo-muted/60">+{features.length - 3} más</li>
                        )}
                      </ul>
                    </td>
                    <td className="px-4 py-3">
                      {p.isActive
                        ? <span className="badge-green flex items-center gap-1 w-fit"><Check size={10} />Activo</span>
                        : <span className="badge-red w-fit">Inactivo</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="btn-ghost text-xs px-2 py-1 gap-1"
                        >
                          <Edit2 size={12} /> Editar
                        </button>
                        {p.isActive && (
                          <button
                            type="button"
                            onClick={() => void handleDeactivate(p)}
                            className="btn-ghost text-xs px-2 py-1 gap-1 text-amber-400 hover:text-amber-300"
                          >
                            <PowerOff size={12} /> Desactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-dojo-dark border border-dojo-border rounded-2xl w-full max-w-lg shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-dojo-border">
              <h2 className="font-display font-bold text-dojo-white text-lg">
                {modal === "new" ? "Nuevo plan" : `Editar — ${editing?.name}`}
              </h2>
              <button type="button" onClick={closeModal} className="text-dojo-muted hover:text-dojo-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={e => void handleSubmit(e)} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && (
                <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div>
                <label className="form-label">Nombre <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="form-input"
                  placeholder="Pro, Starter, Enterprise…"
                  required
                />
              </div>

              <div>
                <label className="form-label">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="form-input resize-none"
                  rows={2}
                  placeholder="Descripción breve del plan (opcional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Precio mensual (USD) <span className="text-red-400">*</span></label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.monthlyPrice}
                    onChange={e => setForm(f => ({ ...f, monthlyPrice: e.target.value }))}
                    className="form-input"
                    placeholder="39"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Precio anual (USD) <span className="text-red-400">*</span></label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.annualPrice}
                    onChange={e => setForm(f => ({ ...f, annualPrice: e.target.value }))}
                    className="form-input"
                    placeholder="390"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Máximo de alumnos</label>
                <input
                  type="number"
                  min="1"
                  value={form.maxStudents}
                  onChange={e => setForm(f => ({ ...f, maxStudents: e.target.value }))}
                  className="form-input"
                  placeholder="Vacío = ilimitado"
                />
              </div>

              <div>
                <label className="form-label">Features (una por línea)</label>
                <textarea
                  value={form.features}
                  onChange={e => setForm(f => ({ ...f, features: e.target.value }))}
                  className="form-input resize-none"
                  rows={5}
                  placeholder={"Alumnos ilimitados\nPortal de padres\nAsistencia QR\nReportes"}
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-dojo-red"
                />
                <label htmlFor="isActive" className="form-label mb-0 cursor-pointer">Plan activo</label>
              </div>

              <div className="flex gap-3 pt-2 border-t border-dojo-border">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 justify-center disabled:opacity-50"
                >
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : "Guardar"}
                </button>
                <button type="button" onClick={closeModal} className="btn-secondary flex-1 justify-center">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
