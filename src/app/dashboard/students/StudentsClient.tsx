"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Users, Plus, Search, Edit, Eye, ChevronRight, UserX,
  ChevronUp, ChevronDown, ChevronsUpDown, MonitorSmartphone,
} from "lucide-react";
import { getBeltInfo, BELT_COLORS } from "@/lib/utils";
import { BeltBadge } from "@/components/ui/BeltBadge";
import { calculateAge, formatDate } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StudentRow {
  id:          string;
  fullName:    string;
  firstName:   string;
  lastName:    string;
  birthDate:   string;
  gender:      string;
  nationality: string;
  active:      boolean;
  photo:       string | null;           // URL Cloudinary (null si no tiene o es base64 legacy)
  familyId:    string | null;
  beltHistory: { beltColor: string }[];
  payments:    { status: string; dueDate: string }[];
  portalUser:  { active: boolean } | null;
}

type ActiveFilter = "active" | "inactive" | "all";
type PortalFilter = "all" | "has" | "none" | "revoked";
type SortField    = "name" | "age" | "belt" | "payment" | "portal";
type SortDir      = "asc" | "desc";

// ── Portal badge ──────────────────────────────────────────────────────────────

function PortalBadge({ portalUser }: { portalUser: { active: boolean } | null }) {
  if (!portalUser)
    return <span className="badge-red text-xs flex items-center gap-1 w-fit">Sin acceso</span>;
  if (!portalUser.active)
    return <span className="badge-yellow text-xs flex items-center gap-1 w-fit">Revocado</span>;
  return <span className="badge-green text-xs flex items-center gap-1 w-fit">Con acceso</span>;
}

// ── Sortable header ───────────────────────────────────────────────────────────

function SortTh({
  label, field, sortField, sortDir, onSort,
  className = "",
}: {
  label: string; field: SortField; sortField: SortField; sortDir: SortDir;
  onSort: (f: SortField) => void; className?: string;
}) {
  const active = sortField === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={`text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3
                  cursor-pointer select-none hover:text-dojo-white transition-colors group ${className}`}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className="text-dojo-border group-hover:text-dojo-muted transition-colors">
          {active
            ? sortDir === "asc" ? <ChevronUp size={12} className="text-dojo-gold" /> : <ChevronDown size={12} className="text-dojo-gold" />
            : <ChevronsUpDown size={12} />
          }
        </span>
      </span>
    </th>
  );
}

// ── Belt order map (for sorting) ──────────────────────────────────────────────

const BELT_ORDER = Object.fromEntries(BELT_COLORS.map((b, i) => [b.value, i]));

// ── Main component ────────────────────────────────────────────────────────────

