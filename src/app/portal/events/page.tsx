"use client";
import { useState, useEffect, useCallback } from "react";
import { Calendar, MapPin, Clock, CalendarCheck, History } from "lucide-react";

interface DojoEvent {
  id:          string;
  title:       string;
  description: string | null;
  location:    string | null;
  imageUrl:    string | null;
  startDate:   string;
  endDate:     string;
}

type Tab = "active" | "past";

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long", year: "numeric" };
  if (s.toDateString() === e.toDateString()) {
    return new Date(s).toLocaleDateString("es-PA", opts);
  }
  return `${s.toLocaleDateString("es-PA", { day: "2-digit", month: "short" })} — ${e.toLocaleDateString("es-PA", opts)}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit" });
}

export default function PortalEventsPage() {
  const [tab,     setTab]    = useState<Tab>("active");
  const [events,  setEvents] = useState<DojoEvent[]>([]);
  const [loading, setLoading]= useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/portal/events?status=${tab}`);
    if (r.ok) setEvents(await r.json());
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-2xl mx-auto space-y-5 px-4 py-5">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Calendar size={22} className="text-dojo-red shrink-0" />
        <div>
          <h1 className="font-display text-xl font-bold text-dojo-white">Eventos</h1>
          <p className="text-dojo-muted text-xs">Eventos de tu dojo</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dojo-dark border border-dojo-border rounded-lg p-1">
        <button onClick={() => setTab("active")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-colors ${
            tab === "active" ? "bg-dojo-red text-white" : "text-dojo-muted"
          }`}
        >
          <Calendar size={13} /> Próximos
        </button>
        <button onClick={() => setTab("past")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-colors ${
            tab === "past" ? "bg-dojo-red text-white" : "text-dojo-muted"
          }`}
        >
          <History size={13} /> Historial
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-[3px] border-dojo-red border-t-transparent animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="card text-center py-14 space-y-2">
          <CalendarCheck size={36} className="mx-auto text-dojo-muted opacity-40" />
          <p className="text-dojo-muted text-sm">
            {tab === "active" ? "No hay eventos próximos." : "No hay eventos pasados."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(ev => (
            <div key={ev.id} className="card p-0 overflow-hidden">
              {/* Imagen */}
              {ev.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ev.imageUrl}
                  alt={ev.title}
                  className="w-full h-auto block"
                />
              )}

              <div className="p-4 space-y-3">
                {/* Título + badge */}
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display font-bold text-dojo-white text-lg leading-tight">{ev.title}</h2>
                  {tab === "past" && (
                    <span className="badge-yellow text-xs shrink-0">Finalizado</span>
                  )}
                </div>

                {/* Fecha y hora */}
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="flex items-center gap-1.5 text-dojo-muted">
                    <Clock size={14} className="text-dojo-red shrink-0" />
                    <span>{formatDateRange(ev.startDate, ev.endDate)}</span>
                  </span>
                  <span className="flex items-center gap-1 text-dojo-muted text-xs">
                    {formatTime(ev.startDate)} — {formatTime(ev.endDate)}
                  </span>
                </div>

                {/* Lugar */}
                {ev.location && (
                  <div className="flex items-center gap-1.5 text-sm text-dojo-muted">
                    <MapPin size={14} className="text-dojo-red shrink-0" />
                    <span>{ev.location}</span>
                  </div>
                )}

                {/* Descripción */}
                {ev.description && (
                  <p className="text-sm text-dojo-muted leading-relaxed border-t border-dojo-border/40 pt-3">
                    {ev.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
