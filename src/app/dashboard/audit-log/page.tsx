"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/utils";

type FilterType = "all" | "users" | "tournaments" | "logins";

interface LogEntry {
  id:        string;
  action:    string;
  userEmail: string | null;
  dojoId:    string | null;
  dojoSlug:  string | null;
  ip:        string | null;
  details:   string | null;
  createdAt: string;
}

// Colores y etiquetas por tipo de acción
const ACTION_CFG: Record<string, { label: string; color: string }> = {
  USER_CREATED:           { label: "Usuario creado",              color: "text-green-400 bg-green-900/20" },
  USER_UPDATED:           { label: "Usuario editado",             color: "text-blue-400 bg-blue-900/20"  },
  USER_DELETED:           { label: "Usuario eliminado",           color: "text-red-400 bg-red-900/20"    },
  USER_ACTIVATED:         { label: "Usuario activado",            color: "text-green-400 bg-green-900/20"},
  USER_DEACTIVATED:       { label: "Usuario desactivado",         color: "text-yellow-400 bg-yellow-900/20"},
  USER_PASSWORD_CHANGED:  { label: "Contraseña cambiada (admin)", color: "text-purple-400 bg-purple-900/20"},
  PASSWORD_CHANGED:       { label: "Contraseña cambiada",         color: "text-purple-400 bg-purple-900/20"},
  LOGIN_SUCCESS:          { label: "Login exitoso",               color: "text-dojo-muted bg-dojo-border/30"},
  LOGIN_FAILED:           { label: "Login fallido",               color: "text-orange-400 bg-orange-900/20"},
  TOURNAMENT_ARCHIVED:    { label: "Torneo inactivado",           color: "text-yellow-400 bg-yellow-900/20"},
  TOURNAMENT_REACTIVATED: { label: "Torneo reactivado",           color: "text-green-400 bg-green-900/20"},
  TOURNAMENT_DELETED:     { label: "Torneo eliminado",            color: "text-red-400 bg-red-900/20"    },
  BRACKET_REOPENED:       { label: "Bracket reabierto",           color: "text-yellow-400 bg-yellow-900/20"},
  BRACKET_DELETED:        { label: "Bracket eliminado",           color: "text-red-400 bg-red-900/20"    },
};

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CFG[action] ?? { label: action, color: "text-dojo-muted bg-dojo-border/30" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function parseDetails(details: string | null): Record<string, unknown> {
  if (!details) return {};
  try { return JSON.parse(details); } catch { return { raw: details }; }
}

export default function AuditLogPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const role = (session?.user as { role?: string })?.role ?? "user";

  // Redirect non-sysadmin
  useEffect(() => {
    if (status === "authenticated" && role !== "sysadmin")
      router.replace("/dashboard");
  }, [status, role, router]);

  const [logs,       setLogs]       = useState<LogEntry[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState<FilterType>("all");
  const [search,     setSearch]     = useState("");
  const [searchInput,setSearchInput]= useState("");
  const [expanded,   setExpanded]   = useState<string | null>(null);

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

  // Reset page when filter/search changes
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

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <ShieldCheck size={20} className="text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-dojo-white">Log de Auditoría</h1>
          <p className="text-xs text-dojo-muted">{total.toLocaleString()} registros totales</p>
        </div>
        <button onClick={load} className="ml-auto p-2 rounded-lg hover:bg-dojo-border transition-colors" title="Actualizar">
          <RefreshCw size={16} className={`text-dojo-muted ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-dojo-dark rounded-lg p-1 border border-dojo-border">
          {(["all","users","tournaments","logins"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                filter === f
                  ? "bg-dojo-gold text-black"
                  : "text-dojo-muted hover:text-dojo-white",
              ].join(" ")}
            >
              {{ all: "Todos", users: "Usuarios", tournaments: "Torneos", logins: "Accesos" }[f]}
            </button>
          ))}
        </div>

        <form
          onSubmit={e => { e.preventDefault(); setSearch(searchInput); }}
          className="flex items-center gap-2 flex-1 min-w-[200px]"
        >
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Buscar por email, acción..."
              className="form-input pl-8 py-1.5 text-sm w-full"
            />
          </div>
          <button type="submit" className="btn-secondary text-xs py-1.5 px-3">Buscar</button>
          {search && (
            <button type="button" onClick={() => { setSearch(""); setSearchInput(""); }}
              className="text-xs text-dojo-muted hover:text-dojo-white transition-colors">
              Limpiar
            </button>
          )}
        </form>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dojo-border">
                {["Fecha/Hora (PAN)", "Acción", "Realizado por", "Dojo/IP", "Detalles"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-dojo-muted uppercase tracking-wider font-semibold">
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
                  const det     = parseDetails(log.details);
                  const isOpen  = expanded === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : log.id)}
                        className="border-b border-dojo-border/40 hover:bg-dojo-border/10 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-xs text-dojo-muted whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <ActionBadge action={log.action} />
                        </td>
                        <td className="px-4 py-3 text-xs text-dojo-white font-medium">
                          {log.userEmail ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-dojo-muted">
                          {log.dojoSlug ?? log.dojoId?.slice(0, 8) ?? "—"}
                          {log.ip && <span className="block text-[10px] opacity-60">{log.ip}</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-dojo-muted max-w-xs truncate">
                          {Object.entries(det)
                            .filter(([k]) => !["changedBy","createdBy","deletedBy"].includes(k))
                            .slice(0, 2)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" · ")}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-dojo-dark/60 border-b border-dojo-border/40">
                          <td colSpan={5} className="px-6 py-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
                              {Object.entries(det).map(([k, v]) => (
                                <div key={k}>
                                  <span className="text-[10px] text-dojo-muted uppercase tracking-wider">{k}</span>
                                  <p className="text-xs text-dojo-white break-all">{String(v)}</p>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dojo-border">
            <p className="text-xs text-dojo-muted">
              Página {page} de {totalPages} · {total.toLocaleString()} registros
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded hover:bg-dojo-border transition-colors disabled:opacity-30"
              >
                <ChevronLeft size={16} className="text-dojo-muted" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded hover:bg-dojo-border transition-colors disabled:opacity-30"
              >
                <ChevronRight size={16} className="text-dojo-muted" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
