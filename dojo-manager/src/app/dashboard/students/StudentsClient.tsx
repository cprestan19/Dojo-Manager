"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Users, Plus, Search, Edit, Eye, ChevronRight, UserX } from "lucide-react";
import { getBeltInfo, BELT_COLORS } from "@/lib/utils";
import { BeltBadge } from "@/components/ui/BeltBadge";
import { calculateAge, formatDate } from "@/lib/utils";

export interface StudentRow {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  nationality: string;
  active: boolean;
  beltHistory: { beltColor: string }[];
  payments: { status: string; dueDate: string }[];
}

type ActiveFilter = "active" | "inactive" | "all";

export function StudentsClient({ initialStudents }: { initialStudents: StudentRow[] }) {
  const [students,     setStudents]     = useState<StudentRow[]>(initialStudents);
  const [search,       setSearch]       = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [beltFilter,   setBeltFilter]   = useState("");
  const [loading,      setLoading]      = useState(false);
  const skipFirstFetch = useRef(true);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ search });
    if (activeFilter !== "all") params.set("active", activeFilter === "active" ? "true" : "false");
    const res = await fetch(`/api/students?${params}`);
    if (res.ok) setStudents(await res.json());
    setLoading(false);
  }, [search, activeFilter]);

  useEffect(() => {
    if (skipFirstFetch.current && search === "" && activeFilter === "active") {
      skipFirstFetch.current = false;
      return;
    }
    skipFirstFetch.current = false;
    const t = setTimeout(fetchStudents, 300);
    return () => clearTimeout(t);
  }, [fetchStudents, search, activeFilter]);

  const displayed = beltFilter
    ? students.filter(s => (s.beltHistory[0]?.beltColor ?? "") === beltFilter)
    : students;

  const beltsInList = Array.from(
    new Set(students.map(s => s.beltHistory[0]?.beltColor).filter(Boolean) as string[])
  );

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
            <Users size={24} className="text-dojo-red" /> Alumnos
          </h1>
          <p className="text-dojo-muted text-sm mt-1">
            {displayed.length} alumno(s)
            {activeFilter === "active" ? " activo(s)" : activeFilter === "inactive" ? " inactivo(s)" : " en total"}
            {beltFilter && ` · ${getBeltInfo(beltFilter)?.label ?? beltFilter}`}
          </p>
        </div>
        <Link href="/dashboard/students/new" className="btn-primary">
          <Plus size={18} /> Nuevo Alumno
        </Link>
      </div>

      {/* Filter: activos / inactivos / todos */}
      <div className="flex items-center gap-1 bg-dojo-dark border border-dojo-border rounded-lg p-1 w-fit">
        {(["active","all","inactive"] as const).map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeFilter === f
                ? f === "inactive"
                  ? "bg-red-900/50 text-red-300"
                  : "bg-dojo-red text-white"
                : "text-dojo-muted hover:text-dojo-white"
            }`}
          >
            {f === "active" ? "Activos" : f === "inactive" ? "Inactivos" : "Todos"}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-input pl-9 max-w-sm"
          placeholder="Buscar por nombre..."
        />
      </div>

      {/* Filter: cinta */}
      {beltsInList.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setBeltFilter("")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              beltFilter === ""
                ? "bg-dojo-red border-dojo-red text-white"
                : "border-dojo-border text-dojo-muted hover:text-dojo-white hover:border-dojo-border/80"
            }`}
          >
            Todas
          </button>
          {BELT_COLORS
            .filter(b => beltsInList.includes(b.value))
            .map(b => {
              const active = beltFilter === b.value;
              return (
                <button
                  key={b.value}
                  onClick={() => setBeltFilter(active ? "" : b.value)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                  style={{
                    backgroundColor: active ? b.hex + "40" : "transparent",
                    borderColor:     active ? b.hex : "#2A3550",
                    color:           active ? (b.hex === "#FFFFFF" ? "#ccc" : b.hex) : "#8892A4",
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: b.hex, border: "1px solid rgba(255,255,255,0.2)" }}
                  />
                  {b.label}
                  <span className="opacity-60">
                    ({students.filter(s => (s.beltHistory[0]?.beltColor ?? "") === b.value).length})
                  </span>
                </button>
              );
            })}
        </div>
      )}

      {/* ── Vista mobile: tarjetas tappables ── */}
      <div className="block lg:hidden space-y-2">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-4 border-dojo-red border-t-transparent animate-spin" />
          </div>
        )}
        {!loading && displayed.length === 0 && (
          <div className="text-center py-12 text-dojo-muted">
            <p>{beltFilter ? "No hay alumnos con esa cinta." : "No se encontraron alumnos."}</p>
            {!beltFilter && (
              <Link href="/dashboard/students/new" className="text-dojo-red text-sm hover:underline mt-1 inline-block">
                Crear el primero
              </Link>
            )}
          </div>
        )}
        {!loading && displayed.map(s => {
          const belt    = s.beltHistory[0]?.beltColor;
          const payment = s.payments[0];
          const age     = calculateAge(s.birthDate);
          const beltInfo = belt ? getBeltInfo(belt) : null;
          return (
            <Link
              key={s.id}
              href={`/dashboard/students/${s.id}`}
              className={`flex items-center gap-3 p-4 border rounded-2xl active:opacity-70 transition-colors ${
                s.active
                  ? "bg-dojo-dark border-dojo-border"
                  : "bg-dojo-darker border-dojo-border/50 opacity-70"
              }`}
            >
              <div className="w-11 h-11 bg-dojo-border rounded-full flex items-center justify-center text-sm font-bold text-dojo-gold shrink-0">
                {s.fullName.split(" ").slice(0, 2).map(w => w[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-dojo-white truncate">{s.fullName}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-dojo-muted">{age} a.</span>
                  {beltInfo ? (
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: beltInfo.hex + "25",
                        color: beltInfo.hex === "#FFFFFF" ? "#ccc" : beltInfo.hex,
                        border: `1px solid ${beltInfo.hex}40`,
                      }}
                    >
                      {beltInfo.label}
                    </span>
                  ) : (
                    <span className="text-xs text-dojo-muted">Sin cinta</span>
                  )}
                  {!s.active && (
                    <span className="flex items-center gap-1 text-xs text-red-400 font-semibold">
                      <UserX size={10}/> Inactivo
                    </span>
                  )}
                  {s.active && !payment && <span className="badge-green text-xs">Al día</span>}
                  {s.active && payment && (
                    <span className={
                      payment.status === "late"    ? "badge-red text-xs"    :
                      payment.status === "pending" ? "badge-yellow text-xs" : "badge-green text-xs"
                    }>
                      {payment.status === "late" ? "Atrasado" : payment.status === "pending" ? "Pendiente" : "Al día"}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={18} className="text-dojo-muted shrink-0" />
            </Link>
          );
        })}
      </div>

      {/* ── Vista desktop: tabla ── */}
      <div className="hidden lg:block card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dojo-border">
              <th className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-6 py-3">Alumno</th>
              <th className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3">Edad</th>
              <th className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3">Cinta</th>
              <th className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3">Estado Pago</th>
              <th className="text-right text-xs font-semibold text-dojo-muted uppercase tracking-wider px-6 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="text-center py-12 text-dojo-muted">Buscando...</td></tr>
            )}
            {!loading && displayed.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-dojo-muted">
                {beltFilter ? "No hay alumnos con esa cinta." : "No se encontraron alumnos."}
                {!beltFilter && <>{" "}<Link href="/dashboard/students/new" className="text-dojo-red hover:underline">Crear el primero</Link></>}
              </td></tr>
            )}
            {!loading && displayed.map(s => {
              const belt    = s.beltHistory[0]?.beltColor;
              const payment = s.payments[0];
              const age     = calculateAge(s.birthDate);
              return (
                <tr key={s.id} className={`border-b border-dojo-border/50 transition-colors ${s.active ? "hover:bg-dojo-border/20" : "opacity-60 hover:opacity-80"}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-dojo-border rounded-full flex items-center justify-center text-xs font-bold text-dojo-gold shrink-0">
                        {s.fullName.split(" ").slice(0,2).map(w => w[0]).join("")}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-dojo-white">{s.fullName}</p>
                          {!s.active && (
                            <span className="flex items-center gap-1 text-xs text-red-400 font-semibold">
                              <UserX size={10}/> Inactivo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-dojo-muted">{s.nationality} · {s.gender === "M" ? "Masculino" : "Femenino"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-dojo-muted">{age} años</td>
                  <td className="px-4 py-4">
                    {belt ? <BeltBadge beltColor={belt} /> : <span className="text-dojo-muted text-xs">Sin cinta</span>}
                  </td>
                  <td className="px-4 py-4">
                    {payment ? (
                      <span className={
                        payment.status === "late"    ? "badge-red"    :
                        payment.status === "pending" ? "badge-yellow" : "badge-green"
                      }>
                        {payment.status === "late"
                          ? "Atrasado"
                          : payment.status === "pending"
                          ? `Vence ${formatDate(payment.dueDate)}`
                          : "Al día"}
                      </span>
                    ) : (
                      <span className="badge-green">Al día</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/dashboard/students/${s.id}`} className="btn-ghost p-2 text-dojo-muted">
                        <Eye size={16} />
                      </Link>
                      <Link href={`/dashboard/students/${s.id}/edit`} className="btn-ghost p-2 text-dojo-muted">
                        <Edit size={16} />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>{/* end desktop */}
    </div>
  );
}
