"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import {
  Trophy, Plus, MapPin, Calendar, Building2, Users,
  Trash2, Archive, ArchiveRestore, Clock,
} from "lucide-react";
import { useToast, ToastContainer } from "@/components/ui/Toast";

type SessionUser  = { role?: string };
type ViewTab      = "active" | "history";

interface Tournament {
  id:           string;
  name:         string;
  date:         string;
  location:     string;
  organization: string;
  status:       string;
  archivedAt:   string | null;
  _count:       { participants: number };
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:     { label: "Borrador",      className: "badge-yellow" },
  ready:     { label: "Bracket Listo", className: "badge-blue"   },
  active:    { label: "En Progreso",   className: "badge-green"  },
  completed: { label: "Completado",    className: "badge-red"    },
  confirmed: { label: "Confirmado",    className: "badge-green"  },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? { label: status, className: "badge-yellow" };
  return <span className={c.className}>{c.label}</span>;
}

function SkeletonCard() {
  return (
    <div className="card space-y-3 animate-pulse">
      <div className="h-5 bg-dojo-border/60 rounded w-3/4" />
      <div className="h-3 bg-dojo-border/40 rounded w-1/2" />
      <div className="h-3 bg-dojo-border/40 rounded w-2/3" />
    </div>
  );
}

export default function TournamentsPage() {
  const { data: session } = useSession();
  const router            = useRouter();
  const { toasts, show: showToast, dismiss } = useToast();

  const role       = (session?.user as SessionUser)?.role ?? "user";
  const canEdit    = role === "admin" || role === "sysadmin";
  const isSysadmin = role === "sysadmin";

  const [viewTab,     setViewTab]     = useState<ViewTab>("active");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [acting,      setActing]      = useState<string | null>(null);

  const load = useCallback(async (tab: ViewTab) => {
    setLoading(true);
    const res = await fetch(`/api/tournaments?archived=${tab === "history"}`);
    if (res.ok) setTournaments(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(viewTab); }, [load, viewTab]);

  async function handleArchive(t: Tournament, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`¿Inactivar "${t.name}"? Pasará al historial y no aparecerá en la lista activa.`)) return;
    setActing(t.id);
    const res = await fetch(`/api/tournaments/${t.id}/archive`, { method: "POST" });
    if (res.ok) {
      showToast("Torneo inactivado y movido al historial");
      setTournaments(prev => prev.filter(x => x.id !== t.id));
    } else {
      const d = await res.json().catch(() => ({}));
      showToast((d as { error?: string }).error ?? "Error al inactivar", "error");
    }
    setActing(null);
  }

  async function handleReactivate(t: Tournament, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`¿Reactivar "${t.name}"? Volverá a aparecer en la lista activa.`)) return;
    setActing(t.id);
    const res = await fetch(`/api/tournaments/${t.id}/archive`, { method: "DELETE" });
    if (res.ok) {
      showToast("Torneo reactivado");
      setTournaments(prev => prev.filter(x => x.id !== t.id));
    } else {
      const d = await res.json().catch(() => ({}));
      showToast((d as { error?: string }).error ?? "Error al reactivar", "error");
    }
    setActing(null);
  }

  async function handleDelete(t: Tournament, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`¿Eliminar permanentemente "${t.name}"? Esta acción no se puede deshacer.`)) return;
    setActing(t.id);
    const res = await fetch(`/api/tournaments/${t.id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Torneo eliminado");
      setTournaments(prev => prev.filter(x => x.id !== t.id));
    } else {
      const d = await res.json().catch(() => ({}));
      showToast((d as { error?: string }).error ?? "No se pudo eliminar", "error");
    }
    setActing(null);
  }

  const isEmpty = !loading && tournaments.length === 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-dojo-gold/10 flex items-center justify-center">
            <Trophy className="text-dojo-gold" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dojo-white">Torneos</h1>
            <p className="text-xs text-dojo-muted">Gestión de torneos y brackets</p>
          </div>
        </div>
        {canEdit && (
          <Link href="/dashboard/tournaments/new" className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nuevo Torneo
          </Link>
        )}
      </div>

      {/* Tabs Activos / Historial */}
      <div className="flex gap-0 border-b border-dojo-border">
        {([
          { key: "active",  label: "Activos",   icon: Trophy   },
          { key: "history", label: "Historial",  icon: Archive  },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setViewTab(tab.key)}
            className={[
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              viewTab === tab.key
                ? "border-dojo-gold text-dojo-gold"
                : "border-transparent text-dojo-muted hover:text-dojo-white hover:border-dojo-border",
            ].join(" ")}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : isEmpty ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-dojo-gold/10 flex items-center justify-center">
            {viewTab === "history"
              ? <Archive className="text-dojo-muted/60" size={28} />
              : <Trophy  className="text-dojo-gold/60"   size={28} />
            }
          </div>
          <div>
            <p className="text-dojo-white font-semibold">
              {viewTab === "history" ? "No hay torneos en el historial" : "No hay torneos activos"}
            </p>
            <p className="text-dojo-muted text-sm mt-1">
              {viewTab === "history"
                ? "Los torneos inactivados aparecerán aquí"
                : canEdit ? "Crea tu primer torneo para comenzar" : "Aún no hay torneos en este dojo"
              }
            </p>
          </div>
          {viewTab === "active" && canEdit && (
            <Link href="/dashboard/tournaments/new" className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Crear Primer Torneo
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tournaments.map(t => (
            <div key={t.id} className="relative group">
              <Link
                href={`/dashboard/tournaments/${t.id}`}
                className={[
                  "card block transition-colors",
                  viewTab === "history"
                    ? "opacity-75 hover:opacity-100 hover:border-dojo-border/80"
                    : "hover:border-dojo-gold/40",
                ].join(" ")}
              >
                {/* Banner "Inactivo" en historial */}
                {viewTab === "history" && (
                  <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold
                                  text-dojo-muted uppercase tracking-wider">
                    <Clock size={10} />
                    Inactivado el {t.archivedAt ? formatDate(t.archivedAt) : "—"}
                  </div>
                )}

                <div className="flex items-start justify-between gap-2 mb-3">
                  <h2 className="font-semibold text-dojo-white group-hover:text-dojo-gold
                                 transition-colors leading-snug pr-16">
                    {t.name}
                  </h2>
                  <StatusBadge status={t.status} />
                </div>

                <div className="space-y-1.5 text-sm text-dojo-muted">
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className="shrink-0" />
                    <span>{formatDate(t.date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="shrink-0" />
                    <span className="truncate">{t.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 size={13} className="shrink-0" />
                    <span className="truncate">{t.organization}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={13} className="shrink-0" />
                    <span>
                      {t._count.participants} participante{t._count.participants !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </Link>

              {/* Acciones — aparecen al hacer hover */}
              {canEdit && (
                <div className="absolute top-3 right-3 flex items-center gap-1
                                opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {viewTab === "active" ? (
                    <>
                      {/* Inactivar */}
                      <button
                        onClick={e => handleArchive(t, e)}
                        disabled={acting === t.id}
                        title="Mover al historial"
                        className="p-1.5 rounded-lg text-dojo-muted hover:text-yellow-400
                                   hover:bg-yellow-400/10 transition-colors"
                      >
                        {acting === t.id
                          ? <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                          : <Archive size={14} />
                        }
                      </button>
                      {/* Eliminar — sysadmin siempre, admin solo borrador */}
                      {(isSysadmin || t.status === "draft") && (
                        <button
                          onClick={e => handleDelete(t, e)}
                          disabled={acting === t.id}
                          title="Eliminar permanentemente"
                          className="p-1.5 rounded-lg text-dojo-muted hover:text-red-400
                                     hover:bg-red-400/10 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Reactivar — admin y sysadmin */}
                      {canEdit && (
                        <button
                          onClick={e => handleReactivate(t, e)}
                          disabled={acting === t.id}
                          title="Mover a activos"
                          className="p-1.5 rounded-lg text-dojo-muted hover:text-green-400
                                     hover:bg-green-400/10 transition-colors"
                        >
                          {acting === t.id
                            ? <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                            : <ArchiveRestore size={14} />
                          }
                        </button>
                      )}
                      {/* Eliminar del historial — solo sysadmin */}
                      {isSysadmin && (
                        <button
                          onClick={e => handleDelete(t, e)}
                          disabled={acting === t.id}
                          title="Eliminar permanentemente"
                          className="p-1.5 rounded-lg text-dojo-muted hover:text-red-400
                                     hover:bg-red-400/10 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
