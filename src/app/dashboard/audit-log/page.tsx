"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck, Search, ChevronLeft, ChevronRight, RefreshCw,
  AlertTriangle, Globe, Monitor, ChevronDown, ChevronUp,
} from "lucide-react";

type FilterType = "all" | "users" | "registros" | "tournaments" | "logins" | "suspicious";

interface LogEntry {
  id:              string;
  action:          string;
  module:          string | null;
  method:          string | null;
  resourceType:    string | null;
  resourceId:      string | null;
  statusCode:      number | null;
  userId:          string | null;
  userName:        string | null;
  userEmail:       string | null;
  isSysadminProxy: boolean;
  dojoId:          string | null;
  dojoSlug:        string | null;
  targetId:        string | null;
  targetEmail:     string | null;
  ip:              string | null;
  userAgent:       string | null;
  country:         string | null;
  city:            string | null;
  region:          string | null;
  sessionId:       string | null;
  duration:        number | null;
  details:         string | null;
  createdAt:       string;
}

// ── Etiquetas y colores por acción ───────────────────────────────────────────
const ACTION_CFG: Record<string, { label: string; color: string; icon?: string }> = {
  // Auth
  LOGIN_SUCCESS:          { label: "Login exitoso",              color: "text-dojo-muted bg-dojo-border/30" },
  LOGIN_FAILED:           { label: "Login fallido",              color: "text-orange-400 bg-orange-900/20"  },
  LOGOUT:                 { label: "Cierre de sesión",           color: "text-dojo-muted bg-dojo-border/30" },
  PASSWORD_CHANGED:       { label: "Contraseña cambiada",        color: "text-purple-400 bg-purple-900/20"  },
  PASSWORD_RESET_REQUEST: { label: "Solicitud reset contraseña", color: "text-yellow-400 bg-yellow-900/20"  },
  PASSWORD_RESET:         { label: "Contraseña restablecida",    color: "text-purple-400 bg-purple-900/20"  },
  // Usuarios
  USER_CREATED:           { label: "Usuario creado",             color: "text-green-400 bg-green-900/20"    },
  USER_UPDATED:           { label: "Usuario editado",            color: "text-blue-400 bg-blue-900/20"      },
  USER_DELETED:           { label: "Usuario eliminado",          color: "text-red-400 bg-red-900/20"        },
  USER_ACTIVATED:         { label: "Usuario activado",           color: "text-green-400 bg-green-900/20"    },
  USER_DEACTIVATED:       { label: "Usuario desactivado",        color: "text-yellow-400 bg-yellow-900/20"  },
  USER_PASSWORD_CHANGED:  { label: "Contraseña editada (admin)", color: "text-purple-400 bg-purple-900/20"  },
  // Alumnos
  STUDENT_CREATED:        { label: "Alumno creado",              color: "text-green-400 bg-green-900/20"    },
  STUDENT_UPDATED:        { label: "Alumno editado",             color: "text-blue-400 bg-blue-900/20"      },
  STUDENT_DELETED:        { label: "Alumno eliminado",           color: "text-red-400 bg-red-900/20"        },
  STUDENT_ACTIVATED:      { label: "Alumno reactivado",          color: "text-green-400 bg-green-900/20"    },
  STUDENT_DEACTIVATED:    { label: "Alumno desactivado",         color: "text-yellow-400 bg-yellow-900/20"  },
  // Auto-registro
  PENDING_STUDENT_SUBMITTED:  { label: "Formulario enviado (público)", color: "text-sky-400 bg-sky-900/20"      },
  PENDING_STUDENT_APPROVED:   { label: "Solicitud aprobada",           color: "text-green-400 bg-green-900/20"  },
  PENDING_STUDENT_REJECTED:   { label: "Solicitud rechazada",          color: "text-orange-400 bg-orange-900/20"},
  PENDING_STUDENT_DELETED:    { label: "Solicitud eliminada",          color: "text-red-400 bg-red-900/20"      },
  REGISTRATION_LINK_CREATED:  { label: "Link de registro creado",      color: "text-green-400 bg-green-900/20"  },
  REGISTRATION_LINK_UPDATED:  { label: "Link de registro editado",     color: "text-blue-400 bg-blue-900/20"    },
  REGISTRATION_LINK_DELETED:  { label: "Link de registro eliminado",   color: "text-red-400 bg-red-900/20"      },
  // Pagos
  PAYMENT_CREATED:        { label: "Pago creado",                color: "text-green-400 bg-green-900/20"    },
  PAYMENT_UPDATED:        { label: "Pago editado",               color: "text-blue-400 bg-blue-900/20"      },
  PAYMENT_MARKED_PAID:    { label: "Pago marcado como pagado",   color: "text-green-400 bg-green-900/20"    },
  PAYMENT_REMINDER_SENT:  { label: "Recordatorio enviado",       color: "text-blue-400 bg-blue-900/20"      },
  PAYMENT_RECEIPT_SENT:   { label: "Recibo enviado",             color: "text-blue-400 bg-blue-900/20"      },
  PAYMENT_GENERATED:      { label: "Mensualidades generadas",    color: "text-dojo-muted bg-dojo-border/30" },
  // Cintas
  BELT_HISTORY_CREATED:   { label: "Cinta registrada",           color: "text-dojo-gold bg-dojo-gold/10"    },
  BELT_HISTORY_UPDATED:   { label: "Cinta editada",              color: "text-blue-400 bg-blue-900/20"      },
  BELT_HISTORY_DELETED:   { label: "Cinta eliminada",            color: "text-red-400 bg-red-900/20"        },
  // Torneos
  TOURNAMENT_ARCHIVED:    { label: "Torneo inactivado",          color: "text-yellow-400 bg-yellow-900/20"  },
  TOURNAMENT_REACTIVATED: { label: "Torneo reactivado",          color: "text-green-400 bg-green-900/20"    },
  TOURNAMENT_DELETED:     { label: "Torneo eliminado",           color: "text-red-400 bg-red-900/20"        },
  BRACKET_REOPENED:       { label: "Bracket reabierto",          color: "text-yellow-400 bg-yellow-900/20"  },
  BRACKET_DELETED:        { label: "Bracket eliminado",          color: "text-red-400 bg-red-900/20"        },
  // Config
  DOJO_UPDATED:           { label: "Config dojo actualizada",    color: "text-blue-400 bg-blue-900/20"      },
  EMAIL_SETTINGS_UPDATED: { label: "Config correo actualizada",  color: "text-blue-400 bg-blue-900/20"      },
};

