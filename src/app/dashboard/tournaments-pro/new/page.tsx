"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, ArrowLeft } from "lucide-react";

export default function NewTournamentPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    date: "",
    location: "",
    organization: "",
    leader1: "",
    leader2: "",
    leader3: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim() || !form.date || !form.location.trim() || !form.organization.trim() || !form.leader1.trim()) {
      setError("Por favor completa todos los campos obligatorios.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          date: form.date,
          location: form.location.trim(),
          organization: form.organization.trim(),
          leader1: form.leader1.trim(),
          leader2: form.leader2.trim() || undefined,
          leader3: form.leader3.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al crear el torneo");
        return;
      }

      router.replace(`/dashboard/tournaments-pro/${data.id}`);
    } catch {
      setError("Error de conexión. Por favor intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-dojo-border transition-colors"
        >
          <ArrowLeft size={18} className="text-dojo-muted" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-dojo-gold/10 flex items-center justify-center">
            <Trophy className="text-dojo-gold" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dojo-white">Nuevo Torneo</h1>
            <p className="text-xs text-dojo-muted">Registra un nuevo torneo</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        {error && (
          <div className="bg-dojo-red/10 border border-dojo-red/30 rounded-lg px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="form-label">
              Nombre del Torneo <span className="text-dojo-red">*</span>
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="form-input"
              placeholder="Ej. Torneo Intercolegial de Karate 2025"
              required
            />
          </div>

          <div>
            <label className="form-label">
              Fecha <span className="text-dojo-red">*</span>
            </label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>

          <div>
            <label className="form-label">
              Lugar <span className="text-dojo-red">*</span>
            </label>
            <input
              name="location"
              value={form.location}
              onChange={handleChange}
              className="form-input"
              placeholder="Ciudad, Recinto o Gimnasio"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="form-label">
              Organización <span className="text-dojo-red">*</span>
            </label>
            <input
              name="organization"
              value={form.organization}
              onChange={handleChange}
              className="form-input"
              placeholder="Ej. FEPAKA, RYOBUKAI, etc."
              required
            />
          </div>

          <div>
            <label className="form-label">
              Líder 1 <span className="text-dojo-red">*</span>
            </label>
            <input
              name="leader1"
              value={form.leader1}
              onChange={handleChange}
              className="form-input"
              placeholder="Nombre del líder principal"
              required
            />
          </div>

          <div>
            <label className="form-label">Líder 2 (opcional)</label>
            <input
              name="leader2"
              value={form.leader2}
              onChange={handleChange}
              className="form-input"
              placeholder="Nombre del segundo líder"
            />
          </div>

          <div>
            <label className="form-label">Líder 3 (opcional)</label>
            <input
              name="leader3"
              value={form.leader3}
              onChange={handleChange}
              className="form-input"
              placeholder="Nombre del tercer líder"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary flex-1"
            disabled={saving}
          >
            Cancelar
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={saving}>
            {saving ? "Guardando..." : "Crear Torneo"}
          </button>
        </div>
      </form>
    </div>
  );
}
