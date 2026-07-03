"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Save, Loader2, ImagePlus, X } from "lucide-react";

export default function EditPostulacionPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  const [title,         setTitle]         = useState("");
  const [location,      setLocation]      = useState("");
  const [examDate,      setExamDate]      = useState("");
  const [examTime,      setExamTime]      = useState("");
  const [deadline,      setDeadline]      = useState("");
  const [amount,        setAmount]        = useState(0);
  const [description,   setDescription]   = useState("");
  const [imageUrl,      setImageUrl]      = useState<string | null>(null);
  const [imagePublicId, setImagePublicId] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/exam-applications/${id}`);
      if (!res.ok) { setError("No se pudo cargar la postulación"); return; }
      const data = await res.json() as {
        title: string; location: string; examDate: string; examTime: string;
        deadline: string | null; amount: number; description: string | null;
        imageUrl: string | null; imagePublicId: string | null;
      };
      setTitle(data.title);
      setLocation(data.location);
      setExamDate(data.examDate.slice(0, 10));
      setExamTime(data.examTime);
      setDeadline(data.deadline ? data.deadline.slice(0, 10) : "");
      setAmount(data.amount);
      setDescription(data.description ?? "");
      setImageUrl(data.imageUrl ?? null);
      setImagePublicId(data.imagePublicId ?? null);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleImageUpload(file: File) {
    setImageUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", "image");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (res.ok) {
        const d = await res.json() as { url: string; publicId: string };
        setImageUrl(d.url);
        setImagePublicId(d.publicId);
      } else {
        setError("No se pudo subir la imagen");
      }
    } finally { setImageUploading(false); }
  }

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
          title:        title.trim(),
          location:     location.trim(),
          examDate,
          examTime:     examTime.trim(),
          deadline:     deadline || null,
          amount,
          description:  description.trim() || null,
          imageUrl,
          imagePublicId,
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

        {/* Imagen para alumnos */}
        <div>
          <label className="form-label">Imagen informativa (opcional)</label>
          <p className="text-xs text-dojo-muted mb-2">Solo la verán los alumnos postulados en su portal.</p>
          {imageUrl ? (
            <div className="relative inline-block">
              <img src={imageUrl} alt="Imagen postulación" className="rounded-xl max-h-48 object-cover border border-dojo-border" />
              <button
                type="button"
                onClick={() => { setImageUrl(null); setImagePublicId(null); }}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-dojo-red flex items-center justify-center shadow-lg hover:bg-red-700 transition-colors"
              >
                <X size={12} className="text-white" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={imageUploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-dojo-border hover:border-dojo-gold/50 text-dojo-muted hover:text-dojo-gold transition-colors text-sm"
            >
              {imageUploading
                ? <><Loader2 size={15} className="animate-spin" /> Subiendo...</>
                : <><ImagePlus size={15} /> Subir imagen</>}
            </button>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }}
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