// ── Genera un resumen legible de una entrada del log ─────────────────────────
function summarize(log: LogEntry): string {
  const det = parseDetails(log.details);
  const who = log.userName ?? log.userEmail ?? null;

  switch (log.action) {
    case "LOGIN_FAILED":
      return `Intento fallido${log.targetEmail ? ` para ${log.targetEmail}` : ""}${log.ip ? ` desde ${log.ip}` : ""}`;
    case "LOGIN_SUCCESS":
      return `${who ?? log.userEmail ?? "?"} inició sesión`;
    case "PENDING_STUDENT_SUBMITTED":
      return `Formulario de "${det.fullName ?? "?"}" enviado desde ${log.ip ?? "IP desconocida"}`;
    case "PENDING_STUDENT_APPROVED":
      return `Solicitud de "${det.fullName ?? det.pendingId ?? "?"}" aprobada e inscrita`;
    case "PENDING_STUDENT_REJECTED":
      return `Solicitud rechazada${det.note ? ` · Motivo: ${det.note}` : ""}`;
    case "PENDING_STUDENT_DELETED":
      return `Solicitud de "${det.fullName ?? "?"}" eliminada${det.notify ? " · Familia notificada" : ""}`;
    case "REGISTRATION_LINK_CREATED":
      return `Link "${det.label ?? "?"}" creado`;
    case "REGISTRATION_LINK_UPDATED":
      return `Link de registro actualizado`;
    case "REGISTRATION_LINK_DELETED": {
      const del = det.cascadeDeleted as { approved?: number; rejected?: number } | undefined;
      const parts: string[] = [`Link "${det.label ?? "?"}" eliminado`];
      if (del?.approved) parts.push(`${del.approved} aprobados eliminados en cascada`);
      if (del?.rejected) parts.push(`${del.rejected} rechazados eliminados en cascada`);
      return parts.join(" · ");
    }
    case "USER_CREATED":    return `Usuario "${det.email ?? det.name ?? "?"}" creado`;
    case "USER_UPDATED":    return `Usuario "${det.email ?? det.name ?? "?"}" editado`;
    case "USER_DELETED":    return `Usuario "${log.targetEmail ?? "?"}" eliminado`;
    case "USER_PASSWORD_CHANGED": return `Contraseña cambiada para ${log.targetEmail ?? "?"}`;
    default: {
      const parts = [];
      if (det.fullName) parts.push(`"${det.fullName}"`);
      if (det.label)    parts.push(`"${det.label}"`);
      if (det.note)     parts.push(det.note as string);
      return parts.join(" · ") || "—";
    }
  }
}

