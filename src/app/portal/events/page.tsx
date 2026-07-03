"use client";
import { useState, useEffect, useCallback } from "react";
import { Calendar, MapPin, Clock, CalendarCheck, History, CheckCircle2, X, Users, Loader2 } from "lucide-react";

interface FamilyMemberRsvp {
  studentId: string;
  fullName:  string;
  isMe:      boolean;
  status:    "attending" | "not_attending" | null;
}

interface DojoEvent {
  id:             string;
  title:          string;
  description:    string | null;
  location:       string | null;
  imageUrl:       string | null;
  startDate:      string;
  endDate:        string;
  memberRsvps:    FamilyMemberRsvp[];
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
  return new Date(iso).toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Panama" });
}

// ── Fila de RSVP por miembro de familia ──────────────────────────────────────

function MemberRsvpRow({ member, loading, onRsvp }: {
  member:  FamilyMemberRsvp;
  loading: string | null;
  onRsvp:  (status: "attending" | "not_attending") => void;
}) {
  const busyAttend    = loading === `${member.studentId}:attending`;
  const busyDecline   = loading === `${member.studentId}:not_attending`;
  const busy          = busyAttend || busyDecline;

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        {member.status === "attending"     && <CheckCircle2 size={14} className="text-green-400 shrink-0" />}
        {member.status === "not_attending" && <X            size={14} className="text-red-400   shrink-0" />}
        {member.status === null            && <div className="w-3.5 h-3.5 rounded-full border border-dojo-muted/50 shrink-0" />}
        <span className="text-sm text-dojo-white truncate">
          {member.fullName}
          {member.isMe && <span className="text-dojo-muted text-xs ml-1">(yo)</span>}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {member.status !== "attending" && (
          <button
            type="button"
            onClick={() => onRsvp("attending")}
            disabled={busy}
            className="text-xs px-2.5 py-1 rounded-lg bg-green-900/30 text-green-400 hover:bg-green-900/50 transition-colors disabled:opacity-40 font-semibold"
          >
            {busyAttend ? <Loader2 size={10} className="animate-spin inline" /> : "Participaré"}
          </button>
        )}
        {member.status === "attending" && (
          <span className="text-xs text-green-300 font-semibold">Confirmado</span>
        )}
        {member.status !== "not_attending" && (
          <button
            type="button"
            onClick={() => onRsvp("not_attending")}
            disabled={busy}
            className="text-xs px-2.5 py-1 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors disabled:opacity-40 font-semibold"
          >
            {busyDecline ? <Loader2 size={10} className="animate-spin inline" /> : "No iré"}
          </button>
        )}
        {member.status === "not_attending" && (
          <span className="text-xs text-red-400 font-semibold">No irá</span>
        )}
        {(member.status === "attending" || member.status === "not_attending") && (
          <button
            type="button"
            onClick={() => onRsvp(member.status === "attending" ? "not_attending" : "attending")}
            disabled={busy}
            className="text-[11px] text-dojo-muted hover:text-dojo-white transition-colors underline underline-offset-2 disabled:opacity-40"
          >
            {busy ? <Loader2 size={9} className="animate-spin inline" /> : "Cambiar"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Banner RSVP principal ────────────────────────────────────────────────────

function RsvpBanner({ event, onUpdate }: {
  event:    DojoEvent;
  onUpdate: (eventId: string, studentId: string, newStatus: "attending" | "not_attending", count: number) => void;
}) {
  const [loading, setLoading] = useState<string | null>(null); // `${studentId}:${status}`

  async function rsvp(studentId: string, newStatus: "attending" | "not_attending") {
    setLoading(`${studentId}:${newStatus}`);
    try {
      const res = await fetch("/api/portal/events", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ eventId: event.id, status: newStatus, studentId }),
      });
      if (res.ok) {
        const data = await res.json() as { attendingCount: number };
        onUpdate(event.id, studentId, newStatus, data.attendingCount);
      }
    } catch { /* ignore */ }
    finally { setLoading(null); }
  }

  const isFamily = event.memberRsvps.length > 1;

  // ── Vista familia: una fila por miembro ─────────────────────────────────────
  if (isFamily) {
    return (
      <div className="border-b border-dojo-border">
        <div className="px-4 pt-3 pb-1.5 flex items-center gap-1.5">
          <Users size={12} className="text-dojo-muted" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-dojo-muted">Familia</span>
        </div>
        <div className="divide-y divide-dojo-border/40 pb-1">
          {event.memberRsvps.map(m => (
            <MemberRsvpRow
              key={m.studentId}
              member={m}
              loading={loading}
              onRsvp={(status) => void rsvp(m.studentId, status)}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Vista individual (no familia): 3 estados ─────────────────────────────────
  const member  = event.memberRsvps[0];
  if (!member) return null;
  const myStatus = member.status;

  if (myStatus === "attending") {
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
          onClick={() => void rsvp(member.studentId, "not_attending")}
          disabled={loading !== null}
          className="text-[11px] text-green-400/60 hover:text-red-400 transition-colors underline underline-offset-2 shrink-0 disabled:opacity-40"
        >
          {loading ? <Loader2 size={12} className="animate-spin inline" /> : "No asistiré"}
        </button>
      </div>
    );
  }

  if (myStatus === "not_attending") {
    return (
      <div className="border-b border-red-500/40" style={{ background: "rgba(220,38,38,0.15)" }}>
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(220,38,38,0.25)" }}>
              <X size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-300">No participarás en este evento</p>
              <p className="text-[11px] text-red-400/60">Indicaste que no asistirás</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void rsvp(member.studentId, "attending")}
            disabled={loading !== null}
            className="text-[11px] font-semibold text-red-400/70 hover:text-green-400 transition-colors underline underline-offset-2 shrink-0 disabled:opacity-40"
          >
            {loading ? <Loader2 size={12} className="animate-spin inline" /> : "Cambiar"}
          </button>
        </div>
      </div>
    );
  }

  // Sin respuesta — Pendiente
  return (
    <div className="border-b border-dojo-border">
      {/* Label pendiente */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-yellow-400/60 animate-pulse shrink-0" />
        <span className="text-xs font-semibold text-yellow-400/80">⏳ Pendiente de respuesta</span>
      </div>
      {/* Botones de acción */}
      <div className="flex">
        <button
          type="button"
          onClick={() => void rsvp(member.studentId, "attending")}
          disabled={loading !== null}
          className="relative flex-1 flex items-center justify-center gap-2 px-3 py-3.5 bg-gradient-to-r from-red-600 via-dojo-red to-red-700 hover:from-red-500 hover:via-red-600 hover:to-red-700 active:scale-[0.99] transition-all disabled:opacity-60 group overflow-hidden"
        >
          <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          {loading === `${member.studentId}:attending`
            ? <Loader2 size={16} className="animate-spin text-white" />
            : <CalendarCheck size={16} className="text-white group-hover:scale-110 transition-transform" />
          }
          <div className="text-left">
            <p className="text-sm font-black text-white tracking-wider leading-tight drop-shadow">PARTICIPARÉ</p>
            {event.attendingCount > 0 && (
              <p className="text-[10px] text-red-200/70 flex items-center gap-0.5">
                <Users size={9} className="inline" /> {event.attendingCount} confirmado{event.attendingCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </button>

        <div className="w-px bg-dojo-border shrink-0" />

        <button
          type="button"
          onClick={() => void rsvp(member.studentId, "not_attending")}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-3.5 bg-dojo-dark hover:bg-dojo-border/40 active:scale-[0.99] transition-all disabled:opacity-60"
        >
          {loading === `${member.studentId}:not_attending`
            ? <Loader2 size={16} className="animate-spin text-dojo-muted" />
            : <X size={16} className="text-dojo-muted" />
          }
          <span className="text-sm font-semibold text-dojo-muted">No participaré</span>
        </button>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function PortalEventsPage() {
  const [tab,     setTab]    = useState<Tab>("active");
  const [events,  setEvents] = useState<DojoEvent[]>([]);
  const [loading, setLoading]= useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/portal/events?status=${tab}`);
      if (r.ok) setEvents(await r.json());
    } catch { /* error de red — el spinner se detiene */ }
    finally   { setLoading(false); }
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  function handleRsvpUpdate(eventId: string, studentId: string, newStatus: "attending" | "not_attending", count: number) {
    setEvents(prev => prev.map(ev =>
      ev.id !== eventId ? ev : {
        ...ev,
        attendingCount: count,
        memberRsvps: ev.memberRsvps.map(m =>
          m.studentId === studentId ? { ...m, status: newStatus } : m,
        ),
      },
    ));
  }

  const isPast = tab === "past";

  return (
    <div className="space-y-5">

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

              {/* Banner RSVP */}
              {!isPast && (
                <RsvpBanner event={ev} onUpdate={handleRsvpUpdate} />
              )}

              {ev.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ev.imageUrl} alt={ev.title} className="w-full h-auto block" />
              )}

              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <h2 className="font-display font-bold text-dojo-white text-lg leading-tight">{ev.title}</h2>
                  {isPast && <span className="badge-yellow text-xs shrink-0">Finalizado</span>}
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="flex items-center gap-1.5 text-dojo-muted">
                    <Clock size={14} className="text-dojo-red shrink-0" />
                    {formatDateRange(ev.startDate, ev.endDate)}
                  </span>
                  <span className="flex items-center gap-1 text-dojo-muted text-xs">
                    {formatTime(ev.startDate)} — {formatTime(ev.endDate)}
                  </span>
                </div>

                {ev.location && (
                  <div className="flex items-center gap-1.5 text-sm text-dojo-muted">
                    <MapPin size={14} className="text-dojo-red shrink-0" />
                    {ev.location}
                  </div>
                )}

                {ev.description && (
                  <p className="text-sm text-dojo-muted leading-relaxed border-t border-dojo-border/40 pt-3">
                    {ev.description}
                  </p>
                )}

                {/* Historial: respuesta(s) del alumno / familia */}
                {isPast && (
                  <div className="pt-2 border-t border-dojo-border/40 space-y-1">
                    {ev.memberRsvps.length === 1 ? (
                      ev.memberRsvps[0].status === "attending" ? (
                        <div className="flex items-center gap-1.5 text-xs text-green-400/70">
                          <CheckCircle2 size={11} /> Confirmaste tu participación
                        </div>
                      ) : ev.memberRsvps[0].status === "not_attending" ? (
                        <div className="flex items-center gap-1.5 text-xs text-red-400/70">
                          <X size={11} /> Indicaste que no participarías
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-yellow-400/60">
                          <div className="w-2.5 h-2.5 rounded-full border border-yellow-400/40 shrink-0" />
                          Sin respuesta
                        </div>
                      )
                    ) : (
                      ev.memberRsvps.map(m => (
                        <div key={m.studentId} className={`flex items-center gap-1.5 text-xs ${
                          m.status === "attending"     ? "text-green-400/70"
                          : m.status === "not_attending" ? "text-red-400/70"
                          :                               "text-yellow-400/50"
                        }`}>
                          {m.status === "attending"
                            ? <CheckCircle2 size={11} />
                            : m.status === "not_attending"
                            ? <X size={11} />
                            : <div className="w-2.5 h-2.5 rounded-full border border-yellow-400/40 shrink-0" />
                          }
                          {m.fullName}{m.isMe ? " (yo)" : ""}{m.status === null ? " — Sin respuesta" : ""}
                        </div>
                      ))
                    )}
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
