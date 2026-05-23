"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Search, Smartphone, Clock, Globe, Users,
  UserCheck, UserX, AlertTriangle, KeyRound, Mail, MailX,
  CheckCircle, Loader2, ChevronDown,
} from "lucide-react";
import { getBeltInfo } from "@/lib/utils";

// ── Tipos ────────────────────────────────────────────────────────────────────

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
  // campos locales para resultado individual
  _granting?:  boolean;
  _granted?:   boolean;
  _grantError?: string | null;
  _emailSent?: boolean;
}

interface Summary {
  total: number; withAccess: number; hasLogged: number; neverLogged: number;
  students: PortalStudent[];
}

interface BulkResult {
  studentId: string; fullName: string; email: string | null;
  status: "activated" | "skipped_no_email" | "skipped_already_active" | "error";
  emailSent: boolean; errorDetail: string | null;
}

interface BulkSummary {
  activated: number; emailsSent: number; noEmail: number;
  alreadyActive: number; errors: number; total: number;
}

type FilterType = "all" | "logged" | "never" | "no-access";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Componente principal ──────────────────────────────────────────────────────

export default function PortalActivityPage() {
  const [data,       setData]       = useState<Summary | null>(null);
  const [students,   setStudents]   = useState<PortalStudent[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState<FilterType>("all");

  // Bulk
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult,  setBulkResult]  = useState<{ summary: BulkSummary; results: BulkResult[] } | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/students/portal-activity");
    if (r.ok) {
      const d: Summary = await r.json();
      setData(d);
      setStudents(d.students);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Activar acceso individual
  async function grantSingle(s: PortalStudent) {
    setStudents(prev => prev.map(x =>
      x.studentId === s.studentId ? { ...x, _granting: true } : x
    ));
    try {
      const res  = await fetch(`/api/students/${s.studentId}/access`, { method: "POST" });
      const d    = await res.json();
      setStudents(prev => prev.map(x =>
        x.studentId === s.studentId ? {
          ...x, _granting: false,
          _granted:   res.ok,
          _emailSent: d.emailSent ?? false,
          _grantError: res.ok ? null : (d.error ?? "Error"),
          hasAccess:   res.ok ? true : x.hasAccess,
          portalEmail: res.ok ? (d.email ?? x.portalEmail) : x.portalEmail,
        } : x
      ));
    } catch {
      setStudents(prev => prev.map(x =>
        x.studentId === s.studentId ? { ...x, _granting: false, _grantError: "Error de conexión" } : x
      ));
    }
  }

  // Activar acceso masivo — solo alumnos sin portal activo
  async function grantAll() {
    const targets = students.filter(s => !s.hasAccess && !s._granted);
    if (targets.length === 0) return;
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const res  = await fetch("/api/students/bulk-portal-access", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ studentIds: targets.map(s => s.studentId) }),
      });
      const d = await res.json();
      if (res.ok) {
        setBulkResult({ summary: d.summary, results: d.results });
        // Refrescar la lista para reflejar cambios
        await load();
      }
    } catch { /* silent */ }
    finally { setBulkLoading(false); }
  }

  const filtered = useMemo(() => students.filter(s => {
    if (search && !s.fullName.toLowerCase().includes(search.toLowerCase()) &&
        !String(s.studentCode ?? "").includes(search)) return false;
    if (filter === "logged"    && s.loginCount === 0)              return false;
    if (filter === "never"     && (s.loginCount > 0 || !s.hasAccess)) return false;
    if (filter === "no-access" && s.hasAccess)                     return false;
    return true;
  }), [students, search, filter]);

  const withoutAccess = students.filter(s => !s.hasAccess && !s._granted).length;

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
            Gestiona el acceso al portal y revisa quién ha ingresado
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
              { icon: Users,         label: "Total alumnos",     value: data.total,       color: "text-dojo-white"  },
              { icon: UserCheck,     label: "Con acceso activo", value: data.withAccess,  color: "text-green-400"   },
              { icon: Smartphone,    label: "Han ingresado",     value: data.hasLogged,   color: "text-blue-400"    },
              { icon: AlertTriangle, label: "Acceso sin usar",   value: data.neverLogged, color: "text-yellow-400"  },
            ].map(s => (
              <div key={s.label} className="card text-center py-3 space-y-1">
                <s.icon size={18} className={`${s.color} mx-auto`} />
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-dojo-muted text-xs leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Panel resultado bulk */}
          {bulkResult && (
            <div className="card border-green-700/40 bg-green-900/10 space-y-3">
              <div className="flex items-start justify-between">
                <p className="font-semibold text-green-300 flex items-center gap-2 text-sm">
                  <CheckCircle size={16} /> Acceso masivo completado
                </p>
                <button onClick={() => setBulkResult(null)} className="text-dojo-muted hover:text-dojo-white text-xs">✕</button>
              </div>

              {/* Números clave */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
                {[
                  { label: "Activados",          value: bulkResult.summary.activated,    color: "text-green-400"  },
                  { label: "Emails enviados",    value: bulkResult.summary.emailsSent,   color: "text-blue-400"   },
                  { label: "Sin email",          value: bulkResult.summary.noEmail,      color: "text-yellow-400" },
                  { label: "Ya tenían acceso",   value: bulkResult.summary.alreadyActive,color: "text-dojo-muted" },
                  { label: "Errores",            value: bulkResult.summary.errors,       color: "text-red-400"    },
                ].map(s => (
                  <div key={s.label} className="bg-dojo-darker rounded-lg p-2">
                    <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-dojo-muted text-xs">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Detalles desplegables */}
              <button
                onClick={() => setShowDetails(o => !o)}
                className="flex items-center gap-1.5 text-xs text-dojo-muted hover:text-dojo-white transition-colors"
              >
                <ChevronDown size={13} className={`transition-transform ${showDetails ? "rotate-180" : ""}`} />
                {showDetails ? "Ocultar detalle" : "Ver detalle por alumno"}
              </button>

              {showDetails && (
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {bulkResult.results.map(r => (
                    <div key={r.studentId}
                      className="flex items-center gap-2 text-xs py-1.5 border-b border-dojo-border/40">
                      <span className="shrink-0">
                        {r.status === "activated"            ? (r.emailSent ? "✅" : "⚠️") :
                         r.status === "skipped_no_email"     ? "📵" :
                         r.status === "skipped_already_active" ? "⏭" : "❌"}
                      </span>
                      <span className="flex-1 text-dojo-white truncate">{r.fullName}</span>
                      <span className="text-dojo-muted truncate max-w-[160px]">
                        {r.status === "activated"
                          ? (r.emailSent ? `✉️ enviado a ${r.email}` : `⚠️ sin correo — ${r.errorDetail ?? "fallo SMTP"}`)
                          : r.status === "skipped_no_email"
                          ? "sin email registrado"
                          : r.status === "skipped_already_active"
                          ? "ya tenía acceso"
                          : r.errorDetail ?? "error"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Acciones bulk */}
          {withoutAccess > 0 && (
            <div className="flex items-center justify-between p-3 bg-dojo-card rounded-xl border border-dojo-border">
              <div>
                <p className="text-dojo-white text-sm font-semibold">
                  {withoutAccess} alumno{withoutAccess !== 1 ? "s" : ""} sin acceso al portal
                </p>
                <p className="text-dojo-muted text-xs mt-0.5">
                  Solo se activan los que tienen email de madre o padre registrado
                </p>
              </div>
              <button
                onClick={grantAll}
                disabled={bulkLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 shrink-0"
                style={{ background: "#C0392B" }}
              >
                {bulkLoading
                  ? <><Loader2 size={15} className="animate-spin" /> Activando...</>
                  : <><KeyRound size={15} /> Dar acceso a todos</>
                }
              </button>
            </div>
          )}

          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
              <input className="form-input pl-8 text-sm" placeholder="Buscar alumno o código..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {([
              { key: "all",       label: `Todos (${data.total})`            },
              { key: "logged",    label: `Ingresaron (${data.hasLogged})`   },
              { key: "never",     label: `Sin usar (${data.neverLogged})`   },
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

          {/* Lista de alumnos */}
          <div className="space-y-2">
            {filtered.map(s => {
              const bInfo      = s.belt ? getBeltInfo(s.belt) : null;
              const hasActive  = s.hasAccess || s._granted;
              const statusColor = s._grantError
                ? "border-red-700/40"
                : s._granted
                ? "border-green-700/40"
                : hasActive
                ? (s.loginCount > 0 ? "border-green-700/40" : "border-yellow-700/40")
                : "border-dojo-border";

              return (
                <div key={s.studentId}
                  className={`card flex items-center gap-3 py-3 transition-all ${statusColor}`}>

                  {/* Foto / iniciales */}
                  <Link href={`/dashboard/students/${s.studentId}`}
                    className="w-10 h-10 rounded-xl overflow-hidden bg-dojo-darker flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity">
                    {s.photo
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={s.photo} alt="" className="w-full h-full object-cover" />
                      : <span className="text-dojo-gold font-bold text-xs">
                          {s.fullName.split(" ").slice(0,2).map(w=>w[0]).join("")}
                        </span>
                    }
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/dashboard/students/${s.studentId}`}
                        className="font-semibold text-sm text-dojo-white hover:text-dojo-red transition-colors">
                        {s.fullName}
                      </Link>
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
                      {(s.portalEmail || s._granted) && (
                        <span className="text-xs text-dojo-muted truncate max-w-[180px]">
                          {s.portalEmail}
                        </span>
                      )}
                    </div>

                    {/* Resultado de grant individual */}
                    {s._granted && (
                      <p className={`text-xs mt-1 flex items-center gap-1 ${s._emailSent ? "text-green-400" : "text-yellow-400"}`}>
                        {s._emailSent
                          ? <><Mail size={11} /> Acceso activado · correo enviado</>
                          : <><MailX size={11} /> Acceso activado · correo no enviado</>
                        }
                      </p>
                    )}
                    {s._grantError && (
                      <p className="text-xs text-red-400 mt-1">{s._grantError}</p>
                    )}
                  </div>

                  {/* Derecha: estado o botón */}
                  <div className="text-right shrink-0 space-y-0.5 min-w-[110px]">
                    {!hasActive && !s._grantError ? (
                      /* Botón dar acceso individual */
                      <button
                        onClick={() => grantSingle(s)}
                        disabled={s._granting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
                        style={{ background: "#C0392B" }}
                      >
                        {s._granting
                          ? <><Loader2 size={11} className="animate-spin" /> Activando...</>
                          : <><KeyRound size={11} /> Dar acceso</>
                        }
                      </button>
                    ) : hasActive && s.loginCount === 0 && !s._granted ? (
                      <p className="text-xs text-yellow-400 flex items-center gap-1 justify-end">
                        <AlertTriangle size={12} /> Nunca ingresó
                      </p>
                    ) : s.loginCount > 0 ? (
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
                    ) : null}
                  </div>
                </div>
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