function parseDetails(details: string | null): Record<string, unknown> {
  if (!details) return {};
  try { return JSON.parse(details); } catch { return { raw: details }; }
}

// Etiquetas legibles para keys del campo details
const DETAIL_LABELS: Record<string, string> = {
  fullName:        "Nombre alumno",
  label:           "Nombre del link",
  token:           "Token",
  linkId:          "ID del link",
  pendingId:       "ID solicitud",
  studentCode:     "Código alumno",
  note:            "Nota",
  notify:          "Familia notificada",
  email:           "Correo",
  name:            "Nombre",
  role:            "Rol",
  reason:          "Motivo",
  approvedCount:   "Aprobados eliminados",
  rejectedCount:   "Rechazados eliminados",
  cascadeDeleted:  "Eliminados en cascada",
  before:          "Antes",
  after:           "Después",
  raw:             "Dato",
};

function friendlyKey(k: string): string {
  return DETAIL_LABELS[k] ?? k.replace(/([A-Z])/g, " $1").trim();
}

function friendlyValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

// ── Parsear User-Agent ────────────────────────────────────────────────────────
function parseUA(ua: string | null): string {
  if (!ua) return "—";
  if (/iPhone|iPad/i.test(ua))  return "iOS · " + (/Safari/.test(ua) ? "Safari" : "App");
  if (/Android/i.test(ua))      return "Android · " + (/Chrome/i.test(ua) ? "Chrome" : "Browser");
  if (/Windows/i.test(ua))      return "Windows · " + (/Chrome/i.test(ua) ? "Chrome" : /Firefox/i.test(ua) ? "Firefox" : /Edge/i.test(ua) ? "Edge" : "Browser");
  if (/Macintosh/i.test(ua))    return "macOS · " + (/Chrome/i.test(ua) ? "Chrome" : /Firefox/i.test(ua) ? "Firefox" : "Safari");
  if (/Linux/i.test(ua))        return "Linux · Browser";
  if (/curl|python|axios/i.test(ua)) return "API / Script";
  return ua.slice(0, 40) + (ua.length > 40 ? "…" : "");
}

