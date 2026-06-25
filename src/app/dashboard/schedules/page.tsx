"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Clock, Plus, Edit2, Trash2, Save, X, Users, Search,
  AlertCircle, CheckCircle2, ChevronDown, ChevronRight, UserMinus,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BeltBadge } from "@/components/ui/BeltBadge";
import { BELT_COLORS, getBeltInfo } from "@/lib/utils";

/* ── Types ── */

interface StudentAssignment {
  student: {
    id: string;
    fullName: string;
    beltHistory: { beltColor: string }[];
    attendances: { type: string; markedAt: string }[];
  };
}

interface Schedule {
  id: string;
  name: string;
  days: string;
  startTime: string;
  endTime: string;
  description: string | null;
  active: boolean;
  _count: { attendances: number; studentSchedules: number };
  studentSchedules: StudentAssignment[];
}

interface StudentInfo {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  age: number;
  belt: string;
  currentScheduleId: string | null;
  currentScheduleName: string | null;
}

interface FormState {
  id?: string;
  name: string;
  days: string[];
  startTime: string;
  endTime: string;
  description: string;
  active: boolean;
  studentIds: string[];
}

/* ── Constants ── */

const ALL_DAYS = [
  { key: "lunes",     label: "Lun", full: "Lunes"     },
  { key: "martes",    label: "Mar", full: "Martes"    },
  { key: "miercoles", label: "Mié", full: "Miércoles" },
  { key: "jueves",    label: "Jue", full: "Jueves"    },
  { key: "viernes",   label: "Vie", full: "Viernes"   },
  { key: "sabado",    label: "Sáb", full: "Sábado"    },
  { key: "domingo",   label: "Dom", full: "Domingo"   },
];

/* ── Helpers ── */

function emptyForm(): FormState {
  return { name: "", days: [], startTime: "08:00", endTime: "09:00", description: "", active: true, studentIds: [] };
}

