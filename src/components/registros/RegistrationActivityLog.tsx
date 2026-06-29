"use client";
import { useState, useEffect, useCallback } from "react";
import { Eye, ShieldX, Copy, CheckCircle2, UserCheck, UserX, Link2, RefreshCw } from "lucide-react";

interface ActivityEvent {
  id:         string;
  action:     string;
  createdAt:  string;
  ip:         string | null;
  resourceId: string | null;
  details:    string | null;
  userAgent:  string | null;
}

const ACTION_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  REGISTRATION_FORM_VIEWED:       { label: "Formulario abierto",    icon: <Eye size={13} />,          color: "text-blue-400 bg-blue-900/20 border-blue-800/40" },
  REGISTRATION_LINK_BLOCKED:      { label: "Envío bloqueado (link)",  icon: <ShieldX size={13} />,      color: "text-orange-400 bg-orange-900/20 border-orange-800/40" },
  REGISTRATION_DUPLICATE_BLOCKED: { label: "Duplicado detectado",   icon: <Copy size={13} />,         color: "text-red-400 bg-red-900/20 border-red-800/40" },
  PENDING_STUDENT_SUBMITTED:      { label: "Formulario enviado",    icon: <CheckCircle2 size={13} />,  color: "text-green-400 bg-green-900/20 border-green-800/40" },
  REGISTRATION_LINK_CREATED:      { label: "Link creado",           icon: <Link2 size={13} />,         color: "text-dojo-gold bg-dojo-gold/10 border-dojo-gold/30" },
  PENDING_STUDENT_APPROVED:       { label: "Solicitud aprobada",    icon: <UserCheck size={13} />,     color: "text-green-400 bg-green-900/20 border-green-800/40" },
  PENDING_STUDENT_REJECTED:       { label: "Solicitud rechazada",   icon: <UserX size={13} />,         color: "text-red-400 bg-red-900/20 border-red-800/40" },
};

function parseDetails(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, string>; } catch { return {}; }
}

function reasonLabel(reason: string): string {
  const MAP: Record<string, string> = {
    link_inactive:     "Link desactivado",
    link_expired:      "Link vencido",
    max_uses_reached:  "Límite de usos alcanzado",
    not_activated_yet: "Link aún no activo",
  };
  return MAP[reason] ?? reason;
}

function ActionBadge({ action }: { action: string }) {
  const m = ACTION_META[action] ?? { label: action, icon: null, color: "text-dojo-muted bg-dojo-card border-dojo-border" };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${m.color}`}>
      {m.icon} {m.label}
    </span>
  );
}

export default function RegistrationActivityLog({ linkId }: { linkId?: string }) {
  const [events,  setEvents]  = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = linkId
        ? `/api/registration-links/activity?linkId=${linkId}`
        : `/api/registration-links/activity`;
      const res = await fetch(url);
      if (res.ok) setEvents(await res.json() as ActivityEvent[]);
    } finally {
      setLoading(false);
    }
  }, [linkId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-dojo-muted">
          Últimos {events.length} eventos de registro para este dojo.
        </p>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-dojo-muted hover:text-dojo-white transition-colors disabled:opacity-40">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {loading && <div className="h-40 bg-dojo-card rounded-xl animate-pulse" />}

      {!loading && events.length === 0 && (
        <div className="card text-center py-10 text-dojo-muted text-sm">
          Sin actividad de registro registrada aún.
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-dojo-muted border-b border-dojo-border">
                <th className="pb-2 pr-4 font-medium">Fecha / Hora</th>
                <th className="pb-2 pr-4 font-medium">Evento</th>
                <th className="pb-2 pr-4 font-medium">Nombre</th>
                <th className="pb-2 pr-4 font-medium">Correo</th>
                <th className="pb-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dojo-border/40">
              {events.map(ev => {
                const d = parseDetails(ev.details);
                const hasName  = !!(d.fullName);
                const hasEmail = !!(d.email);
                return (
                  <tr key={ev.id} className="hover:bg-dojo-card/40 transition-colors">
                    <td className="py-2.5 pr-4 text-xs text-dojo-muted whitespace-nowrap">
                      {new Date(ev.createdAt).toLocaleString("es-PA", {
                        timeZone: "America/Panama",
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit", hour12: true,
                      })}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <ActionBadge action={ev.action} />
                        {ev.action === "REGISTRATION_LINK_BLOCKED" && d.reason && (
                          <p className="text-xs text-orange-300">{reasonLabel(d.reason)}</p>
                        )}
                        {ev.action === "REGISTRATION_DUPLICATE_BLOCKED" && d.field && (
                          <p className="text-xs text-red-300">
                            Campo: {d.field === "cedula" ? `Cédula${d.cedula ? ` (${d.cedula})` : ""}` : "Correo"}
                          </p>
                        )}
                        {ev.action === "REGISTRATION_FORM_VIEWED" && d.reset === "true" && (
                          <p className="text-xs text-blue-300">Reapertura ?reset=1</p>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-dojo-white">
                      {hasName ? d.fullName : <span className="text-dojo-muted">—</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-dojo-muted">
                      {hasEmail ? d.email : <span className="text-dojo-muted">—</span>}
                    </td>
                    <td className="py-2.5 text-xs text-dojo-muted font-mono whitespace-nowrap">
                      {ev.ip ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
