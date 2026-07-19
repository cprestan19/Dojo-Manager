"use client";
import React, { useState, useCallback, useEffect } from "react";
import {
  Search, Filter, ChevronLeft, ChevronRight, Shield, Globe,
  Building2, Newspaper, Clock, CheckCircle, XCircle, ChevronDown,
  ChevronUp, Users, Eye, EyeOff, AlertTriangle, Monitor, RefreshCw,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string; action: string; module: string | null; resourceType: string | null;
  resourceId: string | null; statusCode: number | null; userId: string | null;
  userName: string | null; userEmail: string | null; isSysadminProxy: boolean;
  dojoId: string | null; dojoSlug: string | null; targetEmail: string | null;
  ip: string | null; country: string | null; city: string | null;
  region: string | null; details: string | null; createdAt: string;
  userAgent: string | null; duration: number | null; sessionId: string | null;
}

interface DojoOption { id: string; name: string; slug: string; }

interface NewsEngagement {
  id: string; version: string; title: string; publishedAt: string; audience: string;
  totalUsers: number; seenCount: number; notSeenCount: number;
  seenUsers:    { id: string; name: string | null; email: string; role: string; dojoName: string | null; lastSeenAt: string | null }[];
  notSeenUsers: { id: string; name: string | null; email: string; role: string; dojoName: string | null; lastActiveAt: string | null }[];
}

interface InactiveUser {
  id: string; name: string | null; email: string; role: string; active: boolean;
  createdAt: string; lastActiveAt: string | null; lastSeenNewsAt: string | null;
  daysSinceActive: number | null; daysSinceCreated: number;
  dojo: { id: string; name: string } | null;
}

// ── Helpers de fecha UTC-5 (Panamá, sin DST) ──────────────────────────────────

