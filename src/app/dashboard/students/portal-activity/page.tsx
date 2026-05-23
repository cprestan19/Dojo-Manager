"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Smartphone, Clock, Globe, Users, UserCheck, UserX, AlertTriangle } from "lucide-react";
import { getBeltInfo } from "@/lib/utils";

interface PortalStudent {
  studentId:   string;
  fullName:    string;
  studentCode: number | null;
  photo:       string | null;
  belt:        string | null;
  portalActive: boolean;
  portalEmail:  string | null;
  hasAccess:    boolean;
  lastLogin:    string | null;
  loginCount:   number;
  lastIp:       string | null;
  lastCountry:  string | null;
  lastCity:     string | null;
}

interface Summary {
  total: number; withAccess: number; hasLogged: number; neverLogged: number;
  students: PortalStudent[];
}

type FilterType = "all" | "logged" | "never" | "no-access";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins < 1)   return "hace un momento";
  if (mins < 60)  return `hace ${mins} min`;
  if (hours < 24) return `hace ${hours} h`;
  if (days < 7)   return `hace ${days} día${days !== 1 ? "s" : ""}`;
  return new Date(iso).toLocaleDateString("es-PA", { day:"numeric", month:"short", year:"numeric" });
}

export default function PortalActivityPage() {
  const [data,    setData]    = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState<FilterType>("all");

  useEffect(() => {
    fetch("/api/students/portal-activity")
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.students.filter(s => {
      if (search && !s.fullName.toLowerCase().includes(search.toLowerCase()) &&
          !String(s.studentCode ?? "").includes(search)) return false;
      if (filter === "logged"    && s.loginCount === 0)   return false;
      if (filter === "never"     && (s.loginCount > 0 || !s.hasAccess)) return false;
      if (filter === "no-access" && s.hasAccess)          return false;
      return true;
    });
  }, [data, search, filter]);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Cabecera */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/students"
          className="p-2 rounded-lg hover:bg-dojo-border transition-colors text-dojo-muted hover:text-dojo-white">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white flex items-center gap-2">
            <Smartphone size={22} className="text-dojo-red" /> Actividad del Portal de Alumnos
          </h1>
          <p className="text-dojo-muted text-sm mt-0.5">
            Quién tiene acceso, cuándo entraron por última vez y desde dónde
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-4 border-dojo-red border-t-transparent animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Users,      label: "Total alumnos",     value: data.total,      color: "text-dojo-white"  },
              { icon: UserCheck,  label: "Con acceso activo", value: data.withAccess, color: "text-green-400"   },
              { icon: Smartphone, label: "Han ingresado",     value: data.hasLogged,  color: "text-blue-400"    },
              { icon: AlertTriangle, label: "Acceso sin usar", value: data.neverLogged, color: "text-yellow-400" },
            ].map(s => (
              <div key={s.label} className="card text-center py-3 space-y-1">
                <s.icon size={18} className={`${s.color} mx-auto`} />
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-dojo-muted text-xs leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
              <input className="form-input pl-8 text-sm" placeholder="Buscar alumno..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {([
              { key: "all",       label: `Todos (${data.total})`           },
              { key: "logged",    label: `Ingresaron (${data.hasLogged})`  },
              { key: "never",     label: `Sin usar (${data.neverLogged})`  },
              { key: "no-access", label: `Sin acceso (${data.total - data.withAccess})` },
            ] as { key: FilterType; label: string }[]).map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  filter === f.key
                    ? "bg-dojo-white text-dojo-darker border-transparent"
                    : "bg-dojo-card text-dojo-muted border-dojo-border hover:border-dojo-border/60"
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {filtered.map(s => {
              const bInfo = s.belt ? getBeltInfo(s.belt) : null;
              const statusColor = s.loginCount > 0
                ? "border-green-700/40"
                : s.hasAccess
                ? "border-yellow-700/40"
                : "border-dojo-border";

              return (
                <Link
                  key={s.studentId}
                  href={`/dashboard/students/${s.studentId}`}
                  className={`card flex items-center gap-3 py-3 hover:border-dojo-red/40 transition-all ${statusColor}`}
                >
                  {/* Foto / iniciales */}
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-dojo-darker flex items-center justify-center shrink-0">
                    {s.photo
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={s.photo} alt="" className="w-full h-full object-cover" />
                      : <span className="text-dojo-gold font-bold text-xs">
                          {s.fullName.split(" ").slice(0,2).map(w=>w[0]).join("")}
                        </span>
                    }
                  </div>

                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-dojo-white">{s.fullName}</span>
                      {s.studentCode && <span className="text-dojo-muted text-xs">#{s.studentCode}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {bInfo && (
                        <span className="flex items-center gap-1 text-xs text-dojo-muted">
                          <span className="w-2 h-2 rounded-full border border-white/20"
                            style={{ backgroundColor: bInfo.hex }} />
                          {bInfo.label}
                        </span>
                      )}
                      {s.portalEmail && (
                        <span className="text-xs text-dojo-muted truncate max-w-[180px]">{s.portalEmail}</span>
                      )}
                    </div>
                  </div>

                  {/* Estado portal */}
                  <div className="text-right shrink-0 space-y-0.5">
                    {!s.hasAccess ? (
                      <p className="text-xs text-dojo-muted flex items-center gap-1 justify-end">
                        <UserX size={12} className="text-dojo-muted" /> Sin acceso
                      </p>
                    ) : s.loginCount === 0 ? (
                      <p className="text-xs text-yellow-400 flex items-center gap-1 justify-end">
                        <AlertTriangle size={12} /> Nunca ingresó
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-green-400 flex items-center gap-1 justify-end">
                          <Smartphone size={12} />
                          {s.loginCount} {s.loginCount === 1 ? "ingreso" : "ingresos"}
                        </p>
                        {s.lastLogin && (
                          <p className="text-xs text-dojo-muted flex items-center gap-1 justify-end">
                            <Clock size={11} /> {timeAgo(s.lastLogin)}
                          </p>
                        )}
                        {(s.lastCountry || s.lastCity) && (
                          <p className="text-xs text-dojo-muted flex items-center gap-1 justify-end">
                            <Globe size={11} />
                            {[s.lastCity, s.lastCountry].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </Link>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-10 text-dojo-muted">
                <Smartphone size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin resultados para este filtro</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-dojo-muted text-center py-10">Error al cargar los datos</p>
      )}
    </div>
  );
}