export function StudentsClient({ initialStudents }: { initialStudents: StudentRow[] }) {
  const [students,      setStudents]      = useState<StudentRow[]>(initialStudents);
  const [search,        setSearch]        = useState("");
  const [activeFilter,  setActiveFilter]  = useState<ActiveFilter>("active");
  const [beltFilter,    setBeltFilter]    = useState("");
  const [portalFilter,  setPortalFilter]  = useState<PortalFilter>("all");
  const [sortField,     setSortField]     = useState<SortField>("name");
  const [sortDir,       setSortDir]       = useState<SortDir>("asc");
  const [loading,       setLoading]       = useState(false);
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

  // ── Toggle sort ─────────────────────────────────────────────────────────────
  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  // ── Pure helper: portal status from student row ──────────────────────────
  function portalStatus(s: StudentRow): "has" | "none" | "revoked" {
    if (!s.portalUser)        return "none";
    if (!s.portalUser.active) return "revoked";
    return "has";
  }

  // ── Memoized: belt chips (only recalculates when students array changes) ──
  const beltsInList = useMemo(() =>
    Array.from(new Set(
      students.map(s => s.beltHistory[0]?.beltColor).filter(Boolean) as string[]
    )),
  [students]);

  // ── Memoized: portal counts (3 filters → 1 loop) ─────────────────────────
  const portalCounts = useMemo(() => {
    const counts = { has: 0, none: 0, revoked: 0 };
    for (const s of students) counts[portalStatus(s)]++;
    return counts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students]);

  // ── Memoized: filter + sort (only recalculates when deps change) ──────────
  const displayed = useMemo(() => {
    // 1. Filter
    const filtered = students.filter(s => {
      if (beltFilter && (s.beltHistory[0]?.beltColor ?? "") !== beltFilter) return false;
      if (portalFilter !== "all" && portalStatus(s) !== portalFilter) return false;
      return true;
    });

    // 2. Sort
    return filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.fullName.localeCompare(b.fullName, "es");
          break;
        case "age":
          cmp = calculateAge(a.birthDate) - calculateAge(b.birthDate);
          break;
        case "belt": {
          const bA = BELT_ORDER[a.beltHistory[0]?.beltColor ?? ""] ?? 999;
          const bB = BELT_ORDER[b.beltHistory[0]?.beltColor ?? ""] ?? 999;
          cmp = bA - bB;
          break;
        }
        case "payment": {
          const payRank = (s: StudentRow) => {
            const p = s.payments[0];
            if (!p) return 0;
            return p.status === "late" ? 2 : p.status === "pending" ? 1 : 0;
          };
          cmp = payRank(a) - payRank(b);
          break;
        }
        case "portal": {
          const pRank = { has: 0, revoked: 1, none: 2 } as const;
          cmp = pRank[portalStatus(a)] - pRank[portalStatus(b)];
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, beltFilter, portalFilter, sortField, sortDir]);

  return (
    <div className="space-y-4 lg:space-y-5">
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
            {portalFilter !== "all" && ` · Portal: ${{ has:"Con acceso", none:"Sin acceso", revoked:"Revocado"}[portalFilter]}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/students/portal-activity"
            className="btn-ghost flex items-center gap-1.5 text-sm"
            title="Ver actividad del portal de alumnos">
            <MonitorSmartphone size={16} /> Portal
          </Link>
          <Link href="/dashboard/students/new" className="btn-primary">
            <Plus size={18} /> Nuevo Alumno
          </Link>
        </div>
      </div>

      {/* Fila de filtros */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Activos / Inactivos / Todos */}
        <div className="flex items-center gap-1 bg-dojo-dark border border-dojo-border rounded-lg p-1">
          {(["active","all","inactive"] as const).map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeFilter === f
                  ? f === "inactive" ? "bg-red-900/50 text-red-300" : "bg-dojo-red text-white"
                  : "text-dojo-muted hover:text-dojo-white"
              }`}
            >
              {f === "active" ? "Activos" : f === "inactive" ? "Inactivos" : "Todos"}
            </button>
          ))}
        </div>

        {/* Filtro acceso portal */}
        <div className="flex items-center gap-1 bg-dojo-dark border border-dojo-border rounded-lg p-1">
          <button onClick={() => setPortalFilter("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 ${
              portalFilter === "all" ? "bg-dojo-red text-white" : "text-dojo-muted hover:text-dojo-white"
            }`}
          >
            <MonitorSmartphone size={11} /> Portal
          </button>
          {[
            { key: "has"    as const, label: `Con acceso (${portalCounts.has})`,    cls: "text-green-400" },
            { key: "none"   as const, label: `Sin acceso (${portalCounts.none})`,   cls: "text-dojo-muted" },
            { key: "revoked"as const, label: `Revocado (${portalCounts.revoked})`,  cls: "text-yellow-400" },
          ].map(opt => (
            <button key={opt.key} onClick={() => setPortalFilter(opt.key)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                portalFilter === opt.key
                  ? "bg-dojo-border/60 " + opt.cls
                  : "text-dojo-muted hover:text-dojo-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="form-input pl-9 max-w-sm" placeholder="Buscar por nombre..." />
      </div>

      {/* Filtro cinta */}
      {beltsInList.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => setBeltFilter("")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              beltFilter === ""
                ? "bg-dojo-red border-dojo-red text-white"
                : "border-dojo-border text-dojo-muted hover:text-dojo-white"
            }`}
          >
            Todas
          </button>
          {BELT_COLORS.filter(b => beltsInList.includes(b.value)).map(b => {
            const isActive = beltFilter === b.value;
            return (
              <button key={b.value} onClick={() => setBeltFilter(isActive ? "" : b.value)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                style={{
                  backgroundColor: isActive ? b.hex + "40" : "transparent",
                  borderColor:     isActive ? b.hex : "rgb(var(--c-border))",
                  color:           isActive ? (b.hex === "#FFFFFF" ? "#ccc" : b.hex) : "rgb(var(--c-text-2))",
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: b.hex, border: `1px solid ${b.hex}60` }} />
                {b.label}
                <span className="opacity-60">
                  ({students.filter(s => (s.beltHistory[0]?.beltColor ?? "") === b.value).length})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Vista mobile: tarjetas ── */}
      <div className="block lg:hidden space-y-2">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-4 border-dojo-red border-t-transparent animate-spin" />
          </div>
        )}
        {!loading && displayed.length === 0 && (
          <div className="text-center py-12 text-dojo-muted">
            <p>No se encontraron alumnos.</p>
            <Link href="/dashboard/students/new" className="text-dojo-red text-sm hover:underline mt-1 inline-block">
              Crear el primero
            </Link>
          </div>
        )}
        {!loading && displayed.map(s => {
          const belt     = s.beltHistory[0]?.beltColor;
          const payment  = s.payments[0];
          const age      = calculateAge(s.birthDate);
          const beltInfo = belt ? getBeltInfo(belt) : null;
          const isUrl    = s.photo?.startsWith("http");
          return (
            <Link key={s.id} href={`/dashboard/students/${s.id}`}
              className={`flex items-center gap-3 p-4 border rounded-2xl active:opacity-70 transition-colors ${
                s.active ? "bg-dojo-dark border-dojo-border" : "bg-dojo-darker border-dojo-border/50 opacity-70"
              }`}
            >
              <div className="w-11 h-11 bg-dojo-border rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-dojo-gold shrink-0">
                {isUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={s.photo!} alt={s.fullName} className="w-full h-full object-cover" />
                  : s.fullName.split(" ").slice(0, 2).map(w => w[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-dojo-white truncate">{s.fullName}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-dojo-muted">{age} a.</span>
                  {beltInfo
                    ? <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: beltInfo.hex+"25", color: beltInfo.hex==="#FFFFFF"?"#ccc":beltInfo.hex, border:`1px solid ${beltInfo.hex}40` }}>
                        {beltInfo.label}
                      </span>
                    : <span className="text-xs text-dojo-muted">Sin cinta</span>
                  }
                  {!s.active && <span className="flex items-center gap-1 text-xs text-red-400 font-semibold"><UserX size={10}/> Inactivo</span>}
                  {s.familyId && (
                    <span className="flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-sky-900/30 text-sky-400 border border-sky-800/40">
                      <Users size={9}/> Familia
                    </span>
                  )}
                  <PortalBadge portalUser={s.portalUser} />
                  {s.active && payment && (
                    <span className={payment.status==="late"?"badge-red text-xs":payment.status==="pending"?"badge-yellow text-xs":"badge-green text-xs"}>
                      {payment.status==="late"?"Atrasado":payment.status==="pending"?"Pendiente":"Al día"}
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
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dojo-border">
              <SortTh label="Alumno"        field="name"    sortField={sortField} sortDir={sortDir} onSort={handleSort} className="pl-6" />
              <SortTh label="Edad"          field="age"     sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Cinta"         field="belt"    sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Estado Pago"   field="payment" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Acceso Portal" field="portal"  sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <th className="text-right text-xs font-semibold text-dojo-muted uppercase tracking-wider px-6 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center py-12 text-dojo-muted">Buscando...</td></tr>
            )}
            {!loading && displayed.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-dojo-muted">
                No se encontraron alumnos.{" "}
                <Link href="/dashboard/students/new" className="text-dojo-red hover:underline">Crear el primero</Link>
              </td></tr>
            )}
            {!loading && displayed.map(s => {
              const belt    = s.beltHistory[0]?.beltColor;
              const payment = s.payments[0];
              const age     = calculateAge(s.birthDate);
              const isUrl   = s.photo?.startsWith("http");
              return (
                <tr key={s.id}
                  className={`border-b border-dojo-border/50 transition-colors ${
                    s.active ? "hover:bg-dojo-border/20" : "opacity-60 hover:opacity-80"
                  }`}
                >
                  {/* Nombre */}
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-dojo-border rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-dojo-gold shrink-0">
                        {isUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={s.photo!} alt={s.fullName} className="w-full h-full object-cover" />
                          : s.fullName.split(" ").slice(0,2).map(w=>w[0]).join("")}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-dojo-white">{s.fullName}</p>
                          {!s.active && <span className="flex items-center gap-1 text-xs text-red-400 font-semibold"><UserX size={10}/> Inactivo</span>}
                          {s.familyId && (
                            <span className="flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-sky-900/30 text-sky-400 border border-sky-800/40" title="Familia vinculada">
                              <Users size={9}/> Familia
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-dojo-muted">{s.nationality} · {s.gender==="M"?"Masculino":"Femenino"}</p>
                      </div>
                    </div>
                  </td>

                  {/* Edad */}
                  <td className="px-4 py-3 text-dojo-muted">{age} años</td>

                  {/* Cinta */}
                  <td className="px-4 py-3">
                    {belt ? <BeltBadge beltColor={belt} /> : <span className="text-dojo-muted text-xs">Sin cinta</span>}
                  </td>

                  {/* Pago */}
                  <td className="px-4 py-3">
                    {payment ? (
                      <span className={payment.status==="late"?"badge-red":payment.status==="pending"?"badge-yellow":"badge-green"}>
                        {payment.status==="late" ? "Atrasado" : payment.status==="pending" ? `Vence ${formatDate(payment.dueDate)}` : "Al día"}
                      </span>
                    ) : (
                      <span className="badge-green">Al día</span>
                    )}
                  </td>

                  {/* Acceso Portal */}
                  <td className="px-4 py-3">
                    <PortalBadge portalUser={s.portalUser} />
                  </td>

                  {/* Acciones */}
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/dashboard/students/${s.id}`} className="btn-ghost p-2 text-dojo-muted" title="Ver perfil">
                        <Eye size={16} />
                      </Link>
                      <Link href={`/dashboard/students/${s.id}/edit`} className="btn-ghost p-2 text-dojo-muted" title="Editar">
                        <Edit size={16} />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
