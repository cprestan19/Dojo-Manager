"use client";
import { useState, useCallback, useEffect } from "react";
import { Search, Filter, ChevronLeft, ChevronRight, Shield, Globe, Building2 } from "lucide-react";

interface AuditEntry {
  id:              string;
  action:          string;
  module:          string | null;
  resourceType:    string | null;
  resourceId:      string | null;
  statusCode:      number | null;
  userId:          string | null;
  userName:        string | null;
  userEmail:       string | null;
  isSysadminProxy: boolean;
  dojoId:          string | null;
  dojoSlug:        string | null;
  targetEmail:     string | null;
  ip:              string | null;
  country:         string | null;
  city:            string | null;
  region:          string | null;
  details:         string | null;
  createdAt:       string;
}

interface DojoOption { id: string; name: string; slug: string; }

const TZ = "America/Panama";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-PA", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
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

const FILTER_OPTS = [
  { value: "all",         label: "Todos" },
  { value: "logins",      label: "Logins" },
  { value: "users",       label: "Usuarios" },
  { value: "registros",   label: "Registros" },
  { value: "tournaments", label: "Torneos" },
  { value: "suspicious",  label: "Sospechoso" },
];

export default function AuditLogsPage() {
  const [logs,       setLogs]       = useState<AuditEntry[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(false);

  // Filters
  const [filter,   setFilter]   = useState("all");
  const [search,   setSearch]   = useState("");
  const [dojoId,   setDojoId]   = useState("");
  const [country,  setCountry]  = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  const [dojos, setDojos] = useState<DojoOption[]>([]);

  // Load dojo list for selector
  useEffect(() => {
    fetch("/api/dojos")
      .then(r => r.ok ? r.json() : [])
      .then((data: DojoOption[]) => setDojos(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const load = useCallback(async (p = 1) => {
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

  useEffect(() => { load(1); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load(1);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield size={22} className="text-dojo-gold shrink-0" />
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white">Log de Auditoría</h1>
          <p className="text-sm text-dojo-muted">{total.toLocaleString()} eventos registrados</p>
        </div>
      </div>

      {/* Filtros */}
      <form onSubmit={handleSearch} className="card space-y-4">

        {/* Fila 1: tipo de filtro + búsqueda */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {FILTER_OPTS.map(o => (
              <button
                key={o.value}
                type="button"
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
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por email, IP, acción, detalles…"
              className="form-input flex-1"
              style={{ fontSize: "16px" }}
            />
            <button type="submit" className="btn-primary px-4 shrink-0">
              <Search size={15} />
            </button>
          </div>
        </div>

        {/* Fila 2: dojo, país, fechas */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-1">
            <label className="form-label text-xs flex items-center gap-1.5">
              <Building2 size={11} /> Dojo
            </label>
            <select value={dojoId} onChange={e => setDojoId(e.target.value)} className="form-input" style={{ fontSize: "16px" }}>
              <option value="">Todos los dojos</option>
              {dojos.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-36 space-y-1">
            <label className="form-label text-xs flex items-center gap-1.5">
              <Globe size={11} /> País (código)
            </label>
            <input
              type="text"
              value={country}
              onChange={e => setCountry(e.target.value)}
              placeholder="PA, CO, ES…"
              maxLength={2}
              className="form-input uppercase"
              style={{ fontSize: "16px" }}
            />
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
                  <tr key={log.id} className={`hover:bg-dojo-border/20 transition-colors ${
                    log.isSysadminProxy ? "bg-yellow-900/10" : ""
                  }`}>
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
                      {log.dojoSlug ? (
                        <span className="font-mono text-dojo-muted">{log.dojoSlug}</span>
                      ) : log.dojoId ? (
                        <span className="font-mono text-dojo-muted text-[10px]">{log.dojoId.slice(0, 8)}…</span>
                      ) : "—"}
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

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-dojo-muted">
            Página {page} de {totalPages} · {total.toLocaleString()} eventos
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1 || loading}
              className="btn-ghost px-3 py-1.5 text-sm disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => load(page + 1)}
              disabled={page >= totalPages || loading}
              className="btn-ghost px-3 py-1.5 text-sm disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
