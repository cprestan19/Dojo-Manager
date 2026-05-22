"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Trophy, Plus, MapPin, Calendar, Users, CheckCircle, Medal, Trash2, AlertTriangle } from "lucide-react";
import type { TEventSummary } from "@/lib/tournament-events";

export default function TournamentEventsPage() {
  const [events,  setEvents]  = useState<TEventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<TEventSummary | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/tournament-events");
    if (r.ok) setEvents(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(ev: TEventSummary) {
    setDeleting(ev.id);
    const r = await fetch(`/api/tournament-events/${ev.id}`, { method: "DELETE" });
    if (r.ok) setEvents(e => e.filter(x => x.id !== ev.id));
    setDeleting(null);
    setConfirmDel(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
            <Trophy size={28} className="text-dojo-red" /> Asistencia a Torneos
          </h1>
          <p className="text-dojo-muted text-sm mt-1">
            Controla la llegada y resultados de tus alumnos en cada torneo
          </p>
        </div>
        <Link href="/dashboard/tournament-events/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nuevo Torneo
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-4 border-dojo-red border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="card text-center py-16">
          <Trophy size={48} className="text-dojo-muted mx-auto mb-4 opacity-30" />
          <p className="text-dojo-white font-semibold text-lg">Sin torneos registrados</p>
          <p className="text-dojo-muted text-sm mt-1">
            Crea un torneo para controlar la asistencia y resultados de tus alumnos.
          </p>
          <Link href="/dashboard/tournament-events/new" className="btn-primary mt-6 inline-flex items-center gap-2">
            <Plus size={16} /> Crear primer torneo
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {events.map(ev => {
          const date = new Date(ev.date);
          const dateStr = date.toLocaleDateString("es-PA", { weekday:"short", day:"numeric", month:"long", year:"numeric" });
          const pct = ev.totalStudents > 0 ? Math.round((ev.arrivedCount / ev.totalStudents) * 100) : 0;

          return (
            <div key={ev.id} className="card space-y-4">
              {/* Cabecera */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h2 className="font-display font-bold text-dojo-white text-lg leading-tight truncate">
                    {ev.name}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-1 text-dojo-muted text-xs">
                    <Calendar size={11} />
                    <span>{dateStr}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-dojo-muted text-xs mt-0.5">
                    <MapPin size={11} />
                    <span className="truncate">{ev.location}</span>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmDel(ev)}
                  className="text-dojo-muted hover:text-red-400 transition-colors p-1 shrink-0"
                  title="Eliminar torneo"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-dojo-darker rounded-lg p-2">
                  <Users size={14} className="text-dojo-muted mx-auto mb-1" />
                  <p className="text-dojo-white font-bold text-base">{ev.totalStudents}</p>
                  <p className="text-dojo-muted text-xs">Inscritos</p>
                </div>
                <div className="bg-dojo-darker rounded-lg p-2">
                  <CheckCircle size={14} className="text-green-400 mx-auto mb-1" />
                  <p className="text-green-400 font-bold text-base">{ev.arrivedCount}</p>
                  <p className="text-dojo-muted text-xs">Llegaron</p>
                </div>
                <div className="bg-dojo-darker rounded-lg p-2">
                  <Medal size={14} className="text-dojo-gold mx-auto mb-1" />
                  <p className="text-dojo-gold font-bold text-base">{ev.resultsCount}</p>
                  <p className="text-dojo-muted text-xs">Resultados</p>
                </div>
              </div>

              {/* Barra de progreso */}
              <div>
                <div className="flex justify-between text-xs text-dojo-muted mb-1">
                  <span>Asistencia</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 bg-dojo-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: pct === 100 ? "#10B981" : "#C0392B" }}
                  />
                </div>
              </div>

              {/* Acciones */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-dojo-border">
                <Link
                  href={`/dashboard/tournament-events/${ev.id}`}
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg bg-dojo-darker hover:bg-dojo-border transition-colors text-dojo-white"
                >
                  📋 Control
                </Link>
                <Link
                  href={`/dashboard/tournament-events/${ev.id}/scan`}
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-colors text-white"
                  style={{ background: "#C0392B" }}
                >
                  📷 Escanear QR
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal confirmación de borrado */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="card max-w-sm w-full space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-900/30 border border-red-800/50">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-semibold text-sm">Eliminar torneo</p>
                <p className="text-red-300/80 text-xs mt-0.5">
                  Se eliminarán todos los registros de asistencia y resultados de <strong>{confirmDel.name}</strong>.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDel)}
                disabled={deleting === confirmDel.id}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-red-700 hover:bg-red-600 text-white disabled:opacity-50"
              >
                <Trash2 size={15} />
                {deleting === confirmDel.id ? "Eliminando..." : "Eliminar"}
              </button>
              <button onClick={() => setConfirmDel(null)} className="btn-secondary flex-1 justify-center">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
