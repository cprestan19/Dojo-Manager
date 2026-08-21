"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft, Loader2, Trash2, Power, Copy, Check, Plus, Link2,
  Search, X, CheckCircle2, Circle, Lock, Pencil, ArrowLeft,
} from "lucide-react";
import { getBeltInfo, BELT_COLORS } from "@/lib/utils";

interface Criteria { id: string; name: string; weightPct: number; order: number }
interface Evaluator {
  id: string; name: string; token: string; active: boolean; confirmedAt: string | null;
  _count: { scores: number };
}
interface LinkedApp {
  id: string; beltFilter: string[]; beltCounts: Record<string, number>;
  application: { id: string; title: string; status: string; _count: { invitees: number } };
}
interface EvaluationDetail {
  id: string; title: string;
  criteria: Criteria[];
  evaluators: Evaluator[];
  links: LinkedApp[];
}
interface Candidate {
  inviteeId: string; studentId: string; fullName: string; photo: string | null;
  beltToPresent: string; finalScore: number | null; passed: boolean | null;
  applicationTitle: string; scoresGiven: number; scoresExpected: number;
}
interface PickerApp { id: string; title: string; status: string; accepted: number; beltCounts: Record<string, number> }

// Chips de cinta ordenados por progresión (blanca → negra), solo las que
// tienen al menos un postulado aceptado en la postulación en cuestión.
function BeltChipPicker({ beltCounts, selected, onToggle }: {
  beltCounts: Record<string, number>; selected: Set<string>; onToggle: (belt: string) => void;
}) {
  const belts = BELT_COLORS.filter(b => (beltCounts[b.value] ?? 0) > 0);
  if (belts.length === 0) return <p className="text-xs text-dojo-muted">Esta postulación todavía no tiene aceptados.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {belts.map(b => {
        const isSelected = selected.has(b.value);
        return (
          <button
            key={b.value}
            type="button"
            onClick={() => onToggle(b.value)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              isSelected
                ? "bg-dojo-gold text-black border-dojo-gold font-semibold"
                : "bg-dojo-border/30 text-dojo-white border-dojo-border hover:bg-dojo-border/60"
            }`}
          >
            {b.label} ({beltCounts[b.value]})
          </button>
        );
      })}
    </div>
  );
}

export default function EvaluacionDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ev,       setEv]       = useState<EvaluationDetail | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  const load = useCallback(async () => {
    const [evRes, candRes] = await Promise.all([
      fetch(`/api/evaluations/${id}`),
      fetch(`/api/evaluations/${id}/candidates`),
    ]);
    if (evRes.ok) setEv(await evRes.json() as EvaluationDetail);
    else { setError("No se pudo cargar la evaluación"); setLoading(false); return; }
    if (candRes.ok) setCandidates(await candRes.json() as Candidate[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Vincular postulaciones ────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerApps, setPickerApps] = useState<PickerApp[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const [pickerApp, setPickerApp] = useState<PickerApp | null>(null); // paso 2: elegir cintas
  const [pickerBelts, setPickerBelts] = useState<Set<string>>(new Set());

  async function openPicker() {
    setPickerOpen(true);
    setPickerApp(null);
    setPickerBelts(new Set());
    setLinkError("");
    if (pickerApps.length > 0) return;
    setPickerLoading(true);
    try {
      const res = await fetch("/api/exam-applications?view=active");
      if (res.ok) setPickerApps(await res.json() as PickerApp[]);
    } finally { setPickerLoading(false); }
  }

  function closePicker() {
    setPickerOpen(false);
    setPickerApp(null);
    setPickerBelts(new Set());
    setLinkError("");
  }

  function togglePickerBelt(belt: string) {
    setPickerBelts(prev => {
      const next = new Set(prev);
      if (next.has(belt)) next.delete(belt); else next.add(belt);
      return next;
    });
  }

  async function confirmLinkApplication() {
    if (!pickerApp) return;
    setLinkError("");
    setLinkSaving(true);
    try {
      const res = await fetch(`/api/evaluations/${id}/link`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: pickerApp.id, beltFilter: [...pickerBelts] }),
      });
      const d = await res.json() as { error?: string };
      if (!res.ok) { setLinkError(d.error ?? "Error al vincular"); return; }
      closePicker();
      await load();
    } finally { setLinkSaving(false); }
  }

  async function unlinkApplication(applicationId: string) {
    const res = await fetch(`/api/evaluations/${id}/link/${applicationId}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  // ── Editar cintas de un vínculo ya creado ────────────────────────────
  const [editingLink, setEditingLink] = useState<LinkedApp | null>(null);
  const [editBelts, setEditBelts] = useState<Set<string>>(new Set());
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function openEditBelts(l: LinkedApp) {
    setEditingLink(l);
    setEditBelts(new Set(l.beltFilter));
    setEditError("");
  }

  function toggleEditBelt(belt: string) {
    setEditBelts(prev => {
      const next = new Set(prev);
      if (next.has(belt)) next.delete(belt); else next.add(belt);
      return next;
    });
  }

  async function saveEditBelts() {
    if (!editingLink) return;
    setEditError("");
    setEditSaving(true);
    try {
      const res = await fetch(`/api/evaluations/${id}/link/${editingLink.application.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beltFilter: [...editBelts] }),
      });
      const d = await res.json() as { error?: string };
      if (!res.ok) { setEditError(d.error ?? "Error al guardar"); return; }
      setEditingLink(null);
      await load();
    } finally { setEditSaving(false); }
  }

  // ── Criterios ──────────────────────────────────────────────────────────
  const [newCritName,   setNewCritName]   = useState("");
  const [newCritWeight, setNewCritWeight] = useState("");
  const [critSaving,    setCritSaving]    = useState(false);
  const [critError,     setCritError]     = useState("");
  const [confirmDelCrit, setConfirmDelCrit] = useState<Criteria | null>(null);

  async function addCriteria() {
    setCritError("");
    const name = newCritName.trim();
    const weightPct = Number(newCritWeight);
    if (!name) { setCritError("Escribe un nombre"); return; }
    if (!weightPct || weightPct <= 0 || weightPct > 100) { setCritError("El peso debe ser entre 1 y 100"); return; }
    setCritSaving(true);
    try {
      const res = await fetch(`/api/evaluations/${id}/criteria`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, weightPct }),
      });
      const d = await res.json() as { error?: string };
      if (!res.ok) { setCritError(d.error ?? "Error al agregar"); return; }
      setNewCritName(""); setNewCritWeight("");
      await load();
    } finally { setCritSaving(false); }
  }

  async function saveCriteriaWeight(critId: string, weightPct: number) {
    if (!weightPct || weightPct <= 0 || weightPct > 100) return;
    const res = await fetch(`/api/evaluations/${id}/criteria/${critId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weightPct }),
    });
    if (res.ok) await load();
  }

  async function deleteCriteria(crit: Criteria) {
    const res = await fetch(`/api/evaluations/${id}/criteria/${crit.id}`, { method: "DELETE" });
    if (res.ok) { setConfirmDelCrit(null); await load(); }
  }

  // ── Senseis ────────────────────────────────────────────────────────────
  const [newEvalName, setNewEvalName] = useState("");
  const [evalSaving,  setEvalSaving]  = useState(false);
  const [evalError,   setEvalError]   = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [confirmDelEval, setConfirmDelEval] = useState<Evaluator | null>(null);
  const [closing, setClosing] = useState(false);

  async function addEvaluator() {
    setEvalError("");
    const name = newEvalName.trim();
    if (!name) { setEvalError("Escribe el nombre del Sensei"); return; }
    setEvalSaving(true);
    try {
      const res = await fetch(`/api/evaluations/${id}/evaluators`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await res.json() as { error?: string };
      if (!res.ok) { setEvalError(d.error ?? "Error al agregar"); return; }
      setNewEvalName("");
      await load();
    } finally { setEvalSaving(false); }
  }

  async function toggleEvaluatorActive(evaluator: Evaluator) {
    const res = await fetch(`/api/evaluations/${id}/evaluators/${evaluator.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !evaluator.active }),
    });
    if (res.ok) await load();
  }

  async function deleteEvaluator(evaluator: Evaluator) {
    const res = await fetch(`/api/evaluations/${id}/evaluators/${evaluator.id}`, { method: "DELETE" });
    if (res.ok) { setConfirmDelEval(null); await load(); }
  }

  async function closeEvaluation() {
    if (!confirm("¿Cerrar la evaluación? Se desactivan todos los links de los Senseis — para corregir una nota después habría que reactivar a ese Sensei puntual.")) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/evaluations/${id}/close`, { method: "POST" });
      if (res.ok) await load();
    } finally { setClosing(false); }
  }

  function evaluatorLink(token: string) {
    return `${typeof window !== "undefined" ? window.location.origin : ""}/examen/${token}`;
  }

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(evaluatorLink(token));
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(t => t === token ? null : t), 2000);
    } catch { /* portapapeles no disponible — el link sigue visible para copiar a mano */ }
  }

  if (loading) return <div className="p-6 flex justify-center"><Loader2 size={24} className="animate-spin text-dojo-gold" /></div>;
  if (error || !ev) return <div className="p-6 text-red-400">{error || "No encontrada"}</div>;

  const totalWeight = ev.criteria.reduce((sum, c) => sum + c.weightPct, 0);
  const linkedApplicationIds = new Set(ev.links.map(l => l.application.id));
  const pickerFiltered = pickerApps.filter(a =>
    !linkedApplicationIds.has(a.id) && a.title.toLowerCase().includes(pickerSearch.toLowerCase()),
  );
  const anyoneActive = ev.evaluators.some(e => e.active);

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/dashboard/evaluaciones")} className="btn-ghost p-2">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-display font-bold text-dojo-white truncate">{ev.title}</h1>
          <p className="text-xs text-dojo-muted">{candidates.length} candidatos · {ev.criteria.length} criterios · {ev.evaluators.length} Senseis</p>
        </div>
        {anyoneActive && (
          <button onClick={closeEvaluation} disabled={closing} className="btn-secondary text-xs flex items-center gap-1.5 shrink-0">
            {closing ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />} Cerrar evaluación
          </button>
        )}
      </div>

      {/* Postulaciones vinculadas */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-dojo-white text-sm flex items-center gap-1.5"><Link2 size={14} /> Postulaciones vinculadas</h3>
          <button onClick={openPicker} className="btn-secondary text-xs flex items-center gap-1.5">
            <Plus size={13} /> Llamar postulación
          </button>
        </div>
        <div className="space-y-3">
          {ev.links.map(l => (
            <div key={l.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm text-dojo-white truncate">{l.application.title}</span>
                <span className="text-xs text-dojo-muted shrink-0">{l.application._count.invitees} postulados</span>
                <button onClick={() => openEditBelts(l)} className="p-1.5 rounded-lg text-dojo-muted hover:text-dojo-gold hover:bg-dojo-gold/10 transition-colors shrink-0" title="Editar cintas">
                  <Pencil size={14} />
                </button>
                <button onClick={() => unlinkApplication(l.application.id)} className="p-1.5 rounded-lg text-dojo-muted hover:text-red-400 hover:bg-red-900/20 transition-colors shrink-0">
                  <X size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {l.beltFilter.length === 0 ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-dojo-border/40 text-dojo-muted">Todas las cintas</span>
                ) : (
                  l.beltFilter.map(b => {
                    const belt = getBeltInfo(b);
                    return (
                      <span key={b} className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: belt.hex + "30", color: belt.hex === "#FFFFFF" ? "#aaa" : belt.hex }}>
                        {belt.label}
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          ))}
          {ev.links.length === 0 && <p className="text-sm text-dojo-muted">Sin postulaciones vinculadas — llama una para traer a sus alumnos aceptados.</p>}
        </div>
      </div>

      {/* Criterios */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-dojo-white text-sm">Criterios de evaluación</h3>
          <span className={`text-xs font-medium ${totalWeight === 100 ? "text-green-400" : "text-orange-400"}`}>
            Suma: {totalWeight}%{totalWeight !== 100 && " (debería ser 100%)"}
          </span>
        </div>
        {critError && <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{critError}</div>}
        <div className="space-y-2">
          {ev.criteria.map(c => (
            <div key={c.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-dojo-white truncate">{c.name}</span>
              <input
                type="number" min={1} max={100}
                defaultValue={c.weightPct}
                onBlur={e => { const v = Number(e.target.value); if (v !== c.weightPct) saveCriteriaWeight(c.id, v); }}
                className="form-input w-20 text-sm text-right"
              />
              <span className="text-xs text-dojo-muted">%</span>
              <button onClick={() => setConfirmDelCrit(c)} className="p-1.5 rounded-lg text-dojo-muted hover:text-red-400 hover:bg-red-900/20 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {ev.criteria.length === 0 && <p className="text-sm text-dojo-muted">Todavía no hay criterios — agrega el primero abajo.</p>}
        </div>
        <div className="flex gap-2 pt-2 border-t border-dojo-border">
          <input className="form-input text-sm flex-1" placeholder="Nombre (ej. Kihon)" value={newCritName} onChange={e => setNewCritName(e.target.value)} />
          <input className="form-input text-sm w-20" type="number" min={1} max={100} placeholder="%" value={newCritWeight} onChange={e => setNewCritWeight(e.target.value)} />
          <button onClick={addCriteria} disabled={critSaving} className="btn-secondary text-sm shrink-0">
            {critSaving ? <Loader2 size={14} className="animate-spin" /> : "Agregar"}
          </button>
        </div>
      </div>

      {/* Senseis */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-dojo-white text-sm">Senseis evaluadores</h3>
        <p className="text-xs text-dojo-muted">
          Cada Sensei entra por su propio link, confirma su nombre y solo ve a los alumnos aceptados de las postulaciones vinculadas. No ve las notas de los demás.
        </p>
        {evalError && <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{evalError}</div>}
        <div className="space-y-2">
          {ev.evaluators.map(evtr => (
            <div key={evtr.id} className="flex items-center gap-2 flex-wrap">
              <span className={`w-2 h-2 rounded-full shrink-0 ${evtr.active ? "bg-green-400" : "bg-dojo-border"}`} title={evtr.active ? "Activo" : "Desactivado"} />
              <span className="text-sm text-dojo-white flex-1 min-w-[100px] truncate">{evtr.name}</span>
              <span className="text-xs text-dojo-muted shrink-0">{evtr._count.scores} notas</span>
              <button onClick={() => copyLink(evtr.token)} className="text-xs px-2 py-1 rounded-lg bg-dojo-border/40 text-dojo-white hover:bg-dojo-border flex items-center gap-1 shrink-0">
                {copiedToken === evtr.token ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                {copiedToken === evtr.token ? "Copiado" : "Copiar link"}
              </button>
              <button onClick={() => toggleEvaluatorActive(evtr)} className="p-1.5 rounded-lg text-dojo-muted hover:text-dojo-white hover:bg-dojo-border/40 transition-colors shrink-0" title={evtr.active ? "Desactivar link" : "Activar link"}>
                <Power size={14} className={evtr.active ? "text-green-400" : ""} />
              </button>
              {evtr._count.scores === 0 && (
                <button onClick={() => setConfirmDelEval(evtr)} className="p-1.5 rounded-lg text-dojo-muted hover:text-red-400 hover:bg-red-900/20 transition-colors shrink-0">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {ev.evaluators.length === 0 && <p className="text-sm text-dojo-muted">Todavía no hay Senseis — agrega el primero abajo.</p>}
        </div>
        <div className="flex gap-2 pt-2 border-t border-dojo-border">
          <input className="form-input text-sm flex-1" placeholder="Nombre del Sensei" value={newEvalName} onChange={e => setNewEvalName(e.target.value)} />
          <button onClick={addEvaluator} disabled={evalSaving} className="btn-secondary text-sm shrink-0">
            {evalSaving ? <Loader2 size={14} className="animate-spin" /> : "Agregar Sensei"}
          </button>
        </div>
      </div>

      {/* Candidatos */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-dojo-white text-sm">Candidatos ({candidates.length})</h3>
        <div className="space-y-2">
          {candidates.map(c => {
            const belt = getBeltInfo(c.beltToPresent);
            const done = c.scoresGiven === c.scoresExpected && c.scoresExpected > 0;
            return (
              <div key={c.inviteeId} className="flex items-center gap-3">
                {c.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo} alt={c.fullName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-dojo-border/50 flex items-center justify-center text-dojo-muted text-xs font-bold shrink-0">
                    {c.fullName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-dojo-white truncate">{c.fullName}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: belt.hex + "30", color: belt.hex === "#FFFFFF" ? "#aaa" : belt.hex }}>
                    {belt.label}
                  </span>
                </div>
                {c.finalScore != null && <span className="text-xs text-dojo-gold font-semibold shrink-0">{c.finalScore.toFixed(2)}</span>}
                <div className="flex items-center gap-1 text-xs shrink-0">
                  {done ? <CheckCircle2 size={14} className="text-green-400" /> : <Circle size={14} className="text-dojo-muted" />}
                  <span className={done ? "text-green-400" : "text-dojo-muted"}>{c.scoresGiven}/{c.scoresExpected}</span>
                </div>
              </div>
            );
          })}
          {candidates.length === 0 && <p className="text-sm text-dojo-muted">Sin candidatos todavía — llama una postulación arriba.</p>}
        </div>
      </div>

      {/* Modal: llamar postulación */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dojo-dark border border-dojo-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            {pickerApp ? (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setPickerApp(null); setPickerBelts(new Set()); setLinkError(""); }} className="p-1 -ml-1 text-dojo-muted hover:text-dojo-white">
                    <ArrowLeft size={18} />
                  </button>
                  <p className="font-semibold text-dojo-white flex-1 truncate">{pickerApp.title}</p>
                  <button onClick={closePicker} className="p-1 text-dojo-muted hover:text-dojo-white"><X size={18} /></button>
                </div>
                {linkError && <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{linkError}</div>}
                <p className="text-xs text-dojo-muted">
                  Elige qué cintas de esta postulación pertenecen a esta Evaluación. Si no eliges ninguna, se incluyen <span className="text-dojo-white font-medium">todas las cintas</span> de esta postulación.
                </p>
                <BeltChipPicker beltCounts={pickerApp.beltCounts} selected={pickerBelts} onToggle={togglePickerBelt} />
                <button onClick={confirmLinkApplication} disabled={linkSaving} className="btn-primary w-full flex items-center justify-center gap-2">
                  {linkSaving ? <Loader2 size={16} className="animate-spin" /> : (pickerBelts.size === 0 ? "Vincular todas las cintas" : `Vincular ${pickerBelts.size} cinta${pickerBelts.size > 1 ? "s" : ""}`)}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-dojo-white">Llamar postulación</p>
                  <button onClick={closePicker} className="p-1 text-dojo-muted hover:text-dojo-white"><X size={18} /></button>
                </div>
                {linkError && <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{linkError}</div>}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
                  <input className="form-input pl-9 text-sm" placeholder="Buscar postulación..." value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} />
                </div>
                {pickerLoading ? (
                  <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-dojo-gold" /></div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {pickerFiltered.map(a => (
                      <button key={a.id} onClick={() => { setPickerApp(a); setPickerBelts(new Set()); setLinkError(""); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-dojo-border/40 text-left transition-colors">
                        <span className="flex-1 min-w-0 text-sm text-dojo-white truncate">{a.title}</span>
                        <span className="text-xs text-dojo-muted shrink-0">{a.accepted} aceptados</span>
                      </button>
                    ))}
                    {pickerFiltered.length === 0 && <p className="text-center text-dojo-muted text-sm py-4">Sin resultados</p>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: editar cintas de un vínculo */}
      {editingLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dojo-dark border border-dojo-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-dojo-white truncate">{editingLink.application.title}</p>
              <button onClick={() => setEditingLink(null)} className="p-1 text-dojo-muted hover:text-dojo-white"><X size={18} /></button>
            </div>
            {editError && <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{editError}</div>}
            <p className="text-xs text-dojo-muted">
              Cintas de esta postulación que pertenecen a esta Evaluación. Sin ninguna elegida = todas las cintas.
            </p>
            <BeltChipPicker beltCounts={editingLink.beltCounts} selected={editBelts} onToggle={toggleEditBelt} />
            <button onClick={saveEditBelts} disabled={editSaving} className="btn-primary w-full flex items-center justify-center gap-2">
              {editSaving ? <Loader2 size={16} className="animate-spin" /> : "Guardar cintas"}
            </button>
          </div>
        </div>
      )}

      {/* Modal eliminar criterio */}
      {confirmDelCrit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dojo-dark border border-dojo-border rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-dojo-red/10 flex items-center justify-center">
                <Trash2 size={20} className="text-dojo-red" />
              </div>
              <div>
                <p className="font-semibold text-dojo-white">Eliminar criterio</p>
                <p className="text-xs text-dojo-muted">También se borran las notas ya cargadas para &quot;{confirmDelCrit.name}&quot;</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelCrit(null)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={() => deleteCriteria(confirmDelCrit)} className="flex-1 text-sm bg-dojo-red hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar Sensei */}
      {confirmDelEval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dojo-dark border border-dojo-border rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-dojo-red/10 flex items-center justify-center">
                <Trash2 size={20} className="text-dojo-red" />
              </div>
              <div>
                <p className="font-semibold text-dojo-white">Eliminar Sensei</p>
                <p className="text-xs text-dojo-muted">Se borra su link — no ha calificado a nadie todavía</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelEval(null)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={() => deleteEvaluator(confirmDelEval)} className="flex-1 text-sm bg-dojo-red hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
