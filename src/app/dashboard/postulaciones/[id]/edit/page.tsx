"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Save, Loader2 } from "lucide-react";

export default function EditPostulacionPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  const [title,       setTitle]       = useState("");
  const [location,    setLocation]    = useState("");
  const [examDate,    setExamDate]    = useState("");
  const [examTime,    setExamTime]    = useState("");
  const [deadline,    setDeadline]    = useState("");
  const [amount,      setAmount]      = useState(0);
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/exam-applications/${id}`);
      if (!res.ok) { setError("No se pudo cargar la postulación"); return; }
      const data = await res.json() as {
        title: string; location: string; examDate: string; examTime: string;
        deadline: string | null; amount: number; description: string | null;
      };
      setTitle(data.title);
      setLocation(data.location);
      setExamDate(data.examDate.slice(0, 10));
      setExamTime(data.examTime);
      setDeadline(data.deadline ? data.deadline.slice(0, 10) : "");
      setAmount(data.amount);
      setDescription(data.description ?? "");
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setError("");
    if (!title.trim())    { setError("El nombre es requerido."); return; }
    if (!location.trim()) { setError("El lugar es requerido."); return; }
    if (!examDate)        { setError("La fecha es requerida."); return; }
    if (!examTime.trim()) { setError("La hora es requerida."); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/exam-applications/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:       title.trim(),
          location:    location.trim(),
          examDate,
          examTime:    examTime.trim(),
          deadline:    deadline || null,
          amount,
          description: description.trim() || null,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Error al guardar"); return; }
      router.replace(`/dashboard/postulaciones/${id}`);
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 size={24} className="animate-spin text-dojo-gold" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="btn-ghost p-2">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-display font-bold text-dojo-white">Editar Postulación</h1>
          <p className="text-dojo-muted text-sm">Modifica los datos del evento</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-800/50 rounded-lg p-3 text-red-400 text-sm">{error}</div>
      )}

      <div className="card space-y-4">
        <div>
          <label className="form-label">Nombre del evento *</label>
          <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Lugar *</label>
          <input className="form-input" value={location} onChange={e => setLocation(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Fecha *</label>
            <input type="date" className="form-input" value={examDate} onChange={e => setExamDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Hora *</label>
            <input type="time" className="form-input" value={examTime} onChange={e => setExamTime(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Fecha límite de respuesta</label>
            <input type="date" className="form-input" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Valor a pagar ($)</label>
            <input
              type="number" min={0} step={0.01} className="form-input"
              value={amount}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <div>
          <label className="form-label">Descripción (opcional)</label>
          <textarea
            className="form-input min-h-24 resize-y"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-dojo-border">
          <button onClick={() => router.back()} className="btn-secondary text-sm">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
