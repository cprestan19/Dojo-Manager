"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, Lock, ArrowRight, ArrowLeft, PartyPopper } from "lucide-react";
import { getBeltInfo } from "@/lib/utils";

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
  evaluatorName:   string;
  active:          boolean;
  confirmed:       boolean;
  evaluationTitle: string;
  dojoName:        string;
  criteria:        Criteria[];
  students:        StudentRow[];
}

const SCALE = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

export default function ExamEvaluatorPage() {
  const { token } = useParams<{ token: string }>();

  const [data,        setData]        = useState<ExamData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [confirming,  setConfirming]  = useState(false);
  const [confirmedLocal, setConfirmedLocal] = useState(false);
  const [activeCriteriaId, setActiveCriteriaId] = useState<string | null>(null);
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

  useEffect(() => {
    if (data && data.criteria.length > 0 && activeCriteriaId == null) {
      setActiveCriteriaId(data.criteria[0].id);
    }
  }, [data, activeCriteriaId]);

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
          <h1 className="text-xl font-bold text-dojo-white font-display">Evaluación cerrada</h1>
          <p className="text-dojo-muted text-sm">
            &quot;{data.evaluationTitle}&quot; ya fue cerrada. Si necesitas corregir una nota, pide al administrador que la reabra.
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
            <h1 className="text-lg font-bold text-dojo-white font-display">{data.evaluationTitle}</h1>
            <p className="text-sm text-dojo-muted">{data.dojoName}</p>
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

  // ── Evaluación por criterio: un criterio a la vez, todos los alumnos abajo ──
  const activeCriteria = data.criteria.find(c => c.id === activeCriteriaId) ?? data.criteria[0] ?? null;
  const activeIndex    = activeCriteria ? data.criteria.findIndex(c => c.id === activeCriteria.id) : -1;
  const nextCriteria   = activeIndex >= 0 ? data.criteria[activeIndex + 1] ?? null : null;

  function goToNextCriteria() {
    if (nextCriteria) {
      setActiveCriteriaId(nextCriteria.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <main className="min-h-screen bg-dojo-darker pb-10">
      <div className="sticky top-0 z-10 bg-dojo-darker/95 backdrop-blur border-b border-dojo-border px-4 py-3">
        <p className="font-bold text-dojo-white truncate">{data.evaluationTitle}</p>
        <p className="text-xs text-dojo-muted">Evaluando como <span className="text-dojo-gold font-medium">{data.evaluatorName}</span></p>

        {data.criteria.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto mt-3 pb-1 -mx-1 px-1">
            {data.criteria.map(c => {
              const done = data.students.filter(s => s.scores.some(sc => sc.criteriaId === c.id)).length;
              const isActive = activeCriteria?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCriteriaId(c.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    isActive ? "bg-dojo-gold text-black" : "bg-dojo-border/40 text-dojo-white hover:bg-dojo-border"
                  }`}
                >
                  {c.name} · {done}/{data.students.length}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 space-y-3 max-w-md mx-auto">
        {data.criteria.length === 0 && (
          <p className="text-center text-dojo-muted text-sm py-8">
            El administrador todavía no configuró los criterios de este examen.
          </p>
        )}
        {data.students.length === 0 && data.criteria.length > 0 && (
          <p className="text-center text-dojo-muted text-sm py-8">No hay alumnos confirmados todavía.</p>
        )}

        {activeCriteria && data.students.length > 0 && (
          <div className="card bg-dojo-gold/5 border-dojo-gold/30 flex items-center justify-between">
            <p className="font-bold text-dojo-white">{activeCriteria.name}</p>
            <span className="text-xs text-dojo-muted">peso {activeCriteria.weightPct}%</span>
          </div>
        )}

        {activeCriteria && data.students.length > 0 && (
          <div className="rounded-xl border border-dojo-border divide-y divide-dojo-border overflow-hidden">
            {data.students.map(s => {
              const existing = s.scores.find(sc => sc.criteriaId === activeCriteria.id);
              const key = `${s.inviteeId}_${activeCriteria.id}`;
              const isSaving = saving === key;
              const beltInfo = getBeltInfo(s.beltToPresent);
              return (
                <div key={s.inviteeId} className="px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    {/* Foto + nombre + cinta — fijos, no se van con el scroll horizontal */}
                    <div className="flex items-center gap-2 shrink-0 w-[132px]">
                      {s.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.photo} alt={s.fullName} className="w-7 h-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-dojo-border/50 flex items-center justify-center text-dojo-muted text-[10px] font-bold shrink-0">
                          {s.fullName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-dojo-white truncate text-xs leading-tight">{s.fullName}</p>
                        <span className="text-[9px] px-1 py-0.5 rounded-full inline-block"
                          style={{ backgroundColor: beltInfo.hex + "30", color: beltInfo.hex === "#FFFFFF" ? "#aaa" : beltInfo.hex }}>
                          {beltInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Notas 0-10 — misma línea, con scroll horizontal si no caben */}
                    <div className="flex items-center gap-1 overflow-x-auto flex-1 pb-0.5">
                      {SCALE.map(v => (
                        <button
                          key={v}
                          onClick={() => saveScore(s.inviteeId, activeCriteria.id, v, existing?.note ?? null)}
                          disabled={isSaving}
                          className={`w-8 h-8 shrink-0 rounded-lg text-sm font-bold transition-colors ${
                            existing?.value === v
                              ? "bg-dojo-gold text-black"
                              : "bg-dojo-border/40 text-dojo-white hover:bg-dojo-border"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>

                    {existing != null && <CheckCircle2 size={15} className="text-green-400 shrink-0" />}
                  </div>

                  {noteOpen === key ? (
                    <div className="space-y-2 pl-[140px]">
                      <textarea
                        className="form-input text-sm"
                        rows={2}
                        placeholder="Observación (opcional)"
                        value={noteDraft}
                        onChange={e => setNoteDraft(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { if (existing) saveScore(s.inviteeId, activeCriteria.id, existing.value, noteDraft.trim() || null); }}
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
                      onClick={() => { setNoteOpen(key); setNoteDraft(existing?.note ?? ""); }}
                      className="text-xs text-dojo-muted hover:text-dojo-gold transition-colors pl-[140px]"
                    >
                      {existing?.note ? `📝 ${existing.note}` : "+ Agregar observación"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeCriteria && data.students.length > 0 && (
          nextCriteria ? (
            <button onClick={goToNextCriteria} className="btn-primary w-full flex items-center justify-center gap-2">
              Siguiente criterio: {nextCriteria.name} <ArrowRight size={16} />
            </button>
          ) : (
            <div className="space-y-3">
              <div className="card bg-green-900/10 border-green-800/30 flex items-center gap-2.5 justify-center text-center">
                <PartyPopper size={18} className="text-green-400 shrink-0" />
                <p className="text-sm text-green-400 font-medium">Este era el último criterio</p>
              </div>
              <p className="text-xs text-dojo-muted text-center">
                Revisa arriba que todos los alumnos tengan nota en cada criterio. El administrador es quien confirma la evaluación cuando todos los Senseis terminen.
              </p>
              <button
                onClick={() => { setActiveCriteriaId(data.criteria[0].id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} /> Volver al primer criterio
              </button>
            </div>
          )
        )}
      </div>
    </main>
  );
}
