"use client";
import { useState, useEffect, useCallback } from "react";
import { Calendar, MapPin, Clock, CalendarCheck, History, CheckCircle2, X, Users, Loader2 } from "lucide-react";

interface DojoEvent {
  id:             string;
  title:          string;
  description:    string | null;
  location:       string | null;
  imageUrl:       string | null;
  startDate:      string;
  endDate:        string;
  myRsvp:         "attending" | "not_attending" | null;
  attendingCount: number;
}

type Tab = "active" | "past";

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const TZ = "America/Panama";
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long", year: "numeric", timeZone: TZ };
  if (s.toLocaleDateString("es-PA", { timeZone: TZ }) === e.toLocaleDateString("es-PA", { timeZone: TZ }))
    return new Date(s).toLocaleDateString("es-PA", opts);
  return `${s.toLocaleDateString("es-PA", { day: "2-digit", month: "short", timeZone: TZ })} — ${e.toLocaleDateString("es-PA", opts)}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit", timeZone: "America/Panama" });
}

// ── RSVP Banner — top of card, full-width, eye-catching ─────────────────────

function RsvpBanner({ event, onUpdate }: {
  event:    DojoEvent;
  onUpdate: (eventId: string, newStatus: "attending" | "not_attending", count: number) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const newStatus: "attending" | "not_attending" =
      event.myRsvp === "attending" ? "not_attending" : "attending";
    setLoading(true);
    try {
      const res = await fetch("/api/portal/events", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ eventId: event.id, status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json() as { attendingCount: number };
        onUpdate(event.id, newStatus, data.attendingCount);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  const isAttending = event.myRsvp === "attending";

  if (isAttending) {
    return (
      <div className="bg-green-600/20 border-b border-green-600/30 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-green-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-green-300">¡Participarás en este evento!</p>
            {event.attendingCount > 0 && (
              <p className="text-[11px] text-green-400/70">
                {event.attendingCount} confirmado{event.attendingCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={loading}
          className="text-[11px] text-green-400/60 hover:text-red-400 transition-colors underline underline-offset-2 shrink-0 disabled:opacity-40"
        >
          {loading ? <Loader2 size={12} className="animate-spin inline" /> : "Cancelar"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={loading}
      className="relative w-full flex items-center justify-center gap-3 px-4 py-5 bg-gradient-to-r from-red-600 via-dojo-red to-red-700 hover:from-red-500 hover:via-red-600 hover:to-red-700 active:scale-[0.99] transition-all disabled:opacity-60 group overflow-hidden"
    >
      {/* shimmer sweep */}
      <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {loading ? (
        <Loader2 size={22} className="animate-spin text-white" />
      ) : (
        <CalendarCheck size={22} className="text-white drop-shadow group-hover:scale-110 transition-transform" />
      )}
      <div className="text-left">
        <p className="text-lg font-black text-white tracking-widest leading-tight drop-shadow">
          {loading ? "Procesando…" : "¡QUIERO PARTICIPAR!"}
        </p>
        {event.attendingCount > 0 && (
          <p className="text-[11px] text-red-200/80 flex items-center gap-1">
            <Users size={10} className="inline" />
            {event.attendingCount} ya confirmado{event.attendingCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

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

  useEffect(() => { void load(); }, [load]);

  function handleRsvpUpdate(eventId: string, newStatus: "attending" | "not_attending", count: number) {
    setEvents(prev => prev.map(ev =>
      ev.id === eventId
        ? { ...ev, myRsvp: newStatus, attendingCount: count }
        : ev,
    ));
  }

  const isPast = tab === "past";

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

              {/* Banner RSVP — arriba de todo, llama la atención */}
              {!isPast && (
                <RsvpBanner event={ev} onUpdate={handleRsvpUpdate} />
              )}

              {ev.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ev.imageUrl} alt={ev.title} className="w-full h-auto block" />
              )}

              <div className="p-4 space-y-3">
                {/* Título + badge estado */}
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <h2 className="font-display font-bold text-dojo-white text-lg leading-tight">{ev.title}</h2>
                  <div className="flex items-center gap-2 shrink-0">
                    {isPast && (
                      <span className="badge-yellow text-xs shrink-0">Finalizado</span>
                    )}
                  </div>
                </div>

                {/* Fecha */}
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="flex items-center gap-1.5 text-dojo-muted">
                    <Clock size={14} className="text-dojo-red shrink-0" />
                    {formatDateRange(ev.startDate, ev.endDate)}
                  </span>
                  <span className="flex items-center gap-1 text-dojo-muted text-xs">
                    {formatTime(ev.startDate)} — {formatTime(ev.endDate)}
                  </span>
                </div>

                {/* Lugar */}
                {ev.location && (
                  <div className="flex items-center gap-1.5 text-sm text-dojo-muted">
                    <MapPin size={14} className="text-dojo-red shrink-0" />
                    {ev.location}
                  </div>
                )}

                {/* Descripción */}
                {ev.description && (
                  <p className="text-sm text-dojo-muted leading-relaxed border-t border-dojo-border/40 pt-3">
                    {ev.description}
                  </p>
                )}

                {/* Historial: mostrar si el alumno había confirmado */}
                {isPast && ev.myRsvp === "attending" && (
                  <div className="flex items-center gap-1.5 text-xs text-green-400/70 pt-2 border-t border-dojo-border/40">
                    <CheckCircle2 size={11} /> Participaste en este evento
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