// ── Badge de acción ──────────────────────────────────────────────────────────
function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CFG[action] ?? { label: action.replace(/_/g, " "), color: "text-dojo-muted bg-dojo-border/30" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ── Indicador de fila sospechosa ─────────────────────────────────────────────
function isSuspicious(log: LogEntry): boolean {
  return (
    log.action === "LOGIN_FAILED" ||
    log.isSysadminProxy ||
    (log.statusCode != null && [401, 403, 429].includes(log.statusCode))
  );
}

// ── Fila expandida con todos los detalles ─────────────────────────────────────
function ExpandedRow({ log }: { log: LogEntry }) {
  const det = parseDetails(log.details);
  const detEntries = Object.entries(det).filter(([k]) => k !== "note" || det.note !== null);

  return (
    <tr className="bg-dojo-dark/70 border-b border-dojo-border/40">
      <td colSpan={5} className="px-5 py-4">
        <div className="space-y-3">

          {/* Fila sospechosa */}
          {isSuspicious(log) && (
            <div className="flex items-center gap-2 text-orange-400 text-xs bg-orange-900/20 border border-orange-700/40 rounded px-3 py-1.5">
              <AlertTriangle size={12} />
              {log.action === "LOGIN_FAILED" && "Intento de acceso fallido — verificar si hay múltiples intentos desde esta IP."}
              {log.isSysadminProxy && "Sysadmin operando dentro de un dojo ajeno."}
              {log.statusCode === 403 && "Acceso denegado — alguien intentó acceder a un recurso sin permisos."}
              {log.statusCode === 429 && "Límite de tasa excedido (demasiadas solicitudes) — posible bot o abuso."}
              {log.statusCode === 401 && "Solicitud sin autenticación a un recurso protegido."}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2.5 text-xs">

            {/* Identidad */}
            {(log.userName || log.userEmail) && (
              <div>
                <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-0.5">Quién</p>
                <p className="text-dojo-white font-medium">{log.userName ?? "—"}</p>
                <p className="text-dojo-muted">{log.userEmail ?? "—"}</p>
                {log.isSysadminProxy && (
                  <span className="mt-0.5 inline-block text-[9px] bg-purple-800/40 text-purple-300 px-1.5 py-0.5 rounded">
                    SYSADMIN PROXY
                  </span>
                )}
              </div>
            )}

            {/* IP y geo */}
            <div>
              <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Globe size={9} /> IP / Ubicación
              </p>
              <p className="text-dojo-white font-mono">{log.ip ?? "—"}</p>
              {(log.city || log.country) && (
                <p className="text-dojo-muted">{[log.city, log.region, log.country].filter(Boolean).join(", ")}</p>
              )}
            </div>

            {/* Dispositivo */}
            <div>
              <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Monitor size={9} /> Dispositivo
              </p>
              <p className="text-dojo-white">{parseUA(log.userAgent)}</p>
            </div>

            {/* Resultado */}
            <div>
              <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-0.5">Resultado</p>
              <p className={`font-mono font-semibold ${
                !log.statusCode ? "text-dojo-muted"
                : log.statusCode < 300 ? "text-green-400"
                : log.statusCode < 400 ? "text-blue-400"
                : log.statusCode < 500 ? "text-orange-400"
                : "text-red-400"
              }`}>
                {log.statusCode ?? "—"}
                {log.duration != null && <span className="text-dojo-muted font-normal ml-2">{log.duration}ms</span>}
              </p>
            </div>

            {/* Recurso */}
            {(log.resourceType || log.resourceId) && (
              <div>
                <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-0.5">Recurso</p>
                <p className="text-dojo-white">{log.resourceType ?? "—"}</p>
                <p className="text-dojo-muted font-mono text-[10px] break-all">{log.resourceId ?? "—"}</p>
              </div>
            )}

            {/* Dojo */}
            {(log.dojoSlug || log.dojoId) && (
              <div>
                <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-0.5">Dojo</p>
                <p className="text-dojo-white">{log.dojoSlug ?? log.dojoId?.slice(0, 12) ?? "—"}</p>
              </div>
            )}

            {/* Target */}
            {log.targetEmail && (
              <div>
                <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-0.5">Objetivo</p>
                <p className="text-dojo-white">{log.targetEmail}</p>
              </div>
            )}

            {/* Session */}
            {log.sessionId && (
              <div>
                <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-0.5">ID Sesión</p>
                <p className="text-dojo-muted font-mono text-[10px] break-all">{log.sessionId}</p>
              </div>
            )}
          </div>

          {/* Detalles adicionales del campo details */}
          {detEntries.length > 0 && (
            <div className="border-t border-dojo-border/40 pt-2.5">
              <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-2">Contexto adicional</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                {detEntries.map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-0.5">{friendlyKey(k)}</p>
                    <p className="text-dojo-white break-all whitespace-pre-wrap">{friendlyValue(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User agent completo */}
          {log.userAgent && (
            <p className="text-[10px] text-dojo-muted break-all border-t border-dojo-border/30 pt-2">
              UA: {log.userAgent}
            </p>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function AuditLogPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const role = (session?.user as { role?: string })?.role ?? "user";

  useEffect(() => {
    if (status === "authenticated" && role !== "sysadmin")
      router.replace("/dashboard");
  }, [status, role, router]);

  const [logs,        setLogs]        = useState<LogEntry[]>([]);
  const [total,       setTotal]       = useState(0);
  const [totalPages,  setTotalPages]  = useState(1);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState<FilterType>("all");
  const [search,      setSearch]      = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [expanded,    setExpanded]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ filter, page: String(page) });
    if (search) params.set("search", search);
    const res = await fetch(`/api/audit-logs?${params}`);
    if (res.ok) {
      const d = await res.json();
      setLogs(d.logs);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    }
    setLoading(false);
  }, [filter, page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filter, search]);

  function formatDateTime(iso: string) {
    return new Intl.DateTimeFormat("es-PA", {
      timeZone: "America/Panama",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  }

  if (status === "loading" || role !== "sysadmin") return null;

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all",         label: "Todos"       },
    { key: "logins",      label: "Accesos"     },
    { key: "users",       label: "Usuarios"    },
    { key: "registros",   label: "Registros"   },
    { key: "tournaments", label: "Torneos"     },
    { key: "suspicious",  label: "Sospechosos" },
  ];

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <ShieldCheck size={20} className="text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-dojo-white">Log de Auditoría</h1>
          <p className="text-xs text-dojo-muted">{total.toLocaleString()} registros · Haz clic en una fila para ver todos los detalles</p>
        </div>
        <button onClick={load} className="ml-auto p-2 rounded-lg hover:bg-dojo-border transition-colors" title="Actualizar">
          <RefreshCw size={16} className={`text-dojo-muted ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filtros + búsqueda */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex flex-wrap gap-1 bg-dojo-dark rounded-lg p-1 border border-dojo-border">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={[
                "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                filter === f.key
                  ? f.key === "suspicious" ? "bg-orange-600 text-white" : "bg-dojo-gold text-black"
                  : f.key === "suspicious" ? "text-orange-400 hover:text-orange-300" : "text-dojo-muted hover:text-dojo-white",
              ].join(" ")}
            >
              {f.key === "suspicious" && <AlertTriangle size={10} className="inline mr-1" />}
              {f.label}
            </button>
          ))}
        </div>

        <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); }}
          className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Buscar por email, IP, nombre, acción..."
              className="form-input pl-8 py-1.5 text-sm w-full" />
          </div>
          <button type="submit" className="btn-secondary text-xs py-1.5 px-3">Buscar</button>
          {search && (
            <button type="button" onClick={() => { setSearch(""); setSearchInput(""); }}
              className="text-xs text-dojo-muted hover:text-dojo-white transition-colors">Limpiar</button>
          )}
        </form>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dojo-border bg-dojo-dark/40">
                {["Fecha/Hora (PAN)", "Acción · Descripción", "Quién", "IP / Geo", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs text-dojo-muted uppercase tracking-wider font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i} className="border-b border-dojo-border/40">
                    {Array.from({ length: 5 }, (_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-dojo-border/60 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-dojo-muted text-sm">
                    No hay registros para este filtro
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const isOpen = expanded === log.id;
                  const suspicious = isSuspicious(log);
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : log.id)}
                        className={[
                          "border-b border-dojo-border/40 cursor-pointer transition-colors",
                          suspicious
                            ? "border-l-2 border-l-orange-600 hover:bg-orange-900/10"
                            : "hover:bg-dojo-border/10",
                          isOpen ? "bg-dojo-dark/40" : "",
                        ].join(" ")}
                      >
                        {/* Fecha */}
                        <td className="px-4 py-3 text-xs text-dojo-muted whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>

                        {/* Acción + descripción */}
                        <td className="px-4 py-3 min-w-[240px]">
                          <ActionBadge action={log.action} />
                          <p className="text-xs text-dojo-muted mt-0.5 leading-relaxed">{summarize(log)}</p>
                        </td>

                        {/* Quién */}
                        <td className="px-4 py-3 text-xs">
                          {log.userEmail ? (
                            <>
                              <p className="text-dojo-white font-medium">{log.userName ?? log.userEmail}</p>
                              {log.userName && <p className="text-dojo-muted">{log.userEmail}</p>}
                              {log.isSysadminProxy && (
                                <span className="text-[9px] bg-purple-800/40 text-purple-300 px-1 py-0.5 rounded">PROXY</span>
                              )}
                            </>
                          ) : log.ip ? (
                            <>
                              <p className="text-sky-400 font-medium">Público</p>
                              <p className="text-dojo-muted font-mono text-[10px]">{log.ip}</p>
                            </>
                          ) : (
                            <span className="text-dojo-muted">—</span>
                          )}
                        </td>

                        {/* IP / Geo */}
                        <td className="px-4 py-3 text-xs">
                          {log.ip ? (
                            <>
                              <p className="text-dojo-white font-mono">{log.ip}</p>
                              {log.country && (
                                <p className="text-dojo-muted text-[10px]">
                                  {[log.city, log.country].filter(Boolean).join(", ")}
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-dojo-muted">—</span>
                          )}
                        </td>

                        {/* Expand toggle */}
                        <td className="px-3 py-3 text-dojo-muted">
                          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                      </tr>

                      {isOpen && <ExpandedRow log={log} />}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dojo-border">
            <p className="text-xs text-dojo-muted">
              Página {page} de {totalPages} · {total.toLocaleString()} registros
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded hover:bg-dojo-border transition-colors disabled:opacity-30">
                <ChevronLeft size={16} className="text-dojo-muted" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded hover:bg-dojo-border transition-colors disabled:opacity-30">
                <ChevronRight size={16} className="text-dojo-muted" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
