"use client";
import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList, Search, Filter, Edit2, Trash2,
  Save, X, AlertTriangle, LogIn, LogOut, Clock,
} from "lucide-react";
import Link from "next/link";
import { BeltBadge } from "@/components/ui/BeltBadge";
import { Modal } from "@/components/ui/Modal";

interface AttendanceStudent {
  id: string; fullName: string; firstName: string; lastName: string;
  beltHistory: { beltColor: string }[];
}
interface Schedule { id: string; name: string; }
interface Attendance {
  id: string; studentId: string; student: AttendanceStudent;
  scheduleId: string | null; schedule: Schedule | null;
  type: string; markedAt: string; note: string | null;
  corrected: boolean; correctedBy: string | null;
}
interface CorrectionForm {
  id: string; type: string; markedAt: string; scheduleId: string; note: string;
}

function todayStr() { return new Date().toISOString().split("T")[0]; }

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-PA", { dateStyle: "short", timeStyle: "short" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PA", { day: "2-digit", month: "short" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit" });
}
function toDateTimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function exportCSV(rows: Attendance[]) {
  const header = ["Alumno","Tipo","Fecha/Hora","Horario","Nota","Corregida"];
  const lines = rows.map(a => [
    `"${a.student.fullName}"`,
    `"${a.type === "entry" ? "Entrada" : "Salida"}"`,
    `"${formatDateTime(a.markedAt)}"`,
    `"${a.schedule?.name ?? ""}"`,
    `"${a.note ?? ""}"`,
    `"${a.corrected ? "Sí" : "No"}"`,
  ].join(","));
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `asistencia-${todayStr()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function Initials({ student }: { student: AttendanceStudent }) {
  return (
    <div className="w-8 h-8 rounded-full bg-dojo-border flex items-center justify-center text-xs font-bold text-dojo-gold flex-shrink-0">
      {student.fullName.split(" ").slice(0,2).map(w => w[0]).join("")}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  return type === "entry" ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-800/40">
      <LogIn size={10} /> Entrada
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-900/30 text-red-400 border border-red-800/40">
      <LogOut size={10} /> Salida
    </span>
  );
}

export default function AttendancePage() {
  const [attendances,    setAttendances]  = useState<Attendance[]>([]);
  const [schedules,      setSchedules]    = useState<Schedule[]>([]);
  const [loading,        setLoading]      = useState(true);
  const [search,         setSearch]       = useState("");
  const [dateFrom,       setDateFrom]     = useState(todayStr());
  const [dateTo,         setDateTo]       = useState(todayStr());
  const [typeFilter,     setTypeFilter]   = useState("all");
  const [scheduleFilter, setSchedFilter]  = useState("all");
  const [deleting,       setDeleting]     = useState<string | null>(null);
  const [corrModal,      setCorrModal]    = useState(false);
  const [corrForm,       setCorrForm]     = useState<CorrectionForm | null>(null);
  const [saving,         setSaving]       = useState(false);

  const loadAttendances = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (dateFrom)                 p.set("dateFrom",  `${dateFrom}T00:00:00`);
    if (dateTo)                   p.set("dateTo",    `${dateTo}T23:59:59`);
    if (typeFilter !== "all")     p.set("type",       typeFilter);
    if (scheduleFilter !== "all") p.set("scheduleId", scheduleFilter);
    const r = await fetch(`/api/attendance?${p}`);
    if (r.ok) setAttendances(await r.json());
    setLoading(false);
  }, [dateFrom, dateTo, typeFilter, scheduleFilter]);

  useEffect(() => { loadAttendances(); }, [loadAttendances]);
  useEffect(() => {
    fetch("/api/schedules").then(r => r.ok ? r.json() : []).then(setSchedules);
  }, []);

  const filtered = attendances.filter(a =>
    !search || a.student.fullName.toLowerCase().includes(search.toLowerCase()),
  );

  const stats = {
    total:   filtered.length,
    entries: filtered.filter(a => a.type === "entry").length,
    exits:   filtered.filter(a => a.type === "exit").length,
  };

  function openCorrect(a: Attendance) {
    setCorrForm({ id: a.id, type: a.type, markedAt: toDateTimeLocal(a.markedAt), scheduleId: a.scheduleId ?? "", note: a.note ?? "" });
    setCorrModal(true);
  }

  async function saveCorrection() {
    if (!corrForm) return;
    setSaving(true);
    await fetch(`/api/attendance/${corrForm.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: corrForm.type, markedAt: corrForm.markedAt ? new Date(corrForm.markedAt).toISOString() : undefined, scheduleId: corrForm.scheduleId || null, note: corrForm.note || null }),
    });
    setSaving(false); setCorrModal(false); loadAttendances();
  }

  async function deleteAttendance(id: string) {
    if (!confirm("¿Eliminar esta marcación?")) return;
    setDeleting(id);
    await fetch(`/api/attendance/${id}`, { method: "DELETE" });
    setDeleting(null); loadAttendances();
  }

  return (
    <div className="space-y-4 max-w-7xl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-2">
            <ClipboardList size={22} className="text-dojo-red" /> Control de Asistencia
          </h1>
          <p className="text-dojo-muted text-xs sm:text-sm mt-0.5">{filtered.length} marcaciones en el período</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/dashboard/schedules" className="btn-secondary text-xs sm:text-sm py-1.5 px-3">
            <Clock size={14} /> <span className="hidden sm:inline">Horarios</span>
          </Link>
          <a href="/scanner" target="_blank" rel="noopener noreferrer" className="btn-primary text-xs sm:text-sm py-1.5 px-3">
            <LogIn size={14} /> <span className="hidden sm:inline">Abrir </span>Scanner
          </a>
          <button onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}
            className="btn-secondary text-xs sm:text-sm py-1.5 px-3 disabled:opacity-40">
            <ClipboardList size={14} /> <span className="hidden sm:inline">Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card border border-dojo-border text-center py-3">
          <p className="text-[10px] sm:text-xs text-dojo-muted uppercase tracking-wider">Total</p>
          <p className="text-xl sm:text-3xl font-bold text-dojo-white mt-0.5">{stats.total}</p>
        </div>
        <div className="card border border-green-800/30 bg-green-900/10 text-center py-3">
          <p className="text-[10px] sm:text-xs text-green-400 uppercase tracking-wider">Entradas</p>
          <p className="text-xl sm:text-3xl font-bold text-green-400 mt-0.5">{stats.entries}</p>
        </div>
        <div className="card border border-red-800/30 bg-red-900/10 text-center py-3">
          <p className="text-[10px] sm:text-xs text-red-400 uppercase tracking-wider">Salidas</p>
          <p className="text-xl sm:text-3xl font-bold text-red-400 mt-0.5">{stats.exits}</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="space-y-2">
        {/* Search — full width on mobile */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="form-input pl-8 w-full" placeholder="Buscar alumno..." />
        </div>
        {/* Date range + selects — wrap on mobile */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Filter size={13} className="text-dojo-muted shrink-0" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="form-input flex-1 min-w-0 text-sm" />
            <span className="text-dojo-muted text-sm shrink-0">—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="form-input flex-1 min-w-0 text-sm" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="form-input text-sm flex-1 min-w-[120px]">
            <option value="all">Todos</option>
            <option value="entry">Entradas</option>
            <option value="exit">Salidas</option>
          </select>
          <select value={scheduleFilter} onChange={e => setSchedFilter(e.target.value)}
            className="form-input text-sm flex-1 min-w-[140px]">
            <option value="all">Todos los horarios</option>
            {schedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── Mobile: card list ── */}
      <div className="block sm:hidden space-y-2">
        {loading && <p className="text-center py-10 text-dojo-muted text-sm">Cargando...</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-center py-10 text-dojo-muted text-sm">No hay marcaciones en este período.</p>
        )}
        {filtered.map(a => {
          const belt = a.student.beltHistory[0]?.beltColor ?? null;
          return (
            <div key={a.id} className="card p-3 space-y-2.5">
              {/* Row 1: avatar + name + actions */}
              <div className="flex items-center gap-2.5">
                <Initials student={a.student} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-dojo-white truncate">{a.student.fullName}</p>
                  {belt && <BeltBadge beltColor={belt} />}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openCorrect(a)} className="btn-ghost p-1.5 text-dojo-muted hover:text-dojo-white">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => deleteAttendance(a.id)} disabled={deleting === a.id}
                    className="btn-ghost p-1.5 text-dojo-muted hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {/* Row 2: type + date + time */}
              <div className="flex items-center gap-2 flex-wrap">
                <TypeBadge type={a.type} />
                <span className="text-xs text-dojo-muted">{formatDate(a.markedAt)}</span>
                <span className="text-xs font-semibold text-dojo-white">{formatTime(a.markedAt)}</span>
                {a.corrected && (
                  <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-800/40">
                    <AlertTriangle size={9} /> Corregida
                  </span>
                )}
              </div>
              {/* Row 3: schedule + note */}
              {(a.schedule || a.note) && (
                <div className="text-xs text-dojo-muted flex flex-wrap gap-2">
                  {a.schedule && <span>📅 {a.schedule.name}</span>}
                  {a.note     && <span className="truncate">📝 {a.note}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Desktop: table ── */}
      <div className="hidden sm:block card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dojo-border">
                {["Alumno","Cinta","Tipo","Fecha / Hora","Horario","Nota","Estado","Acciones"].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="text-center py-12 text-dojo-muted">Cargando...</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-dojo-muted">No hay marcaciones en este período.</td></tr>
              )}
              {filtered.map(a => {
                const belt = a.student.beltHistory[0]?.beltColor ?? null;
                return (
                  <tr key={a.id} className="border-b border-dojo-border/40 hover:bg-dojo-border/10 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Initials student={a.student} />
                        <span className="font-semibold text-dojo-white whitespace-nowrap">{a.student.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {belt ? <BeltBadge beltColor={belt} /> : <span className="text-dojo-muted text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3"><TypeBadge type={a.type} /></td>
                    <td className="px-4 py-3 text-dojo-muted whitespace-nowrap">{formatDateTime(a.markedAt)}</td>
                    <td className="px-4 py-3 text-dojo-muted">{a.schedule?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-dojo-muted max-w-[160px] truncate">{a.note ?? "—"}</td>
                    <td className="px-4 py-3">
                      {a.corrected ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-800/40">
                          <AlertTriangle size={11} /> Corregida
                        </span>
                      ) : (
                        <span className="text-xs text-dojo-muted">Original</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openCorrect(a)} className="btn-ghost p-1.5 text-dojo-muted hover:text-dojo-white" title="Corregir">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteAttendance(a.id)} disabled={deleting === a.id}
                          className="btn-ghost p-1.5 text-dojo-muted hover:text-red-400" title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Correction Modal ── */}
      <Modal open={corrModal} onClose={() => setCorrModal(false)} title="Corregir Marcación" size="md">
        {corrForm && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-yellow-900/20 border border-yellow-800/40 rounded-lg">
              <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-yellow-300 text-sm">La corrección quedará registrada con tu usuario. El registro original se marca como corregido para auditoría.</p>
            </div>
            <div>
              <label className="form-label">Tipo *</label>
              <select value={corrForm.type} onChange={e => setCorrForm(f => f && ({ ...f, type: e.target.value }))} className="form-input">
                <option value="entry">Entrada</option>
                <option value="exit">Salida</option>
              </select>
            </div>
            <div>
              <label className="form-label">Fecha y hora exacta *</label>
              <input type="datetime-local" value={corrForm.markedAt}
                onChange={e => setCorrForm(f => f && ({ ...f, markedAt: e.target.value }))} className="form-input" />
            </div>
            <div>
              <label className="form-label">Horario asociado</label>
              <select value={corrForm.scheduleId} onChange={e => setCorrForm(f => f && ({ ...f, scheduleId: e.target.value }))} className="form-input">
                <option value="">— Sin horario —</option>
                {schedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Nota / Motivo de corrección</label>
              <input value={corrForm.note} onChange={e => setCorrForm(f => f && ({ ...f, note: e.target.value }))}
                className="form-input" placeholder="Ej. Error en el escaneo..." />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setCorrModal(false)} className="btn-secondary"><X size={16} /> Cancelar</button>
              <button type="button" onClick={saveCorrection} disabled={saving} className="btn-primary">
                <Save size={16} /> {saving ? "Guardando..." : "Guardar Corrección"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