function parseDays(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

function formatAttendanceDate(iso: string): string {
  return new Date(iso).toLocaleString("es-PA", {
    timeZone: "America/Panama",
    dateStyle: "short",
    timeStyle: "short",
  });
}

/* ── Component ── */

export default function SchedulesPage() {
  const [schedules,   setSchedules]   = useState<Schedule[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(false);
  const [form,        setForm]        = useState<FormState>(emptyForm());
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState<string | null>(null);
  const [error,       setError]       = useState("");
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());

  // Student picker state (for modal)
  const [students,    setStudents]    = useState<StudentInfo[]>([]);
  const [studLoading, setStudLoading] = useState(true);
  const [studError,   setStudError]   = useState("");
  const [search,      setSearch]      = useState("");
  const [beltFilter,  setBeltFilter]  = useState("");
  const [ageMin,      setAgeMin]      = useState("");
  const [ageMax,      setAgeMax]      = useState("");

  // Add-students modal (from expanded row)
  const [addModal,    setAddModal]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/schedules");
    if (r.ok) {
      const data: Schedule[] = await r.json();
      setSchedules(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Student picker helpers ── */

  async function loadStudents(editingScheduleId?: string) {
    setStudLoading(true);
    setStudError("");
    try {
      const url = editingScheduleId
        ? `/api/schedules/students?scheduleId=${editingScheduleId}`
        : "/api/schedules/students";
      const r = await fetch(url);
      if (r.ok) {
        setStudents(await r.json());
      } else {
        setStudError("No se pudieron cargar los alumnos.");
      }
    } catch {
      setStudError("Error de conexión al cargar alumnos.");
    } finally {
      setStudLoading(false);
    }
  }

  /* ── Toggle expanded row ── */

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* ── Create / Edit modal ── */

  function openCreate() {
    setForm(emptyForm());
    setError("");
    setSearch(""); setBeltFilter(""); setAgeMin(""); setAgeMax("");
    setStudents([]); setStudLoading(true); setStudError("");
    setModal(true);
    loadStudents();
  }

  function openEdit(s: Schedule) {
    setStudents([]); setStudLoading(true); setStudError("");
    setError("");
    setSearch(""); setBeltFilter(""); setAgeMin(""); setAgeMax("");
    setForm({
      id:          s.id,
      name:        s.name,
      days:        parseDays(s.days),
      startTime:   s.startTime,
      endTime:     s.endTime,
      description: s.description ?? "",
      active:      s.active,
      studentIds:  [],
    });
    setModal(true);
    fetch(`/api/schedules/students?scheduleId=${s.id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: StudentInfo[]) => {
        setStudents(data);
        const selected = data
          .filter(st => st.currentScheduleId === s.id)
          .map(st => st.id);
        setForm(f => ({ ...f, studentIds: selected }));
      })
      .catch(() => setStudError("No se pudieron cargar los alumnos."))
      .finally(() => setStudLoading(false));
  }

  /* ── "Add students" from expanded row ── */

  function openAddStudents(scheduleId: string) {
    setSearch(""); setBeltFilter(""); setAgeMin(""); setAgeMax("");
    setStudents([]); setStudLoading(true); setStudError("");

    const s = schedules.find(sc => sc.id === scheduleId);
    if (!s) return;

    const currentIds = s.studentSchedules.map(ss => ss.student.id);
    setForm(f => ({ ...f, id: scheduleId, studentIds: currentIds }));
    setAddModal(scheduleId);
    loadStudents(scheduleId);
  }

  async function saveAddStudents() {
    if (!addModal) return;
    setSaving(true);
    await fetch(`/api/schedules/${addModal}/students`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds: form.studentIds }),
    });
    setSaving(false);
    setAddModal(null);
    load();
  }

  /* ── Remove student from schedule (expanded view) ── */

  async function removeStudentFromSchedule(scheduleId: string, studentId: string, studentName: string) {
    if (!confirm(`¿Quitar a ${studentName} de este horario?`)) return;

    const s = schedules.find(sc => sc.id === scheduleId);
    if (!s) return;

    const remainingIds = s.studentSchedules
      .map(ss => ss.student.id)
      .filter(id => id !== studentId);

    await fetch(`/api/schedules/${scheduleId}/students`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds: remainingIds }),
    });

    load();
  }

  /* ── Form helpers ── */

  function toggleDay(key: string) {
    setForm(f => ({
      ...f,
      days: f.days.includes(key) ? f.days.filter(d => d !== key) : [...f.days, key],
    }));
  }

  function toggleStudent(id: string) {
    setForm(f => ({
      ...f,
      studentIds: f.studentIds.includes(id)
        ? f.studentIds.filter(s => s !== id)
        : [...f.studentIds, id],
    }));
  }

  async function save() {
    if (!form.name.trim()) { setError("El nombre es obligatorio."); return; }
    if (form.days.length === 0) { setError("Selecciona al menos un día."); return; }
    setSaving(true);
    setError("");

    const isEdit = Boolean(form.id);
    const url    = isEdit ? `/api/schedules/${form.id}` : "/api/schedules";
    const method = isEdit ? "PUT" : "POST";

    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setError(data.error ?? "Error al guardar.");
      setSaving(false);
      return;
    }

    const saved = await r.json();
    const scheduleId = isEdit ? form.id! : saved.id;

    await fetch(`/api/schedules/${scheduleId}/students`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds: form.studentIds }),
    });

    setSaving(false);
    setModal(false);
    load();
  }

  async function deleteSchedule(id: string) {
    if (!confirm("¿Eliminar este horario? Los alumnos asignados quedarán sin horario, pero sus marcaciones de asistencia se conservarán.")) return;
    setDeleting(id);
    await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  }

  function clearFilters() {
    setSearch(""); setBeltFilter(""); setAgeMin(""); setAgeMax("");
  }

  const hasFilters = !!(search || beltFilter || ageMin || ageMax);

  const filteredStudents = students.filter(s => {
    const name = (s.fullName || `${s.firstName} ${s.lastName}`).toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (beltFilter && s.belt.toLowerCase() !== beltFilter.toLowerCase()) return false;
    if (ageMin && s.age < Number(ageMin)) return false;
    if (ageMax && s.age > Number(ageMax)) return false;
    return true;
  });

  const selectedCount = form.studentIds.length;

  /* ── Student picker JSX (reused in both modals) ── */

  function renderStudentPicker() {
    return (
      <div className="border-t border-dojo-border pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-dojo-gold" />
            <p className="text-dojo-white text-sm font-semibold">Alumnos asignados</p>
          </div>
          {selectedCount > 0 && (
            <span className="text-xs bg-dojo-gold/20 text-dojo-gold px-2 py-0.5 rounded-full font-medium">
              {selectedCount} seleccionado{selectedCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-2">
          <div className="relative col-span-2">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input pl-8 py-1.5 text-sm"
              placeholder="Buscar alumno..."
            />
          </div>
          <select
            value={beltFilter}
            onChange={e => setBeltFilter(e.target.value)}
            className="form-input py-1.5 text-sm"
          >
            <option value="">Todas las cintas</option>
            {BELT_COLORS.map(b => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
          <div className="flex gap-1">
            <input
              type="number"
              value={ageMin}
              onChange={e => setAgeMin(e.target.value)}
              className="form-input py-1.5 text-sm w-full"
              placeholder="Edad min."
              min={0}
            />
            <input
              type="number"
              value={ageMax}
              onChange={e => setAgeMax(e.target.value)}
              className="form-input py-1.5 text-sm w-full"
              placeholder="Edad max."
              min={0}
            />
          </div>
        </div>

        {/* Student list */}
        <div className="max-h-56 overflow-y-auto rounded-lg border border-dojo-border bg-dojo-darker space-y-px">
          {studLoading && (
            <p className="text-center text-dojo-muted text-sm py-6">Cargando alumnos...</p>
          )}
          {!studLoading && studError && (
            <p className="text-center text-red-400 text-sm py-6">{studError}</p>
          )}
          {!studLoading && !studError && filteredStudents.length === 0 && (
            <div className="text-center text-dojo-muted text-sm py-6 space-y-2">
              <p>{students.length === 0 ? "No hay alumnos activos en el dojo." : "Ningún alumno coincide con los filtros."}</p>
              {hasFilters && (
                <button type="button" onClick={clearFilters} className="text-dojo-gold text-xs hover:underline">
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
          {!studLoading && filteredStudents.map(st => {
            const isSelected = form.studentIds.includes(st.id);
            const inOther    = st.currentScheduleId !== null
                            && st.currentScheduleId !== form.id
                            && !isSelected;
            const belt       = getBeltInfo(st.belt);

            return (
              <button
                key={st.id}
                type="button"
                onClick={() => toggleStudent(st.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  isSelected
                    ? "bg-dojo-red/20 hover:bg-dojo-red/30"
                    : "hover:bg-dojo-dark"
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? "bg-dojo-red border-dojo-red" : "border-dojo-border bg-transparent"
                }`}>
                  {isSelected && <CheckCircle2 size={12} className="text-white" />}
                </div>

                <div
                  className="w-3 h-3 rounded-full shrink-0 border border-white/20"
                  style={{ backgroundColor: belt.hex }}
                  title={belt.label}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-dojo-white text-sm truncate">{st.fullName}</p>
                  <p className="text-dojo-muted text-xs">{st.age} años · {belt.label}</p>
                </div>

                {inOther && (
                  <div className="flex items-center gap-1 text-xs text-amber-400 shrink-0">
                    <AlertCircle size={12} />
                    <span className="hidden sm:inline truncate max-w-[100px]">{st.currentScheduleName}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Render ── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
            <Clock size={24} className="text-dojo-red" /> Horarios de Clases
          </h1>
          <p className="text-dojo-muted text-sm mt-1">{schedules.length} horario(s) registrado(s)</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} /> Nuevo Horario
        </button>
      </div>

      {/* Loading */}
      {loading && <div className="text-center py-20 text-dojo-muted">Cargando...</div>}

      {/* Empty state */}
      {!loading && schedules.length === 0 && (
        <div className="text-center py-16 text-dojo-muted">
          <Clock size={48} className="mx-auto mb-4 opacity-30" />
          <p>No hay horarios registrados.</p>
          <p className="text-sm mt-1">Crea el primer horario para comenzar a registrar asistencias.</p>
        </div>
      )}

      {/* Schedule rows (accordion) */}
      {!loading && schedules.length > 0 && (
        <div className="space-y-2">
          {schedules.map(s => {
            const days = parseDays(s.days);
            const isExpanded = expanded.has(s.id);
            const studentCount = s._count.studentSchedules;

            return (
              <div key={s.id} className={`card p-0 overflow-hidden ${!s.active ? "opacity-60" : ""}`}>
                {/* Collapsed row header */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(s.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-dojo-darker/50 transition-colors"
                >
                  {/* Chevron */}
                  <span className="text-dojo-muted shrink-0">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>

                  {/* Name */}
                  <span className="font-semibold text-dojo-white truncate min-w-0 shrink">
                    {s.name}
                  </span>

                  {/* Days chips */}
                  <div className="hidden sm:flex items-center gap-1 shrink-0">
                    {ALL_DAYS.map(d => (
                      <span
                        key={d.key}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${
                          days.includes(d.key)
                            ? "bg-dojo-red text-white"
                            : "bg-dojo-darker text-dojo-muted"
                        }`}
                      >
                        {d.label}
                      </span>
                    ))}
                  </div>

                  {/* Time */}
                  <span className="text-dojo-gold font-mono text-sm shrink-0">
                    {s.startTime} – {s.endTime}
                  </span>

                  {/* Student count badge */}
                  <span className="badge-blue shrink-0 flex items-center gap-1">
                    <Users size={11} />
                    {studentCount}
                  </span>

                  {/* Active badge */}
                  <span className={`shrink-0 ${s.active ? "badge-green" : "badge-red"}`}>
                    {s.active ? "Activo" : "Inactivo"}
                  </span>

                  {/* Spacer */}
                  <span className="flex-1" />

                  {/* Actions (stop propagation so clicking them doesn't toggle expand) */}
                  <span className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openEdit(s)}
                      className="btn-ghost p-1.5 text-dojo-muted hover:text-dojo-white"
                      title="Editar"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => deleteSchedule(s.id)}
                      disabled={deleting === s.id}
                      className="btn-ghost p-1.5 text-dojo-muted hover:text-red-400"
                      title="Eliminar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </span>
                </button>

                {/* Mobile days row (visible below sm) */}
                {isExpanded && (
                  <div className="flex sm:hidden items-center gap-1 px-4 pb-2">
                    {ALL_DAYS.map(d => (
                      <span
                        key={d.key}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${
                          days.includes(d.key)
                            ? "bg-dojo-red text-white"
                            : "bg-dojo-darker text-dojo-muted"
                        }`}
                      >
                        {d.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-dojo-border px-4 py-3 space-y-3">
                    {s.description && (
                      <p className="text-xs text-dojo-muted leading-relaxed">{s.description}</p>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openAddStudents(s.id)}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        <Plus size={14} /> Agregar alumnos
                      </button>
                    </div>

                    {/* Students table */}
                    {studentCount === 0 ? (
                      <p className="text-dojo-muted text-sm py-4 text-center">
                        No hay alumnos asignados a este horario.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-dojo-border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-dojo-darker text-dojo-muted text-xs">
                              <th className="text-left px-3 py-2 font-medium">Nombre del alumno</th>
                              <th className="text-left px-3 py-2 font-medium">Cinta</th>
                              <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Ultima entrada</th>
                              <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Ultima salida</th>
                              <th className="text-right px-3 py-2 font-medium">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.studentSchedules.map(ss => {
                              const st = ss.student;
                              const beltColor = st.beltHistory[0]?.beltColor ?? "blanca";
                              const entryAtt = st.attendances.find(a => a.type === "entry");
                              const exitAtt  = st.attendances.find(a => a.type === "exit");

                              return (
                                <tr key={st.id} className="border-t border-dojo-border hover:bg-dojo-darker/50 transition-colors">
                                  <td className="px-3 py-2 text-dojo-white">{st.fullName}</td>
                                  <td className="px-3 py-2">
                                    <BeltBadge beltColor={beltColor} size="sm" />
                                  </td>
                                  <td className="px-3 py-2 text-dojo-muted hidden md:table-cell">
                                    {entryAtt ? formatAttendanceDate(entryAtt.markedAt) : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-dojo-muted hidden md:table-cell">
                                    {exitAtt ? formatAttendanceDate(exitAtt.markedAt) : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      onClick={() => removeStudentFromSchedule(s.id, st.id, st.fullName)}
                                      className="btn-ghost p-1.5 text-dojo-muted hover:text-red-400"
                                      title="Quitar alumno"
                                    >
                                      <UserMinus size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Attendance count footer */}
                    <div className="flex items-center gap-1.5 text-xs text-dojo-muted pt-1">
                      <Clock size={12} />
                      <span>{s._count.attendances} marcaciones totales</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit modal ── */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={form.id ? "Editar Horario" : "Nuevo Horario"}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Nombre *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="form-input"
              placeholder="Ej. Clase infantil mañana"
            />
          </div>

          <div>
            <label className="form-label">Días de clase *</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ALL_DAYS.map(d => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    form.days.includes(d.key)
                      ? "bg-dojo-red border-dojo-red text-white"
                      : "bg-dojo-darker border-dojo-border text-dojo-muted hover:border-dojo-red/50 hover:text-dojo-white"
                  }`}
                >
                  {d.full}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Hora inicio *</label>
              <input
                type="time"
                value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Hora fin *</label>
              <input
                type="time"
                value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className="form-input"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Descripción</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="form-input min-h-[60px] resize-none"
              placeholder="Descripción opcional del horario..."
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-dojo-dark rounded-lg border border-dojo-border">
            <input
              type="checkbox"
              id="sch-active"
              checked={form.active}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              className="w-4 h-4 accent-dojo-red"
            />
            <label htmlFor="sch-active" className="text-sm text-dojo-white cursor-pointer">
              Horario activo
            </label>
          </div>

          {renderStudentPicker()}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">
              <X size={16} /> Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn-primary"
            >
              <Save size={16} /> {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Add students modal (from expanded row) ── */}
      <Modal
        open={addModal !== null}
        onClose={() => setAddModal(null)}
        title="Agregar alumnos"
        size="lg"
      >
        <div className="space-y-4">
          {renderStudentPicker()}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setAddModal(null)} className="btn-secondary">
              <X size={16} /> Cancelar
            </button>
            <button
              type="button"
              onClick={saveAddStudents}
              disabled={saving}
              className="btn-primary"
            >
              <Save size={16} /> {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
