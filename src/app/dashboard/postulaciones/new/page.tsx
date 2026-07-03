"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { BELT_COLORS, getBeltInfo } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Save, Loader2, Search, ImagePlus, X } from "lucide-react";

interface StudentOption {
  id:          string;
  fullName:    string;
  studentCode: number | null;
  beltHistory: { beltColor: string }[];
}

interface InviteeSelection {
  studentId:     string;
  beltToPresent: string;
}

export default function NewPostulacionPage() {
  const router = useRouter();

  // Step 1 fields
  const [step, setStep]               = useState(1);
  const [title, setTitle]             = useState("");
  const [location, setLocation]       = useState("");
  const [examDate, setExamDate]       = useState("");
  const [examTime, setExamTime]       = useState("");
  const [deadline, setDeadline]       = useState("");
  const [amount, setAmount]           = useState(0);
  const [description, setDescription] = useState("");
  const [imageUrl,      setImageUrl]      = useState<string | null>(null);
  const [imagePublicId, setImagePublicId] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Step 2 fields
  const [students, setStudents]         = useState<StudentOption[]>([]);
  const [search, setSearch]             = useState("");
  const [selected, setSelected]         = useState<Map<string, InviteeSelection>>(new Map());
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  // Filtro client-side
  const filtered = students.filter(s =>
    s.fullName.toLowerCase().includes(search.toLowerCase()) ||
    String(s.studentCode ?? "").includes(search)
  );

  function validateStep1(): boolean {
    if (!title.trim())    { setError("El nombre del evento es requerido."); return false; }
    if (!location.trim()) { setError("El lugar es requerido."); return false; }
    if (!examDate)        { setError("La fecha es requerida."); return false; }
    if (!examTime.trim()) { setError("La hora es requerida."); return false; }
    return true;
  }

  function goStep2() {
    setError("");
    if (!validateStep1()) return;
    setStep(2);
    if (students.length === 0) loadStudents();
  }

  async function loadStudents() {
    setLoadingStudents(true);
    try {
      const res = await fetch("/api/students?active=true&limit=500");
      if (res.ok) {
        const data = await res.json() as { students?: StudentOption[] } | StudentOption[];
        const list = Array.isArray(data) ? data : (data as { students?: StudentOption[] }).students ?? [];
        setStudents(list);
      }
    } finally {
      setLoadingStudents(false);
    }
  }

  function toggleStudent(student: StudentOption) {
    const next = new Map(selected);
    if (next.has(student.id)) {
      next.delete(student.id);
    } else {
      const currentBelt = student.beltHistory[0]?.beltColor ?? "blanca";
      next.set(student.id, { studentId: student.id, beltToPresent: currentBelt });
    }
    setSelected(next);
  }

  function setBelt(studentId: string, beltToPresent: string) {
    const next = new Map(selected);
    const inv  = next.get(studentId);
    if (inv) next.set(studentId, { ...inv, beltToPresent });
    setSelected(next);
  }

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

  async function handleSave(publish: boolean) {
    setError("");
    setSaving(true);
    try {
      const invitees = Array.from(selected.values());
      const res = await fetch("/api/exam-applications", {
        method: "POST",
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
          invitees,
        }),
      });
      const data = await res.json() as { id?: string; error?: string };
      if (!res.ok) { setError(data.error ?? "Error al guardar"); return; }

      if (publish && data.id) {
        await fetch(`/api/exam-applications/${data.id}/publish`, { method: "POST" });
      }

      router.push(`/dashboard/postulaciones/${data.id}`);
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header con pasos */}
      <div className="flex items-center gap-4">
        <button onClick={() => step === 1 ? router.back() : setStep(1)} className="btn-ghost p-2">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-display font-bold text-dojo-white">Nueva Postulación</h1>
          <p className="text-dojo-muted text-sm">Paso {step} de 2</p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="flex gap-2">
        {[1, 2].map(s => (
          <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s <= step ? "bg-dojo-gold" : "bg-dojo-border"}`} />
        ))}
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-800/50 rounded-lg p-3 text-red-400 text-sm">{error}</div>
      )}

      {/* Paso 1 — Datos del evento */}
      {step === 1 && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-dojo-white">Datos del evento</h2>

          <div>
            <label className="form-label">Nombre del evento *</label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Examen de Cinta Azul – Julio 2026" />
          </div>
          <div>
            <label className="form-label">Lugar *</label>
            <input className="form-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Ej: Dojo Central, Panamá" />
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
              <input type="number" min={0} step={0.01} className="form-input" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <label className="form-label">Descripción (opcional)</label>
            <textarea className="form-input min-h-24 resize-y" value={description} onChange={e => setDescription(e.target.value)} placeholder="Instrucciones, requisitos, información adicional..." />
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

          <div className="flex justify-end">
            <button onClick={goStep2} className="btn-primary flex items-center gap-2">
              Siguiente — Seleccionar Alumnos <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Paso 2 — Alumnos */}
      {step === 2 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-dojo-white">Seleccionar Alumnos</h2>
            <span className="text-sm text-dojo-muted">{selected.size} seleccionados</span>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
            <input
              className="form-input pl-9"
              placeholder="Buscar alumno por nombre o código..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loadingStudents ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-dojo-gold" />
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filtered.map(student => {
                const inv       = selected.get(student.id);
                const isChecked = !!inv;
                const beltInfo  = getBeltInfo(student.beltHistory[0]?.beltColor ?? "blanca");

                return (
                  <div key={student.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer
                    ${isChecked ? "border-dojo-gold/50 bg-dojo-gold/5" : "border-dojo-border hover:border-dojo-border/80"}`}
                    onClick={() => toggleStudent(student)}
                  >
                    <input type="checkbox" checked={isChecked} readOnly className="w-4 h-4 accent-yellow-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dojo-white truncate">{student.fullName}</p>
                      {student.studentCode && (
                        <p className="text-xs text-dojo-muted">#{student.studentCode}</p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: beltInfo.hex + "30", color: beltInfo.hex === "#FFFFFF" ? "#aaa" : beltInfo.hex }}>
                      {beltInfo.label}
                    </span>

                    {/* Dropdown de cinta cuando está seleccionado */}
                    {isChecked && (
                      <select
                        value={inv.beltToPresent}
                        onClick={e => e.stopPropagation()}
                        onChange={e => { e.stopPropagation(); setBelt(student.id, e.target.value); }}
                        className="form-input text-xs py-1 w-36 shrink-0"
                      >
                        {BELT_COLORS.map(bc => (
                          <option key={bc.value} value={bc.value}>{bc.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-center text-dojo-muted py-8">No se encontraron alumnos</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-dojo-border">
            <button onClick={() => setStep(1)} className="btn-ghost flex items-center gap-2 text-sm">
              <ChevronLeft size={16} /> Atrás
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Guardar borrador
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving || selected.size === 0}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Guardar y publicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
