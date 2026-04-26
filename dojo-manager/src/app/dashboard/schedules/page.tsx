"use client";
import { useState, useEffect, useCallback } from "react";
import { Clock, Plus, Edit2, Trash2, Save, X, Users, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface Schedule {
  id: string;
  name: string;
  days: string;
  startTime: string;
  endTime: string;
  description: string | null;
  active: boolean;
  _count: { attendances: number };
  _studentCount?: number;
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

const ALL_DAYS = [
  { key: "lunes",     label: "Lun", full: "Lunes"     },
  { key: "martes",    label: "Mar", full: "Martes"    },
  { key: "miercoles", label: "Mié", full: "Miércoles" },
  { key: "jueves",    label: "Jue", full: "Jueves"    },
  { key: "viernes",   label: "Vie", full: "Viernes"   },
  { key: "sabado",    label: "Sáb", full: "Sábado"    },
  { key: "domingo",   label: "Dom", full: "Domingo"   },
];

const BELT_COLORS: Record<string, string> = {
  blanco:         "bg-white border border-gray-300",
  amarillo:       "bg-yellow-400",
  naranja:        "bg-orange-500",
  verde:          "bg-green-600",
  azul:           "bg-blue-600",
  morado:         "bg-purple-600",
  rojo:           "bg-red-600",
  cafe:           "bg-amber-800",
  negro:          "bg-gray-900 border border-gray-600",
};

const ALL_BELTS = ["blanco","amarillo","naranja","verde","azul","morado","rojo","cafe","negro"];

function emptyForm(): FormState {
  return { name: "", days: [], startTime: "08:00", endTime: "09:00", description: "", active: true, studentIds: [] };
}

function parseDays(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

export default function SchedulesPage() {
  const [schedules,   setSchedules]   = useState<Schedule[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(false);
  const [form,        setForm]        = useState<FormState>(emptyForm());
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState<string | null>(null);
  const [error,       setError]       = useState("");

  // Student picker state
  const [students,    setStudents]    = useState<StudentInfo[]>([]);
  const [studLoading, setStudLoading] = useState(true);
  const [studError,   setStudError]   = useState("");
  const [search,      setSearch]      = useState("");
  const [beltFilter,  setBeltFilter]  = useState("");
  const [ageMin,      setAgeMin]      = useState("");
  const [ageMax,      setAgeMax]      = useState("");

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
    // Load students and pre-select those assigned to this schedule
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

    // Sync student assignments
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
    if (!confirm("¿Eliminar este horario? Se perderán todas las marcaciones asociadas.")) return;
    setDeleting(id);
    await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  }

  function clearFilters() {
    setSearch(""); setBeltFilter(""); setAgeMin(""); setAgeMax("");
  }

  const hasFilters = !!(search || beltFilter || ageMin || ageMax);

  // Filtered student list for picker
  const filteredStudents = students.filter(s => {
    const name = (s.fullName || `${s.firstName} ${s.lastName}`).toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (beltFilter && s.belt.toLowerCase() !== beltFilter.toLowerCase()) return false;
    if (ageMin && s.age < Number(ageMin)) return false;
    if (ageMax && s.age > Number(ageMax)) return false;
    return true;
  });

  const selectedCount = form.studentIds.length;

  return (
    <div className="space-y-6">
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

      {loading && <div className="text-center py-20 text-dojo-muted">Cargando...</div>}

      {!loading && schedules.length === 0 && (
        <div className="text-center py-16 text-dojo-muted">
          <Clock size={48} className="mx-auto mb-4 opacity-30" />
          <p>No hay horarios registrados.</p>
          <p className="text-sm mt-1">Crea el primer horario para comenzar a registrar asistencias.</p>
        </div>
      )}

      {!loading && schedules.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {schedules.map(s => {
            const days = parseDays(s.days);
            return (
              <div key={s.id} className={`card space-y-4 ${!s.active ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-dojo-white truncate">{s.name}</p>
                    <p className="text-dojo-gold font-mono text-sm mt-0.5">
                      {s.startTime} – {s.endTime}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
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
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {ALL_DAYS.map(d => (
                    <span
                      key={d.key}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        days.includes(d.key)
                          ? "bg-dojo-red text-white"
                          : "bg-dojo-darker text-dojo-muted"
                      }`}
                    >
                      {d.label}
                    </span>
                  ))}
                </div>

                {s.description && (
                  <p className="text-xs text-dojo-muted leading-relaxed">{s.description}</p>
                )}

                <div className="flex items-center justify-between border-t border-dojo-border pt-3">
                  <div className="flex items-center gap-1.5 text-xs text-dojo-muted">
                    <Users size={12} />
                    <span>{s._count.attendances} marcaciones</span>
                  </div>
                  <span className={s.active ? "badge-green" : "badge-red"}>
                    {s.active ? "Activo" : "Inactivo"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={form.id ? "Editar Horario" : "Nuevo Horario"}
        size="lg"
      >
        <div className="space-y-4">
          {/* ── Schedule fields ── */}
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

          {/* ── Student picker ── */}
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
                {ALL_BELTS.map(b => (
                  <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>
                ))}
              </select>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={ageMin}
                  onChange={e => setAgeMin(e.target.value)}
                  className="form-input py-1.5 text-sm w-full"
                  placeholder="Edad mín."
                  min={0}
                />
                <input
                  type="number"
                  value={ageMax}
                  onChange={e => setAgeMax(e.target.value)}
                  className="form-input py-1.5 text-sm w-full"
                  placeholder="Edad máx."
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
                const beltClass  = BELT_COLORS[st.belt] ?? "bg-gray-500";

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
                    {/* Checkbox */}
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? "bg-dojo-red border-dojo-red" : "border-dojo-border bg-transparent"
                    }`}>
                      {isSelected && <CheckCircle2 size={12} className="text-white" />}
                    </div>

                    {/* Belt dot */}
                    <div className={`w-3 h-3 rounded-full shrink-0 ${beltClass}`} title={st.belt} />

                    {/* Name + age */}
                    <div className="flex-1 min-w-0">
                      <p className="text-dojo-white text-sm truncate">
                        {st.fullName}
                      </p>
                      <p className="text-dojo-muted text-xs">{st.age} años · {st.belt}</p>
                    </div>

                    {/* Warning if in another schedule */}
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
    </div>
  );
}