function panDate(iso: string) {
  const d   = new Date(iso);
  const pan = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  return {
    dd:  String(pan.getUTCDate()).padStart(2, "0"),
    mm:  String(pan.getUTCMonth() + 1).padStart(2, "0"),
    yy:  pan.getUTCFullYear(),
    h24: pan.getUTCHours(),
    min: String(pan.getUTCMinutes()).padStart(2, "0"),
    sec: String(pan.getUTCSeconds()).padStart(2, "0"),
  };
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const { dd, mm, yy, h24, min, sec } = panDate(iso);
  const h12 = h24 % 12 || 12;
  const sfx = h24 >= 12 ? "PM" : "AM";
  return `${dd}/${mm}/${yy} ${h12}:${min}:${sec} ${sfx}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const { dd, mm, yy, h24, min } = panDate(iso);
  const h12 = h24 % 12 || 12;
  const sfx = h24 >= 12 ? "PM" : "AM";
  return `${dd}/${mm}/${yy} ${h12}:${min} ${sfx}`;
}

function fmtDateShort(iso: string | null) {
  if (!iso) return "Nunca";
  const { dd, mm, yy } = panDate(iso);
  return `${dd}/${mm}/${yy}`;
}

function flag(code: string | null) {
  if (!code || code.length !== 2) return "🌐";
  return Array.from(code.toUpperCase()).map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join("");
}

// ── Configuración de acciones ─────────────────────────────────────────────────

const ACTION_CFG: Record<string, { label: string; color: string }> = {
  LOGIN_SUCCESS:               { label: "Login exitoso",               color: "text-dojo-muted bg-dojo-border/30"  },
  LOGIN_FAILED:                { label: "Login fallido",               color: "text-orange-400 bg-orange-900/20"  },
  LOGOUT:                      { label: "Cierre de sesión",            color: "text-dojo-muted bg-dojo-border/30"  },
  PASSWORD_CHANGED:            { label: "Contraseña cambiada",         color: "text-purple-400 bg-purple-900/20"  },
  PASSWORD_RESET_REQUEST:      { label: "Solicitud reset contraseña",  color: "text-yellow-400 bg-yellow-900/20"  },
  PASSWORD_RESET:              { label: "Contraseña restablecida",     color: "text-purple-400 bg-purple-900/20"  },
  USER_CREATED:                { label: "Usuario creado",              color: "text-green-400 bg-green-900/20"    },
  USER_UPDATED:                { label: "Usuario editado",             color: "text-blue-400 bg-blue-900/20"      },
  USER_DELETED:                { label: "Usuario eliminado",           color: "text-red-400 bg-red-900/20"        },
  USER_PASSWORD_CHANGED:       { label: "Contraseña editada (admin)",  color: "text-purple-400 bg-purple-900/20"  },
  STUDENT_CREATED:             { label: "Alumno creado",               color: "text-green-400 bg-green-900/20"    },
  STUDENT_UPDATED:             { label: "Alumno editado",              color: "text-blue-400 bg-blue-900/20"      },
  STUDENT_DELETED:             { label: "Alumno eliminado",            color: "text-red-400 bg-red-900/20"        },
  STUDENT_ACTIVATED:           { label: "Alumno reactivado",           color: "text-green-400 bg-green-900/20"    },
  STUDENT_DEACTIVATED:         { label: "Alumno desactivado",          color: "text-yellow-400 bg-yellow-900/20"  },
  PENDING_STUDENT_SUBMITTED:   { label: "Formulario enviado (público)",color: "text-sky-400 bg-sky-900/20"        },
  PENDING_STUDENT_APPROVED:    { label: "Solicitud aprobada",          color: "text-green-400 bg-green-900/20"    },
  PENDING_STUDENT_REJECTED:    { label: "Solicitud rechazada",         color: "text-orange-400 bg-orange-900/20"  },
  PENDING_STUDENT_DELETED:     { label: "Solicitud eliminada",         color: "text-red-400 bg-red-900/20"        },
  REGISTRATION_LINK_CREATED:   { label: "Link de registro creado",     color: "text-green-400 bg-green-900/20"    },
  REGISTRATION_LINK_UPDATED:   { label: "Link de registro editado",    color: "text-blue-400 bg-blue-900/20"      },
  REGISTRATION_LINK_DELETED:   { label: "Link de registro eliminado",  color: "text-red-400 bg-red-900/20"        },
  PAYMENT_CREATED:             { label: "Pago creado",                 color: "text-green-400 bg-green-900/20"    },
  PAYMENT_UPDATED:             { label: "Pago editado",                color: "text-blue-400 bg-blue-900/20"      },
  PAYMENT_MARKED_PAID:         { label: "Pago marcado como pagado",    color: "text-green-400 bg-green-900/20"    },
  PAYMENT_REMINDER_SENT:       { label: "Recordatorio enviado",        color: "text-blue-400 bg-blue-900/20"      },
  PAYMENT_RECEIPT_SENT:        { label: "Recibo enviado",              color: "text-blue-400 bg-blue-900/20"      },
  PAYMENT_GENERATED:           { label: "Mensualidades generadas",     color: "text-dojo-muted bg-dojo-border/30" },
  BELT_HISTORY_CREATED:        { label: "Cinta registrada",            color: "text-dojo-gold bg-dojo-gold/10"    },
  BELT_HISTORY_UPDATED:        { label: "Cinta editada",               color: "text-blue-400 bg-blue-900/20"      },
  BELT_HISTORY_DELETED:        { label: "Cinta eliminada",             color: "text-red-400 bg-red-900/20"        },
  BELT_VIDEO_CREATED:          { label: "Video de cinta creado",       color: "text-green-400 bg-green-900/20"    },
  BELT_VIDEO_UPDATED:          { label: "Video de cinta editado",      color: "text-blue-400 bg-blue-900/20"      },
  BELT_VIDEO_DELETED:          { label: "Video de cinta eliminado",    color: "text-red-400 bg-red-900/20"        },
  TOURNAMENT_ARCHIVED:         { label: "Torneo inactivado",           color: "text-yellow-400 bg-yellow-900/20"  },
  TOURNAMENT_REACTIVATED:      { label: "Torneo reactivado",           color: "text-green-400 bg-green-900/20"    },
  TOURNAMENT_DELETED:          { label: "Torneo eliminado",            color: "text-red-400 bg-red-900/20"        },
  BRACKET_REOPENED:            { label: "Bracket reabierto",           color: "text-yellow-400 bg-yellow-900/20"  },
  BRACKET_DELETED:             { label: "Bracket eliminado",           color: "text-red-400 bg-red-900/20"        },
  DOJO_UPDATED:                { label: "Config dojo actualizada",     color: "text-blue-400 bg-blue-900/20"      },
  DOJO_DELETED:                { label: "Dojo eliminado",              color: "text-red-400 bg-red-900/20"        },
  SUBSCRIPTION_PLAN_CHANGED:   { label: "Plan cambiado",               color: "text-blue-400 bg-blue-900/20"      },
  EMAIL_SETTINGS_UPDATED:      { label: "Config correo actualizada",   color: "text-blue-400 bg-blue-900/20"      },
};

const DETAIL_LABELS: Record<string, string> = {
  fullName: "Nombre alumno", label: "Nombre del link", token: "Token",
  linkId: "ID del link", pendingId: "ID solicitud", studentCode: "Código alumno",
  note: "Nota", notify: "Familia notificada", email: "Correo", name: "Nombre",
  role: "Rol", reason: "Motivo", cascadeDeleted: "Eliminados en cascada",
  before: "Antes", after: "Después", raw: "Dato",
  dojo: "Dojo eliminado (snapshot)", subscription: "Suscripción al momento de eliminar",
  counts: "Conteo de datos eliminados", staffUsers: "Staff del dojo (admin/user)",
  deletedAt: "Fecha de eliminación",
};

function parseDetails(details: string | null): Record<string, unknown> {
  if (!details) return {};
  try { return JSON.parse(details); } catch { return { raw: details }; }
}

function friendlyKey(k: string): string {
  return DETAIL_LABELS[k] ?? k.replace(/([A-Z])/g, " $1").trim();
}

function friendlyValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

function parseUA(ua: string | null): string {
  if (!ua) return "—";
  if (/iPhone|iPad/i.test(ua))      return "iOS · " + (/Safari/.test(ua) ? "Safari" : "App");
  if (/Android/i.test(ua))          return "Android · " + (/Chrome/i.test(ua) ? "Chrome" : "Browser");
  if (/Windows/i.test(ua))          return "Windows · " + (/Chrome/i.test(ua) ? "Chrome" : /Firefox/i.test(ua) ? "Firefox" : /Edge/i.test(ua) ? "Edge" : "Browser");
  if (/Macintosh/i.test(ua))        return "macOS · " + (/Chrome/i.test(ua) ? "Chrome" : /Firefox/i.test(ua) ? "Firefox" : "Safari");
  if (/Linux/i.test(ua))            return "Linux · Browser";
  if (/curl|python|axios/i.test(ua)) return "API / Script";
  return ua.slice(0, 40) + (ua.length > 40 ? "…" : "");
}

function summarize(log: AuditEntry): string {
  const det = parseDetails(log.details);
  const who = log.userName ?? log.userEmail ?? null;
  switch (log.action) {
    case "LOGIN_FAILED":   return `Intento fallido${log.targetEmail ? ` para ${log.targetEmail}` : ""}${log.ip ? ` desde ${log.ip}` : ""}`;
    case "LOGIN_SUCCESS":  return `${who ?? "?"} inició sesión`;
    case "PENDING_STUDENT_SUBMITTED": return `Formulario de "${det.fullName ?? "?"}" enviado desde ${log.ip ?? "IP desconocida"}`;
    case "PENDING_STUDENT_APPROVED":  return `Solicitud de "${det.fullName ?? det.pendingId ?? "?"}" aprobada e inscrita`;
    case "PENDING_STUDENT_REJECTED":  return `Solicitud rechazada${det.note ? ` · Motivo: ${det.note}` : ""}`;
    case "PENDING_STUDENT_DELETED":   return `Solicitud de "${det.fullName ?? "?"}" eliminada${det.notify ? " · Familia notificada" : ""}`;
    case "REGISTRATION_LINK_CREATED": return `Link "${det.label ?? "?"}" creado`;
    case "REGISTRATION_LINK_UPDATED": return "Link de registro actualizado";
    case "REGISTRATION_LINK_DELETED": {
      const del = det.cascadeDeleted as { approved?: number; rejected?: number } | undefined;
      const parts: string[] = [`Link "${det.label ?? "?"}" eliminado`];
      if (del?.approved) parts.push(`${del.approved} aprobados eliminados en cascada`);
      if (del?.rejected) parts.push(`${del.rejected} rechazados eliminados en cascada`);
      return parts.join(" · ");
    }
    case "DOJO_DELETED": {
      const d = det.dojo as { name?: string } | undefined;
      const c = det.counts as { users?: number; students?: number } | undefined;
      return `"${d?.name ?? "?"}" eliminado — ${c?.users ?? 0} usuarios, ${c?.students ?? 0} alumnos`;
    }
    case "USER_CREATED":          return `Usuario "${det.email ?? det.name ?? "?"}" creado`;
    case "USER_UPDATED":          return `Usuario "${det.email ?? det.name ?? "?"}" editado`;
    case "USER_DELETED":          return `Usuario "${log.targetEmail ?? "?"}" eliminado`;
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

function isSuspicious(log: AuditEntry): boolean {
  return (
    log.action === "LOGIN_FAILED" ||
    log.isSysadminProxy ||
    (log.statusCode != null && [401, 403, 429].includes(log.statusCode))
  );
}

// ── Badge de acción ───────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CFG[action] ?? { label: action.replace(/_/g, " "), color: "text-dojo-muted bg-dojo-border/30" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ── Fila expandida con todos los detalles ─────────────────────────────────────

function ExpandedRow({ log, colSpan }: { log: AuditEntry; colSpan: number }) {
  const det = parseDetails(log.details);
  const detEntries = Object.entries(det);
  return (
    <tr className="bg-dojo-dark/70 border-b border-dojo-border/40">
      <td colSpan={colSpan} className="px-5 py-4">
        <div className="space-y-3">
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
            {(log.userName || log.userEmail) && (
              <div>
                <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-0.5">Quién</p>
                <p className="text-dojo-white font-medium">{log.userName ?? "—"}</p>
                <p className="text-dojo-muted">{log.userEmail ?? "—"}</p>
                {log.isSysadminProxy && (
                  <span className="mt-0.5 inline-block text-[9px] bg-purple-800/40 text-purple-300 px-1.5 py-0.5 rounded">SYSADMIN PROXY</span>
                )}
              </div>
            )}
            <div>
              <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-0.5 flex items-center gap-1"><Globe size={9} /> IP / Ubicación</p>
              <p className="text-dojo-white font-mono">{log.ip ?? "—"}</p>
              {(log.city || log.country) && (
                <p className="text-dojo-muted">{[log.city, log.region, log.country].filter(Boolean).join(", ")}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-0.5 flex items-center gap-1"><Monitor size={9} /> Dispositivo</p>
              <p className="text-dojo-white">{parseUA(log.userAgent)}</p>
            </div>
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
            {(log.resourceType || log.resourceId) && (
              <div>
                <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-0.5">Recurso</p>
                <p className="text-dojo-white">{log.resourceType ?? "—"}</p>
                <p className="text-dojo-muted font-mono text-[10px] break-all">{log.resourceId ?? "—"}</p>
              </div>
            )}
            {(log.dojoSlug || log.dojoId) && (
              <div>
                <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-0.5">Dojo</p>
                <p className="text-dojo-white">{log.dojoSlug ?? log.dojoId?.slice(0, 12) ?? "—"}</p>
              </div>
            )}
            {log.targetEmail && (
              <div>
                <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-0.5">Objetivo</p>
                <p className="text-dojo-white">{log.targetEmail}</p>
              </div>
            )}
            {log.sessionId && (
              <div>
                <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-0.5">ID Sesión</p>
                <p className="text-dojo-muted font-mono text-[10px] break-all">{log.sessionId}</p>
              </div>
            )}
          </div>
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
          {log.userAgent && (
            <p className="text-[10px] text-dojo-muted break-all border-t border-dojo-border/30 pt-2">UA: {log.userAgent}</p>
          )}
        </div>
      </td>
    </tr>
  );
}

const AUDIT_FILTERS = [
  { value: "all",         label: "Todos"       },
  { value: "logins",      label: "Logins"      },
  { value: "users",       label: "Usuarios"    },
  { value: "registros",   label: "Registros"   },
  { value: "tournaments", label: "Torneos"     },
  { value: "suspicious",  label: "Sospechoso"  },
];

type MainTab = "auditoria" | "novedades" | "inactivos";

// ── News Engagement View ──────────────────────────────────────────────────────

function NewsEngagementView() {
  const [items,    setItems]    = useState<NewsEngagement[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<Record<string, "seen" | "unseen" | null>>({});

  useEffect(() => {
    fetch("/api/system/news/engagement")
      .then(r => r.ok ? r.json() : [])
      .then((d: NewsEngagement[]) => setItems(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string, list: "seen" | "unseen") {
    setExpanded(prev => ({ ...prev, [id]: prev[id] === list ? null : list }));
  }

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-28 bg-dojo-border/40 rounded-xl animate-pulse" />)}
    </div>
  );

  if (!items.length) return (
    <div className="text-center py-16 text-dojo-muted">
      <Newspaper size={36} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm">No hay novedades publicadas aún.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {items.map(news => {
        const pct        = news.totalUsers > 0 ? Math.round((news.seenCount / news.totalUsers) * 100) : 0;
        const showSeen   = expanded[news.id] === "seen";
        const showUnseen = expanded[news.id] === "unseen";
        return (
          <div key={news.id} className="card space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black tracking-widest text-dojo-gold uppercase">{news.version}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    news.audience === "students" ? "bg-blue-900/40 text-blue-300" :
                    news.audience === "admins"   ? "bg-purple-900/40 text-purple-300" :
                    "bg-dojo-border text-dojo-muted"
                  }`}>
                    {news.audience === "students" ? "Alumnos" : news.audience === "admins" ? "Admins" : "Todos"}
                  </span>
                </div>
                <p className="text-sm font-bold text-dojo-white mt-0.5">{news.title}</p>
                <p className="text-xs text-dojo-muted">{fmtDateShort(news.publishedAt)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold font-display" style={{ color: pct >= 80 ? "#22c55e" : pct >= 50 ? "#F39C12" : "#ef4444" }}>
                  {pct}%
                </p>
                <p className="text-xs text-dojo-muted">lo vieron</p>
              </div>
            </div>
            <div className="h-2 bg-dojo-border rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: pct >= 80 ? "#22c55e" : pct >= 50 ? "#F39C12" : "#ef4444" }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => toggle(news.id, "seen")}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors text-left ${
                  showSeen ? "border-green-600/60 bg-green-900/20" : "border-dojo-border/60 hover:border-green-600/40 bg-dojo-darker"
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-green-400 shrink-0" />
                  <div>
                    <p className="text-base font-bold text-green-300">{news.seenCount}</p>
                    <p className="text-[10px] text-dojo-muted">Vieron y aceptaron</p>
                  </div>
                </div>
                {showSeen ? <ChevronUp size={14} className="text-dojo-muted" /> : <ChevronDown size={14} className="text-dojo-muted" />}
              </button>
              <button onClick={() => toggle(news.id, "unseen")}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors text-left ${
                  showUnseen ? "border-red-600/60 bg-red-900/20" : "border-dojo-border/60 hover:border-red-600/40 bg-dojo-darker"
                }`}
              >
                <div className="flex items-center gap-2">
                  <XCircle size={15} className="text-red-400 shrink-0" />
                  <div>
                    <p className="text-base font-bold text-red-300">{news.notSeenCount}</p>
                    <p className="text-[10px] text-dojo-muted">No la han visto</p>
                  </div>
                </div>
                {showUnseen ? <ChevronUp size={14} className="text-dojo-muted" /> : <ChevronDown size={14} className="text-dojo-muted" />}
              </button>
            </div>
            {showSeen && news.seenUsers.length > 0 && (
              <div className="border border-green-700/30 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-green-900/20 border-b border-green-700/20">
                  <p className="text-xs font-semibold text-green-300 flex items-center gap-1.5"><Eye size={12} /> Usuarios que presionaron ¡Entendido!</p>
                </div>
                <div className="divide-y divide-dojo-border/30 max-h-64 overflow-y-auto">
                  {news.seenUsers.map(u => (
                    <div key={u.id} className="px-3 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-dojo-white truncate">{u.name ?? u.email}</p>
                        <p className="text-[10px] text-dojo-muted truncate">{u.email} · {u.dojoName ?? "Sin dojo"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-green-400">{fmtDate(u.lastSeenAt)}</span>
                        <p className="text-[10px] text-dojo-muted capitalize">{u.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {showUnseen && news.notSeenUsers.length > 0 && (
              <div className="border border-red-700/30 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-red-900/20 border-b border-red-700/20">
                  <p className="text-xs font-semibold text-red-300 flex items-center gap-1.5"><EyeOff size={12} /> Usuarios que NO han visto la novedad</p>
                </div>
                <div className="divide-y divide-dojo-border/30 max-h-64 overflow-y-auto">
                  {news.notSeenUsers.map(u => (
                    <div key={u.id} className="px-3 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-dojo-white truncate">{u.name ?? u.email}</p>
                        <p className="text-[10px] text-dojo-muted truncate">{u.email} · {u.dojoName ?? "Sin dojo"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-dojo-muted capitalize">{u.role}</p>
                        {u.lastActiveAt
                          ? <span className="text-[10px] text-dojo-muted">Activo: {fmtDateShort(u.lastActiveAt)}</span>
                          : <span className="text-[10px] text-red-400/70">Sin actividad registrada</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Inactive Users View ───────────────────────────────────────────────────────

function InactiveUsersView() {
  const [users,   setUsers]   = useState<InactiveUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users/activity")
      .then(r => r.ok ? r.json() : [])
      .then((d: InactiveUser[]) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 bg-dojo-border/40 rounded-xl animate-pulse" />)}
    </div>
  );

  if (!users.length) return (
    <div className="text-center py-16 text-dojo-muted">
      <CheckCircle size={36} className="mx-auto mb-3 text-green-400/40" />
      <p className="text-sm font-semibold text-green-400">¡Todos activos!</p>
      <p className="text-xs mt-1">Ningún usuario lleva más de 3 días sin entrar.</p>
    </div>
  );

  const byDojo: Record<string, InactiveUser[]> = {};
  for (const u of users) {
    const key = u.dojo?.name ?? "Sin dojo";
    if (!byDojo[key]) byDojo[key] = [];
    byDojo[key]!.push(u);
  }

  function inactiveBadge(days: number | null) {
    if (days === null) return "bg-dojo-border text-dojo-muted";
    if (days >= 30)    return "badge-red";
    if (days >= 7)     return "badge-yellow";
    return "bg-orange-900/40 text-orange-300 text-xs px-2 py-0.5 rounded-full";
  }

  function daysLabel(u: InactiveUser) {
    if (u.daysSinceActive === null) return `Registrado hace ${u.daysSinceCreated}d — nunca entró`;
    return `${u.daysSinceActive} día${u.daysSinceActive !== 1 ? "s" : ""} sin actividad`;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-red-900/30 flex items-center justify-center shrink-0">
          <Clock size={16} className="text-red-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-dojo-white">{users.length} usuario{users.length !== 1 ? "s" : ""} sin actividad</p>
          <p className="text-xs text-dojo-muted">Cuentas de más de 3 días sin abrir la aplicación</p>
        </div>
      </div>
      {Object.entries(byDojo).map(([dojoName, list]) => (
        <div key={dojoName} className="card p-0 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-dojo-border bg-dojo-dark flex items-center justify-between">
            <p className="text-xs font-bold text-dojo-white flex items-center gap-2">
              <Building2 size={12} className="text-dojo-gold" /> {dojoName}
            </p>
            <span className="badge-red">{list.length}</span>
          </div>
          <div className="divide-y divide-dojo-border/40">
            {list.map(u => (
              <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-dojo-white truncate">{u.name ?? u.email}</p>
                    {!u.active && <span className="badge-red text-[10px]">Inactivo</span>}
                    <span className="text-[10px] text-dojo-muted capitalize bg-dojo-border px-1.5 py-0.5 rounded-full">{u.role}</span>
                  </div>
                  <p className="text-xs text-dojo-muted mt-0.5">{u.email}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <span className={inactiveBadge(u.daysSinceActive)}>{daysLabel(u)}</span>
                  {u.lastActiveAt && <p className="text-[10px] text-dojo-muted">{fmtDateShort(u.lastActiveAt)}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("auditoria");

  const [logs,       setLogs]       = useState<AuditEntry[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [filter,     setFilter]     = useState("all");
  const [search,     setSearch]     = useState("");
  const [dojoId,     setDojoId]     = useState("");
  const [country,    setCountry]    = useState("");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");
  const [dojos,      setDojos]      = useState<DojoOption[]>([]);
  const [expanded,   setExpanded]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dojos")
      .then(r => r.ok ? r.json() : [])
      .then((data: DojoOption[]) => setDojos(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const loadAudit = useCallback(async (p = 1) => {
    setLoading(true);
    setExpanded(null);
    const params = new URLSearchParams({ filter, page: String(p), search });
    if (dojoId)   params.set("dojoId",   dojoId);
    if (country)  params.set("country",  country.toUpperCase());
    if (dateFrom) params.set("dateFrom", `${dateFrom}T00:00:00-05:00`);
    if (dateTo)   params.set("dateTo",   `${dateTo}T23:59:59-05:00`);
    const r = await fetch(`/api/audit-logs?${params}`);
    if (r.ok) {
      const data = await r.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setPage(p);
    }
    setLoading(false);
  }, [filter, search, dojoId, country, dateFrom, dateTo]);

  useEffect(() => {
    if (activeTab === "auditoria") loadAudit(1);
  }, [activeTab, loadAudit]);

  const TABS: { id: MainTab; label: string; icon: React.ReactNode }[] = [
    { id: "auditoria", label: "Auditoría",    icon: <Shield size={15} />    },
    { id: "novedades", label: "Novedades",    icon: <Newspaper size={15} /> },
    { id: "inactivos", label: "Sin actividad",icon: <Clock size={15} />     },
  ];

  const COL_COUNT = 5;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
          <Shield size={20} className="text-purple-400" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white">Log de Auditoría</h1>
          <p className="text-sm text-dojo-muted">Actividad del sistema, engagement con novedades y usuarios inactivos</p>
        </div>
        {activeTab === "auditoria" && (
          <button onClick={() => loadAudit(page)} disabled={loading}
            className="ml-auto p-2 rounded-lg hover:bg-dojo-border transition-colors" title="Actualizar">
            <RefreshCw size={16} className={`text-dojo-muted ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {/* Tabs principales */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === t.id
                ? "bg-dojo-gold text-dojo-darker shadow-sm"
                : "bg-dojo-border text-dojo-muted hover:text-dojo-white"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Auditoría ── */}
      {activeTab === "auditoria" && (
        <>
          {/* Filtros */}
          <form onSubmit={e => { e.preventDefault(); loadAudit(1); }} className="card space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex gap-1.5 flex-wrap">
                {AUDIT_FILTERS.map(o => (
                  <button key={o.value} type="button"
                    onClick={() => { setFilter(o.value); setPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      filter === o.value
                        ? o.value === "suspicious" ? "bg-orange-600 text-white" : "bg-dojo-gold text-black"
                        : o.value === "suspicious" ? "text-orange-400 hover:text-orange-300 bg-dojo-border" : "bg-dojo-border text-dojo-muted hover:text-dojo-white"
                    }`}
                  >
                    {o.value === "suspicious" && <AlertTriangle size={10} className="inline mr-1" />}
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 flex gap-2">
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por email, IP, acción, detalles…"
                  className="form-input flex-1" style={{ fontSize: "16px" }} />
                <button type="submit" className="btn-primary px-4 shrink-0"><Search size={15} /></button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <label className="form-label text-xs flex items-center gap-1.5"><Building2 size={11} /> Dojo</label>
                <select value={dojoId} onChange={e => setDojoId(e.target.value)} className="form-input" style={{ fontSize: "16px" }}>
                  <option value="">Todos los dojos</option>
                  {dojos.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="w-full sm:w-36 space-y-1">
                <label className="form-label text-xs flex items-center gap-1.5"><Globe size={11} /> País</label>
                <input type="text" value={country} onChange={e => setCountry(e.target.value)}
                  placeholder="PA, CO…" maxLength={2} className="form-input uppercase" style={{ fontSize: "16px" }} />
              </div>
              <div className="flex-1 space-y-1">
                <label className="form-label text-xs">Desde</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="form-input" style={{ fontSize: "16px" }} />
              </div>
              <div className="flex-1 space-y-1">
                <label className="form-label text-xs">Hasta</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="form-input" style={{ fontSize: "16px" }} />
              </div>
            </div>
          </form>

          {/* Tabla */}
          <div className="card p-0 overflow-hidden">
            <p className="px-4 pt-3 text-xs text-dojo-muted">{total.toLocaleString()} registros · Haz clic en una fila para ver todos los detalles</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dojo-border bg-dojo-dark/40">
                    {["Fecha/Hora (PAN)", "Acción · Descripción", "Quién", "IP / Geo", ""].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs text-dojo-muted uppercase tracking-wider font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 8 }, (_, i) => (
                      <tr key={i} className="border-b border-dojo-border/40">
                        {Array.from({ length: COL_COUNT }, (_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-3 bg-dojo-border/60 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={COL_COUNT} className="px-4 py-10 text-center text-dojo-muted text-sm">
                        <Filter size={28} className="mx-auto mb-2 opacity-30" />
                        No se encontraron eventos con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    logs.map(log => {
                      const isOpen    = expanded === log.id;
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
                            <td className="px-4 py-3 text-xs text-dojo-muted whitespace-nowrap">
                              {fmtDateTime(log.createdAt)}
                            </td>
                            <td className="px-4 py-3 min-w-[240px]">
                              <ActionBadge action={log.action} />
                              <p className="text-xs text-dojo-muted mt-0.5 leading-relaxed">{summarize(log)}</p>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {log.userEmail ? (
                                <>
                                  <p className="text-dojo-white font-medium">{log.userName ?? log.userEmail}</p>
                                  {log.userName && <p className="text-dojo-muted">{log.userEmail}</p>}
                                  {log.dojoSlug && <p className="text-dojo-muted font-mono text-[10px]">{log.dojoSlug}</p>}
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
                            <td className="px-4 py-3 text-xs">
                              {log.ip ? (
                                <>
                                  <p className="text-dojo-white font-mono">{log.ip}</p>
                                  {log.country && (
                                    <p className="text-dojo-muted text-[10px] flex items-center gap-1">
                                      {flag(log.country)} {[log.city, log.country].filter(Boolean).join(", ")}
                                    </p>
                                  )}
                                </>
                              ) : <span className="text-dojo-muted">—</span>}
                            </td>
                            <td className="px-3 py-3 text-dojo-muted">
                              {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </td>
                          </tr>
                          {isOpen && <ExpandedRow log={log} colSpan={COL_COUNT} />}
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
                  <button onClick={() => loadAudit(page - 1)} disabled={page <= 1 || loading}
                    className="p-1.5 rounded hover:bg-dojo-border transition-colors disabled:opacity-30">
                    <ChevronLeft size={16} className="text-dojo-muted" />
                  </button>
                  <button onClick={() => loadAudit(page + 1)} disabled={page >= totalPages || loading}
                    className="p-1.5 rounded hover:bg-dojo-border transition-colors disabled:opacity-30">
                    <ChevronRight size={16} className="text-dojo-muted" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB: Novedades ── */}
      {activeTab === "novedades" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-dojo-gold" />
            <p className="text-sm font-semibold text-dojo-white">Compromiso con Novedades del Sistema</p>
          </div>
          <NewsEngagementView />
        </div>
      )}

      {/* ── TAB: Sin actividad ── */}
      {activeTab === "inactivos" && <InactiveUsersView />}
    </div>
  );
}
