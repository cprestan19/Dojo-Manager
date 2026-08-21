"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Loader2, QrCode, Search, UserPlus, X, Check,
  CheckCircle2, Circle, Trash2, ExternalLink,
} from "lucide-react";
import { getBeltInfo, formatDate, BELT_COLORS } from "@/lib/utils";

interface Invitee {
  id: string; studentId: string; beltToPresent: string; response: string;
  attended: boolean; arrivedAt: string | null; passed: boolean | null;
  student: { id: string; fullName: string; studentCode: number | null; photo: string | null };
}
interface Application {
  id: string; title: string; location: string; examDate: string; status: string;
  invitees: Invitee[];
}
interface StudentOption {
  id: string; fullName: string; studentCode: number | null;
  beltHistory: { beltColor: string }[];
}

export default function AsistenciaExamenDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [app,     setApp]     = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [search,  setSearch]  = useState("");
  const [busyId,  setBusyId]  = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/exam-applications/${id}`);
    if (res.ok) setApp(await res.json() as Application);
    else setError("No se pudo cargar la postulación");
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function toggleAttended(invitee: Invitee) {
    setBusyId(invitee.id);
    setActionError("");
    try {
      await fetch(`/api/exam-applications/${id}/attendance`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteeId: invitee.id, attended: !invitee.attended }),
      });
      await load();
    } finally { setBusyId(null); }
  }

  async function removeInvitee(invitee: Invitee) {
    if (!confirm(`¿Quitar a ${invitee.student.fullName} de la lista de asistencia?`)) return;
    setBusyId(invitee.id);
    setActionError("");
    try {
      const res = await fetch(`/api/exam-applications/${id}/invitees`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteeId: invitee.id }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; setActionError(d.error ?? "Error al quitar"); return; }
      await load();
    } finally { setBusyId(null); }
  }

  // ── Agregar alumno manualmente ────────────────────────────────────────
  const [addOpen,    setAddOpen]    = useState(false);
  const [addStudents, setAddStudents] = useState<StudentOption[]>([]);
  const [addSearch,  setAddSearch]  = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addSel,     setAddSel]     = useState<StudentOption | null>(null);
  const [addBelt,    setAddBelt]    = useState("blanca");
  const [addSaving,  setAddSaving]  = useState(false);
  const [addError,   setAddError]   = useState("");

  async function openAdd() {
    setAddOpen(true);
    setAddSel(null);
    setAddSearch("");
    setAddError("");
    if (addStudents.length > 0) return;
    setAddLoading(true);
    try {
      const res = await fetch("/api/students?active=true&limit=500");
      if (res.ok) {
        const data = await res.json() as { students?: StudentOption[] } | StudentOption[];
        setAddStudents(Array.isArray(data) ? data : data.students ?? []);
      }
    } finally { setAddLoading(false); }
  }

  const invitedIds = new Set((app?.invitees ?? []).map(i => i.studentId));
  const addFiltered = addStudents.filter(s =>
    !invitedIds.has(s.id) &&
    (s.fullName.toLowerCase().includes(addSearch.toLowerCase()) || String(s.studentCode ?? "").includes(addSearch)),
  );

  async function confirmAdd() {
    if (!addSel) return;
    setAddSaving(true);
    setAddError("");
    try {
      const res = await fetch(`/api/exam-applications/${id}/invitees`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: addSel.id, beltToPresent: addBelt, response: "ACCEPTED", attended: true }),
      });
      const d = await res.json() as { error?: string };
      if (!res.ok) { setAddError(d.error ?? "Error al agregar"); return; }
      setAddOpen(false);
      await load();
    } finally { setAddSaving(false); }
  }

  if (loading) return <div className="p-6 flex justify-center"><Loader2 size={24} className="animate-spin text-dojo-gold" /></div>;
  if (error || !app) return <div className="p-6 text-red-400">{error || "No encontrada"}</div>;

  if (app.status !== "CLOSED" && app.status !== "FINALIZED") {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <button onClick={() => router.push("/dashboard/asistencia-examen")} className="btn-ghost p-2"><ChevronLeft size={18} /></button>
        <div className="card text-center py-10">
          <p className="text-dojo-white font-semibold">Todavía no se puede tomar asistencia</p>
          <p className="text-dojo-muted text-sm mt-1">Primero hay que cerrar las inscripciones desde la Postulación.</p>
        </div>
      </div>
    );
  }

  const accepted = app.invitees.filter(i => i.response === "ACCEPTED");
  const attended = accepted.filter(i => i.attended);
  const notAttended = accepted.filter(i => !i.attended);
  const listed = accepted.filter(i => i.student.fullName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/dashboard/asistencia-examen")} className="btn-ghost p-2"><ChevronLeft size={18} /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-display font-bold text-dojo-white truncate">{app.title}</h1>
          <p className="text-xs text-dojo-muted">📍 {app.location} · 📅 {formatDate(app.examDate)}</p>
        </div>
        <Link href={`/dashboard/asistencia-examen/${id}/scan`} className="btn-primary text-xs flex items-center gap-1.5 shrink-0">
          <QrCode size={14} /> Escanear QR
        </Link>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center py-3 border border-dojo-border">
          <p className="text-2xl font-bold text-dojo-white">{accepted.length}</p>
          <p className="text-dojo-muted text-xs mt-0.5">Inscritos</p>
        </div>
        <div className="card text-center py-3 border border-green-600/30 bg-green-600/5">
          <p className="text-2xl font-bold text-green-400">{attended.length}</p>
          <p className="text-dojo-muted text-xs mt-0.5">Asistieron</p>
        </div>
        <div className="card text-center py-3 border border-red-600/30 bg-red-600/5">
          <p className="text-2xl font-bold text-red-400">{notAttended.length}</p>
          <p className="text-dojo-muted text-xs mt-0.5">No participaron</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
          <input className="form-input pl-8 text-sm w-full" placeholder="Buscar alumno..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={openAdd} className="btn-secondary text-xs flex items-center gap-1.5 shrink-0">
          <UserPlus size={14} /> Agregar
        </button>
      </div>

      {actionError && <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{actionError}</div>}

      <div className="rounded-xl border border-dojo-border divide-y divide-dojo-border overflow-hidden">
        {listed.map(inv => {
          const belt = getBeltInfo(inv.beltToPresent);
          const busy = busyId === inv.id;
          const canRemove = inv.passed === null;
          return (
            <div key={inv.id} className="flex items-center gap-3 px-4 py-2.5">
              {inv.student.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={inv.student.photo} alt={inv.student.fullName} className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-dojo-border/50 flex items-center justify-center text-dojo-muted text-xs font-bold shrink-0">
                  {inv.student.fullName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-dojo-white truncate">{inv.student.fullName}</p>
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: belt.hex + "30", color: belt.hex === "#FFFFFF" ? "#aaa" : belt.hex }}>
                  {belt.label}
                </span>
              </div>
              <Link href={`/dashboard/students/${inv.studentId}`} target="_blank"
                className="p-1.5 rounded-lg text-dojo-muted hover:text-dojo-white hover:bg-dojo-border/40 transition-colors shrink-0" title="Ver alumno">
                <ExternalLink size={13} />
              </Link>
              <button
                onClick={() => toggleAttended(inv)}
                disabled={busy}
                className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0 transition-colors ${
                  inv.attended ? "bg-green-900/40 text-green-400 border border-green-700/50" : "bg-dojo-border/40 text-dojo-muted hover:text-dojo-white"
                }`}
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : inv.attended ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                {inv.attended ? "Asistió" : "No asistió"}
              </button>
              {canRemove && (
                <button onClick={() => removeInvitee(inv)} disabled={busy}
                  className="p-1.5 rounded-lg text-dojo-muted hover:text-red-400 hover:bg-red-900/20 transition-colors shrink-0" title="Quitar">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          );
        })}
        {listed.length === 0 && <p className="text-center text-dojo-muted text-sm py-8">Sin alumnos que coincidan.</p>}
      </div>

      {/* Modal: agregar alumno */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dojo-dark border border-dojo-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-dojo-white">Agregar alumno a la lista</p>
              <button onClick={() => setAddOpen(false)} className="p-1 text-dojo-muted hover:text-dojo-white"><X size={18} /></button>
            </div>
            {addError && <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{addError}</div>}
            {addSel ? (
              <>
                <div className="flex items-center gap-2 bg-dojo-border/30 rounded-lg px-3 py-2">
                  <Check size={14} className="text-green-400" />
                  <span className="text-sm text-dojo-white">{addSel.fullName}</span>
                </div>
                <div>
                  <label className="form-label text-xs">Cinta a presentar</label>
                  <select value={addBelt} onChange={e => setAddBelt(e.target.value)} className="form-input text-sm">
                    {BELT_COLORS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAddSel(null)} className="btn-ghost text-xs">Atrás</button>
                  <button onClick={confirmAdd} disabled={addSaving} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2">
                    {addSaving ? <Loader2 size={14} className="animate-spin" /> : null} Agregar y marcar presente
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
                  <input className="form-input pl-9 text-sm" placeholder="Buscar alumno..." value={addSearch} onChange={e => setAddSearch(e.target.value)} />
                </div>
                {addLoading ? (
                  <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-dojo-gold" /></div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {addFiltered.map(s => (
                      <button key={s.id} onClick={() => setAddSel(s)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-dojo-border/40 text-left transition-colors">
                        <span className="flex-1 min-w-0 text-sm text-dojo-white truncate">{s.fullName}</span>
                        {s.studentCode && <span className="text-xs text-dojo-muted shrink-0">#{s.studentCode}</span>}
                      </button>
                    ))}
                    {addFiltered.length === 0 && <p className="text-center text-dojo-muted text-sm py-4">Sin resultados</p>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
