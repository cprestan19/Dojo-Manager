"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Search, Check, Trophy, Calendar, MapPin, Users } from "lucide-react";
import { getBeltInfo } from "@/lib/utils";
import { calcAge } from "@/lib/tournament-events";

interface Student {
  id: string; fullName: string; birthDate: string; photo: string | null;
  beltHistory: { beltColor: string }[];
  studentCode: number | null;
}

type Step = "details" | "students";

export default function NewTournamentEventPage() {
  const router = useRouter();
  const [step,    setStep]    = useState<Step>("details");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  // Step 1: detalles del torneo
  const [form, setForm] = useState({ name: "", date: "", location: "", notes: "" });

  // Step 2: selección de alumnos
  const [students,   setStudents]   = useState<Student[]>([]);
  const [loadingStu, setLoadingStu] = useState(false);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [search,     setSearch]     = useState("");
  const [beltFilter, setBeltFilter] = useState("");
  const [ageMin,     setAgeMin]     = useState("");
  const [ageMax,     setAgeMax]     = useState("");

  function setField(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); setError(""); }

  function goToStudents() {
    if (!form.name.trim() || !form.date || !form.location.trim()) {
      setError("Completa nombre, fecha y lugar del torneo");
      return;
    }
    setStep("students");
    if (students.length === 0) {
      setLoadingStu(true);
      fetch("/api/students?active=true")
        .then(r => r.ok ? r.json() : [])
        .then(setStudents)
        .finally(() => setLoadingStu(false));
    }
  }

  const filtered = useMemo(() => students.filter(s => {
    const age = calcAge(s.birthDate);
    const belt = s.beltHistory[0]?.beltColor ?? "";
    if (search     && !s.fullName.toLowerCase().includes(search.toLowerCase())) return false;
    if (beltFilter && belt !== beltFilter) return false;
    if (ageMin     && age < parseInt(ageMin)) return false;
    if (ageMax     && age > parseInt(ageMax)) return false;
    return true;
  }), [students, search, beltFilter, ageMin, ageMax]);

  const belts = useMemo(() =>
    [...new Set(students.map(s => s.beltHistory[0]?.beltColor).filter(Boolean) as string[])].sort(),
    [students]
  );

  function toggleStudent(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    if (filtered.every(s => selected.has(s.id))) {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(s => n.delete(s.id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(s => n.add(s.id)); return n; });
    }
  }

  async function handleCreate() {
    if (selected.size === 0) { setError("Selecciona al menos un alumno"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/tournament-events", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...form, studentIds: [...selected] }),
      });

      // Si el servidor devuelve HTML (ej: error 500 por caché de Prisma), lo detectamos
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        setError(`Error del servidor (HTTP ${res.status}). Reinicia el servidor de desarrollo y vuelve a intentarlo.`);
        return;
      }

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al crear torneo"); return; }
      router.push(`/dashboard/tournament-events/${data.id}`);
    } catch (e) {
      setError(`Error de conexión: ${e instanceof Error ? e.message : "verifica tu internet"}`);
    }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Cabecera */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => step === "details" ? router.back() : setStep("details")}
          className="p-2 rounded-lg hover:bg-dojo-border transition-colors text-dojo-muted hover:text-dojo-white"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white flex items-center gap-2">
            <Trophy size={22} className="text-dojo-red" />
            {step === "details" ? "Datos del Torneo" : "Confirmar Asistentes"}
          </h1>
          <p className="text-dojo-muted text-sm mt-0.5">
            {step === "details" ? "Paso 1 de 2 — información del evento" : "Paso 2 de 2 — selecciona quiénes asistirán"}
          </p>
        </div>
      </div>

      {/* Indicador de pasos */}
      <div className="flex items-center gap-3">
        {(["details","students"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? "bg-dojo-red text-white" :
              (step === "students" && s === "details") ? "bg-green-600 text-white" : "bg-dojo-border text-dojo-muted"
            }`}>
              {step === "students" && s === "details" ? <Check size={12} /> : i + 1}
            </div>
            <span className={`text-sm ${step === s ? "text-dojo-white font-semibold" : "text-dojo-muted"}`}>
              {s === "details" ? "Datos del torneo" : "Alumnos"}
            </span>
            {i === 0 && <div className="w-8 h-px bg-dojo-border" />}
          </div>
        ))}
      </div>

      {/* ── PASO 1: Detalles ── */}
      {step === "details" && (
        <div className="card space-y-4">
          <div>
            <label className="form-label">Nombre del Torneo *</label>
            <input className="form-input" placeholder="Ej: Copa Nacional FEPAKA 2025"
              value={form.name} onChange={e => setField("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Fecha del Evento *</label>
              <input type="datetime-local" className="form-input"
                value={form.date} onChange={e => setField("date", e.target.value)} />
            </div>
            <div>
              <label className="form-label">Sede / Lugar *</label>
              <input className="form-input" placeholder="Ej: Gimnasio Nacional"
                value={form.location} onChange={e => setField("location", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="form-label">Notas (opcional)</label>
            <textarea className="form-input min-h-[70px] resize-none"
              placeholder="Observaciones del evento..."
              value={form.notes} onChange={e => setField("notes", e.target.value)} />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={goToStudents} className="btn-primary w-full justify-center gap-2">
            Siguiente — Seleccionar Alumnos <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* ── PASO 2: Alumnos ── */}
      {step === "students" && (
        <div className="space-y-4">
          {/* Resumen del torneo */}
          <div className="card bg-dojo-darker space-y-1">
            <p className="font-bold text-dojo-white flex items-center gap-2">
              <Trophy size={15} className="text-dojo-red" /> {form.name}
            </p>
            <p className="text-dojo-muted text-xs flex items-center gap-1.5">
              <Calendar size={11} />
              {new Date(form.date).toLocaleDateString("es-PA", { dateStyle: "full" })}
            </p>
            <p className="text-dojo-muted text-xs flex items-center gap-1.5">
              <MapPin size={11} /> {form.location}
            </p>
          </div>

          {/* Filtros */}
          <div className="card space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
              <input className="form-input pl-8" placeholder="Buscar por nombre..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="col-span-2 sm:col-span-1">
                <label className="form-label">Cinta</label>
                <select className="form-input" value={beltFilter} onChange={e => setBeltFilter(e.target.value)}>
                  <option value="">Todas</option>
                  {belts.map(b => (
                    <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1).replace(/-/g," ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Edad mín.</label>
                <input type="number" className="form-input" placeholder="0" min={0} max={99}
                  value={ageMin} onChange={e => setAgeMin(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Edad máx.</label>
                <input type="number" className="form-input" placeholder="99" min={0} max={99}
                  value={ageMax} onChange={e => setAgeMax(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Cabecera lista */}
          <div className="flex items-center justify-between">
            <p className="text-dojo-muted text-sm">
              {loadingStu ? "Cargando..." : `${filtered.length} alumnos · ${selected.size} seleccionados`}
            </p>
            <button onClick={toggleAll} className="text-xs text-dojo-red hover:underline">
              {filtered.every(s => selected.has(s.id)) ? "Deseleccionar todos" : "Seleccionar todos"}
            </button>
          </div>

          {/* Lista */}
          {loadingStu ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-4 border-dojo-red border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {filtered.map(s => {
                const belt = s.beltHistory[0]?.beltColor;
                const bInfo = belt ? getBeltInfo(belt) : null;
                const age   = calcAge(s.birthDate);
                const isSel = selected.has(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => toggleStudent(s.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      isSel
                        ? "border-dojo-red bg-dojo-red/10"
                        : "border-dojo-border hover:border-dojo-border/80 bg-dojo-card"
                    }`}
                  >
                    {/* Checkbox */}
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                      isSel ? "bg-dojo-red border-dojo-red" : "border-dojo-border"
                    }`}>
                      {isSel && <Check size={11} className="text-white" strokeWidth={3} />}
                    </div>
                    {/* Foto/iniciales */}
                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-dojo-darker flex items-center justify-center shrink-0">
                      {s.photo
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={s.photo} alt={s.fullName} className="w-full h-full object-cover" />
                        : <span className="text-dojo-gold font-bold text-xs">
                            {s.fullName.split(" ").slice(0,2).map(w=>w[0]).join("")}
                          </span>
                      }
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-dojo-white text-sm truncate">{s.fullName}</p>
                      <p className="text-dojo-muted text-xs">{age} años</p>
                    </div>
                    {/* Cinta */}
                    {bInfo && (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="w-2.5 h-2.5 rounded-full border border-white/20"
                          style={{ backgroundColor: bInfo.hex }} />
                        <span className="text-xs text-dojo-muted hidden sm:block">{bInfo.label}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={saving || selected.size === 0}
            className="btn-primary w-full justify-center gap-2 py-3"
          >
            <Users size={16} />
            {saving
              ? "Creando torneo..."
              : `Crear torneo con ${selected.size} alumno${selected.size !== 1 ? "s" : ""}`
            }
          </button>
        </div>
      )}
    </div>
  );
}
