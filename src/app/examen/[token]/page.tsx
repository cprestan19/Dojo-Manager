"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, Loader2, CheckCircle2, Lock, Circle } from "lucide-react";
import { getBeltInfo, formatDate } from "@/lib/utils";

interface Criteria { id: string; name: string; weightPct: number; order: number }
interface ScoreEntry { criteriaId: string; value: number; note: string | null }
interface StudentRow {
  inviteeId:     string;
  studentId:     string;
  fullName:      string;
  photo:         string | null;
  beltToPresent: string;
  scores:        ScoreEntry[];
}
interface ExamData {
  evaluatorName:     string;
  active:            boolean;
  confirmed:         boolean;
  applicationTitle:  string;
  applicationStatus: string;
  dojoName:          string;
  examDate:          string;
  examTime:          string;
  location:          string;
  criteria:          Criteria[];
  students:          StudentRow[];
}

const SCALE = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

export default function ExamEvaluatorPage() {
  const { token } = useParams<{ token: string }>();

  const [data,        setData]        = useState<ExamData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [confirming,  setConfirming]  = useState(false);
  const [confirmedLocal, setConfirmedLocal] = useState(false);
  const [openStudent, setOpenStudent] = useState<string | null>(null);
  const [saving,      setSaving]      = useState<string | null>(null); // `${inviteeId}_${criteriaId}`
  const [noteOpen,    setNoteOpen]    = useState<string | null>(null);
  const [noteDraft,   setNoteDraft]   = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/exam/${token}`);
      const d = await res.json() as ExamData | { error: string };
      if (!res.ok) { setError((d as { error: string }).error ?? "Link no válido"); return; }
      setData(d as ExamData);
    } catch {
      setError("No se pudo cargar el examen. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleConfirm() {
    setConfirming(true);
    try {
      const res = await fetch(`/api/public/exam/${token}/confirm`, { method: "POST" });
      if (res.ok) setConfirmedLocal(true);
      else { const d = await res.json() as { error?: string }; setError(d.error ?? "Error al confirmar"); }
    } finally {
      setConfirming(false);
    }
  }

  async function saveScore(inviteeId: string, criteriaId: string, value: number, note: string | null) {
    const key = `${inviteeId}_${criteriaId}`;
    setSaving(key);
    try {
      const res = await fetch(`/api/public/exam/${token}/score`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ inviteeId, criteriaId, value, note }),
      });
      if (res.ok && data) {
        setData({
          ...data,
          students: data.students.map(s => s.inviteeId !== inviteeId ? s : {
            ...s,
            scores: [...s.scores.filter(sc => sc.criteriaId !== criteriaId), { criteriaId, value, note }],
          }),
        });
      }
    } finally {
      setSaving(null);
      setNoteOpen(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-dojo-darker flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-dojo-gold" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-dojo-darker flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-bold text-dojo-white font-display">Enlace no disponible</h1>
          <p className="text-dojo-muted text-sm">{error || "Este enlace no es válido."}</p>
        </div>
      </main>
    );
  }

  if (!data.active) {
    return (
      <main className="min-h-screen bg-dojo-darker flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-sm">
          <Lock size={40} className="mx-auto text-dojo-muted" />
          <h1 className="text-xl font-bold text-dojo-white font-display">Examen cerrado</h1>
          <p className="text-dojo-muted text-sm">
            &quot;{data.applicationTitle}&quot; ya fue finalizado. Si necesitas corregir una nota, pide al administrador que reabra el examen.
          </p>
        </div>
      </main>
    );
  }

  const isConfirmed = data.confirmed || confirmedLocal;

  if (!isConfirmed) {
    return (
      <main className="min-h-screen bg-dojo-darker flex items-center justify-center p-4">
        <div className="card max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-dojo-gold/10 flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} className="text-dojo-gold" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-dojo-white font-display">{data.applicationTitle}</h1>
            <p className="text-sm text-dojo-muted">{data.dojoName} · 📅 {formatDate(data.examDate)} {data.examTime}</p>
          </div>
          <p className="text-dojo-white">
            ¿Eres <span className="font-bold text-dojo-gold">{data.evaluatorName}</span>?
          </p>
          <button onClick={handleConfirm} disabled={confirming} className="btn-primary w-full flex items-center justify-center gap-2">
            {confirming ? <Loader2 size={16} className="animate-spin" /> : "Sí, continuar"}
          </button>
        </div>
      </main>
    );
  }

  // ── Detalle de un alumno: calificar por criterio ──────────────────────
  const current = data.students.find(s => s.inviteeId === openStudent);
  if (current) {
    return (
      <main className="min-h-screen bg-dojo-darker pb-10">
        <div className="sticky top-0 z-10 bg-dojo-darker/95 backdrop-blur border-b border-dojo-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => setOpenStudent(null)} className="p-1.5 -ml-1.5 rounded-lg text-dojo-muted hover:text-dojo-white">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-dojo-white truncate">{current.fullName}</p>
            <p className="text-xs text-dojo-muted">{getBeltInfo(current.beltToPresent).label}</p>
          </div>
        </div>

        <div className="p-4 space-y-4 max-w-md mx-auto">
          {data.criteria.map(c => {
            const existing = current.scores.find(s => s.criteriaId === c.id);
            const key = `${current.inviteeId}_${c.id}`;
            const isSaving = saving === key;
            const noteKey = key;
            return (
              <div key={c.id} className="card space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-dojo-white">{c.name}</p>
                  <span className="text-xs text-dojo-muted">peso {c.weightPct}%</span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {SCALE.map(v => (
                    <button
                      key={v}
                      onClick={() => saveScore(current.inviteeId, c.id, v, existing?.note ?? null)}
                      disabled={isSaving}
                      className={`aspect-square rounded-lg text-sm font-bold transition-colors ${
                        existing?.value === v
                          ? "bg-dojo-gold text-black"
                          : "bg-dojo-border/40 text-dojo-white hover:bg-dojo-border"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                {existing != null && (
                  <p className="flex items-center gap-1.5 text-xs text-green-400">
                    <CheckCircle2 size={12} /> Guardado{isSaving ? "..." : ""}
                  </p>
                )}
                {noteOpen === noteKey ? (
                  <div className="space-y-2">
                    <textarea
                      className="form-input text-sm"
                      rows={2}
                      placeholder="Observación (opcional)"
                      value={noteDraft}
                      onChange={e => setNoteDraft(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { if (existing) saveScore(current.inviteeId, c.id, existing.value, noteDraft.trim() || null); }}
                        disabled={existing == null}
                        className="btn-secondary text-xs flex-1"
                      >
                        Guardar nota
                      </button>
                      <button onClick={() => setNoteOpen(null)} className="btn-ghost text-xs">Cerrar</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setNoteOpen(noteKey); setNoteDraft(existing?.note ?? ""); }}
                    className="text-xs text-dojo-muted hover:text-dojo-gold transition-colors"
                  >
                    {existing?.note ? `📝 ${existing.note}` : "+ Agregar observación"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>
    );
  }

  // ── Lista de alumnos confirmados ───────────────────────────────────────
  return (
    <main className="min-h-screen bg-dojo-darker pb-10">
      <div className="sticky top-0 z-10 bg-dojo-darker/95 backdrop-blur border-b border-dojo-border px-4 py-3">
        <p className="font-bold text-dojo-white">{data.applicationTitle}</p>
        <p className="text-xs text-dojo-muted">Evaluando como <span className="text-dojo-gold font-medium">{data.evaluatorName}</span></p>
      </div>

      <div className="p-4 space-y-2 max-w-md mx-auto">
        {data.criteria.length === 0 && (
          <p className="text-center text-dojo-muted text-sm py-8">
            El administrador todavía no configuró los criterios de este examen.
          </p>
        )}
        {data.students.length === 0 && data.criteria.length > 0 && (
          <p className="text-center text-dojo-muted text-sm py-8">No hay alumnos confirmados todavía.</p>
        )}
        {data.students.map(s => {
          const done = s.scores.length;
          const total = data.criteria.length;
          const beltInfo = getBeltInfo(s.beltToPresent);
          return (
            <button
              key={s.inviteeId}
              onClick={() => setOpenStudent(s.inviteeId)}
              className="w-full card flex items-center gap-3 text-left hover:border-dojo-gold/40 transition-colors"
            >
              {s.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.photo} alt={s.fullName} className="w-11 h-11 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-dojo-border/50 flex items-center justify-center text-dojo-muted text-sm font-bold shrink-0">
                  {s.fullName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-dojo-white truncate">{s.fullName}</p>
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: beltInfo.hex + "30", color: beltInfo.hex === "#FFFFFF" ? "#aaa" : beltInfo.hex }}>
                  {beltInfo.label}
                </span>
              </div>
              <div className="shrink-0 flex items-center gap-1.5 text-xs">
                {done === total && total > 0
                  ? <CheckCircle2 size={16} className="text-green-400" />
                  : <Circle size={16} className="text-dojo-muted" />}
                <span className={done === total && total > 0 ? "text-green-400" : "text-dojo-muted"}>{done}/{total}</span>
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
}
