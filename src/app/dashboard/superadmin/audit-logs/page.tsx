"use client";
import { useState, useCallback, useEffect } from "react";
import {
  Search, Filter, ChevronLeft, ChevronRight, Shield, Globe,
  Building2, Newspaper, Clock, CheckCircle, XCircle, ChevronDown,
  ChevronUp, Users, Eye, EyeOff,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string; action: string; module: string | null; resourceType: string | null;
  resourceId: string | null; statusCode: number | null; userId: string | null;
  userName: string | null; userEmail: string | null; isSysadminProxy: boolean;
  dojoId: string | null; dojoSlug: string | null; targetEmail: string | null;
  ip: string | null; country: string | null; city: string | null;
  region: string | null; details: string | null; createdAt: string;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const TZ = "America/Panama";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PA", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
}

function fmtDateShort(iso: string | null) {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleDateString("es-PA", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
}

function flag(code: string | null) {
  if (!code || code.length !== 2) return "🌐";
  return Array.from(code.toUpperCase()).map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join("");
}

function actionBadge(action: string) {
  if (action.includes("DELETED") || action.includes("FAILED")) return "badge-red";
  if (action.includes("CREATED") || action.includes("SUBMITTED") || action.includes("REGISTERED")) return "badge-green";
  if (action.includes("UPDATED") || action.includes("CHANGED"))  return "badge-yellow";
  if (action.includes("LOGIN") || action.includes("LOGOUT"))     return "badge-blue";
  return "bg-dojo-border text-dojo-muted text-xs px-2 py-0.5 rounded-full";
}

const AUDIT_FILTERS = [
  { value: "all",         label: "Todos" },
  { value: "logins",      label: "Logins" },
  { value: "users",       label: "Usuarios" },
  { value: "registros",   label: "Registros" },
  { value: "tournaments", label: "Torneos" },
  { value: "suspicious",  label: "Sospechoso" },
];

type MainTab = "auditoria" | "novedades" | "inactivos";

// ── News Engagement View ──────────────────────────────────────────────────────

function NewsEngagementView() {
  const [items,   setItems]   = useState<NewsEngagement[]>([]);
  const [loading, setLoading] = useState(true);
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
      {[1,2,3].map(i => <div key={i} className="h-28 bg-dojo-border/40 rounded-xl animate-pulse" />)}
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
        const pct = news.totalUsers > 0 ? Math.round((news.seenCount / news.totalUsers) * 100) : 0;
        const showSeen   = expanded[news.id] === "seen";
        const showUnseen = expanded[news.id] === "unseen";
        return (
          <div key={news.id} className="card space-y-4">
            {/* Header */}
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

            {/* Barra de progreso */}
            <div className="h-2 bg-dojo-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  backgroundColor: pct >= 80 ? "#22c55e" : pct >= 50 ? "#F39C12" : "#ef4444",
                }}
              />
            </div>

            {/* Contadores con botones */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => toggle(news.id, "seen")}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors text-left ${
                  showSeen
                    ? "border-green-600/60 bg-green-900/20"
                    : "border-dojo-border/60 hover:border-green-600/40 bg-dojo-darker"
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

              <button
                onClick={() => toggle(news.id, "unseen")}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors text-left ${
                  showUnseen
                    ? "border-red-600/60 bg-red-900/20"
                    : "border-dojo-border/60 hover:border-red-600/40 bg-dojo-darker"
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

            {/* Lista expandible — vieron */}
            {showSeen && news.seenUsers.length > 0 && (
              <div className="border border-green-700/30 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-green-900/20 border-b border-green-700/20">
                  <p className="text-xs font-semibold text-green-300 flex items-center gap-1.5">
                    <Eye size={12} /> Usuarios que presionaron ¡Entendido!
                  </p>
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

            {/* Lista expandible — no vieron */}
            {showUnseen && news.notSeenUsers.length > 0 && (
              <div className="border border-red-700/30 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-red-900/20 border-b border-red-700/20">
                  <p className="text-xs font-semibold text-red-300 flex items-center gap-1.5">
                    <EyeOff size={12} /> Usuarios que NO han visto la novedad
                  </p>
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
                          : <span className="text-[10px] text-red-400/70">Sin actividad registrada</span>
                        }
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
      {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-dojo-border/40 rounded-xl animate-pulse" />)}
    </div>
  );

  if (!users.length) return (
    <div className="text-center py-16 text-dojo-muted">
      <CheckCircle size={36} className="mx-auto mb-3 text-green-400/40" />
      <p className="text-sm font-semibold text-green-400">¡Todos activos!</p>
      <p className="text-xs mt-1">Ningún usuario lleva más de 3 días sin entrar.</p>
    </div>
  );

  // Agrupar por dojo
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
                  <span className={inactiveBadge(u.daysSinceActive)}>
                    {daysLabel(u)}
                  </span>
                  {u.lastActiveAt && (
                    <p className="text-[10px] text-dojo-muted">{fmtDateShort(u.lastActiveAt)}</p>
                  )}
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

  // Audit log state
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

  useEffect(() => {
    fetch("/api/dojos")
      .then(r => r.ok ? r.json() : [])
      .then((data: DojoOption[]) => setDojos(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const loadAudit = useCallback(async (p = 1) => {
    setLoading(true);
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
    { id: "auditoria", label: "Auditoría",      icon: <Shield size={15} /> },
    { id: "novedades", label: "Novedades",       icon: <Newspaper size={15} /> },
    { id: "inactivos", label: "Sin actividad",   icon: <Clock size={15} /> },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield size={22} className="text-dojo-gold shrink-0" />
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white">Log de Auditoría</h1>
          <p className="text-sm text-dojo-muted">Actividad del sistema, compromiso con novedades y usuarios inactivos</p>
        </div>
      </div>

      {/* Tabs principales */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
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
          <form onSubmit={e => { e.preventDefault(); loadAudit(1); }} className="card space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex gap-1.5 flex-wrap">
                {AUDIT_FILTERS.map(o => (
                  <button
                    key={o.value} type="button"
                    onClick={() => { setFilter(o.value); setPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      filter === o.value
                        ? "bg-dojo-red text-white"
                        : "bg-dojo-border text-dojo-muted hover:text-dojo-white"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 flex gap-2">
                <input
                  type="text" value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por email, IP, acción, detalles…"
                  className="form-input flex-1" style={{ fontSize: "16px" }}
                />
                <button type="submit" className="btn-primary px-4 shrink-0">
                  <Search size={15} />
                </button>
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

          <div className="card p-0 overflow-hidden">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 bg-dojo-border/40 rounded animate-pulse" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16 text-dojo-muted">
                <Filter size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No se encontraron eventos con los filtros aplicados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-dojo-border text-dojo-muted">
                      <th className="px-3 py-2.5 text-left whitespace-nowrap">Fecha (PA)</th>
                      <th className="px-3 py-2.5 text-left">Acción</th>
                      <th className="px-3 py-2.5 text-left hidden md:table-cell">Módulo</th>
                      <th className="px-3 py-2.5 text-left">Usuario / Email</th>
                      <th className="px-3 py-2.5 text-left hidden lg:table-cell">Dojo</th>
                      <th className="px-3 py-2.5 text-left">IP · País</th>
                      <th className="px-3 py-2.5 text-left hidden xl:table-cell">Detalles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dojo-border/40">
                    {logs.map(log => (
                      <tr key={log.id} className={`hover:bg-dojo-border/20 transition-colors ${log.isSysadminProxy ? "bg-yellow-900/10" : ""}`}>
                        <td className="px-3 py-2.5 text-dojo-muted whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                        <td className="px-3 py-2.5">
                          <span className={actionBadge(log.action)}>{log.action}</span>
                        </td>
                        <td className="px-3 py-2.5 text-dojo-muted hidden md:table-cell">{log.module ?? "—"}</td>
                        <td className="px-3 py-2.5">
                          <p className="text-dojo-white">{log.userName ?? "—"}</p>
                          <p className="text-dojo-muted">{log.userEmail ?? log.targetEmail ?? ""}</p>
                        </td>
                        <td className="px-3 py-2.5 hidden lg:table-cell">
                          {log.dojoSlug
                            ? <span className="font-mono text-dojo-muted">{log.dojoSlug}</span>
                            : log.dojoId
                              ? <span className="font-mono text-dojo-muted text-[10px]">{log.dojoId.slice(0, 8)}…</span>
                              : "—"}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <p className="font-mono text-dojo-white">{log.ip ?? "—"}</p>
                          <p className="text-dojo-muted flex items-center gap-1">
                            <span>{flag(log.country)}</span>
                            <span>{log.country ?? ""}{log.city ? ` · ${log.city}` : ""}</span>
                          </p>
                        </td>
                        <td className="px-3 py-2.5 hidden xl:table-cell max-w-xs">
                          {log.details ? (
                            <span className="text-dojo-muted truncate block max-w-xs" title={log.details}>
                              {(() => {
                                try {
                                  const d = JSON.parse(log.details);
                                  return Object.entries(d).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(" · ");
                                } catch { return log.details; }
                              })()}
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-dojo-muted">
                Página {page} de {totalPages} · {total.toLocaleString()} eventos
              </p>
              <div className="flex gap-2">
                <button onClick={() => loadAudit(page - 1)} disabled={page <= 1 || loading}
                  className="btn-ghost px-3 py-1.5 text-sm disabled:opacity-30">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => loadAudit(page + 1)} disabled={page >= totalPages || loading}
                  className="btn-ghost px-3 py-1.5 text-sm disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
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
