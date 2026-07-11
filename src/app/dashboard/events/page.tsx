"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Calendar, Plus, Edit2, Trash2, X, Save, Image as ImageIcon,
  MapPin, Clock, CalendarCheck, Eye, Smartphone, Users, CheckCircle2,
  Download, Trophy, RefreshCw,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast, ToastContainer } from "@/components/ui/Toast";

interface DojoEvent {
  id:                string;
  title:             string;
  description:       string | null;
  location:          string | null;
  imageUrl:          string | null;
  startDate:         string;
  endDate:           string;
  tournamentEventId: string | null;
  pendingSyncCount:  number;
}

interface PreviewData {
  title:       string;
  description: string;
  location:    string;
  imageUrl:    string;
  startDate:   string;
  endDate:     string;
}

interface RsvpAttendee {
  rsvpId: string; studentId: string; fullName: string;
  photo: string | null; belt: string | null;
  note: string | null; createdAt: string;
}
interface RsvpPending {
  studentId: string; fullName: string; photo: string | null;
}
interface RsvpData {
  eventId: string; eventTitle: string;
  attending: RsvpAttendee[];
  notAttending: { rsvpId: string; studentId: string; fullName: string; createdAt: string }[];
  pending: RsvpPending[];
  attendingCount: number; notAttendingCount: number; pendingCount: number;
}

type Tab = "active" | "past";

/* ── Helpers ─────────────────────────────────────────────────── */
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "short", year: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PA", { timeZone: "America/Panama", hour: "2-digit", minute: "2-digit", hour12: true });
}
function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const tz = "America/Panama";
  if (s.toLocaleDateString("es-PA", { timeZone: tz }) === e.toLocaleDateString("es-PA", { timeZone: tz }))
    return s.toLocaleDateString("es-PA", { timeZone: tz, day: "2-digit", month: "long", year: "numeric" });
  return `${s.toLocaleDateString("es-PA", { timeZone: tz, day: "2-digit", month: "short", year: "numeric" })} — ${e.toLocaleDateString("es-PA", { timeZone: tz, day: "2-digit", month: "long", year: "numeric" })}`;
}
function toIso(val: string): string {
  if (!val) return new Date().toISOString();
  return isNaN(Date.parse(val)) ? new Date().toISOString() : new Date(val).toISOString();
}
function toDateTimeLocal(iso: string) {
  const d   = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_FORM = { title: "", description: "", location: "", imageUrl: "", startDate: "", endDate: "" };

/* ── Vista previa (portal view) ──────────────────────────────── */
function EventPreviewCard({ data }: { data: PreviewData }) {
  const start = toIso(data.startDate);
  const end   = toIso(data.endDate);
  return (
    <div className="rounded-xl overflow-hidden bg-dojo-card border border-dojo-border">
      {data.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.imageUrl} alt={data.title} className="w-full h-auto block" />
      )}
      <div className="p-3 space-y-2.5">
        <p className="font-display font-bold text-dojo-white text-sm leading-tight">
          {data.title || <span className="text-dojo-muted italic">Sin título</span>}
        </p>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="flex items-center gap-1 text-dojo-muted">
            <Clock size={11} className="text-dojo-red" />
            {formatDateRange(start, end)}
          </span>
          <span className="text-dojo-muted">{formatTime(start)} — {formatTime(end)}</span>
        </div>
        {data.location && (
          <div className="flex items-center gap-1 text-[11px] text-dojo-muted">
            <MapPin size={11} className="text-dojo-red" />
            {data.location}
          </div>
        )}
        {data.description && (
          <p className="text-[11px] text-dojo-muted leading-relaxed border-t border-dojo-border/40 pt-2">
            {data.description}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Modal vista previa (frame teléfono) ─────────────────────── */
function PreviewModal({ data, onClose }: { data: PreviewData | null; onClose: () => void }) {
  if (!data) return null;
  return (
    <Modal open={!!data} onClose={onClose} title="Vista previa" size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dojo-border/20 border border-dojo-border/40">
          <Smartphone size={14} className="text-dojo-red shrink-0" />
          <p className="text-xs text-dojo-muted">
            Así verán el evento tus alumnos desde el portal
          </p>
        </div>

        <div className="mx-auto" style={{ maxWidth: "340px" }}>
          <div className="rounded-[2rem] border-[3px] border-dojo-border bg-dojo-darker overflow-hidden shadow-xl">
            <div className="h-6 bg-dojo-dark flex items-center justify-center">
              <div className="w-16 h-1.5 bg-dojo-border/60 rounded-full" />
            </div>
            <div className="bg-dojo-dark border-b border-dojo-border px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-dojo-border/60" />
                <div className="space-y-0.5">
                  <div className="h-1.5 w-16 bg-dojo-border/60 rounded" />
                  <div className="h-1 w-10 bg-dojo-border/40 rounded" />
                </div>
              </div>
              <div className="h-1.5 w-8 bg-dojo-border/40 rounded" />
            </div>
            <div className="bg-dojo-dark border-b border-dojo-border">
              <div className="flex overflow-x-auto">
                {["Perfil","Pagos","Horarios","Asist.","Videos","Eventos"].map(t => (
                  <span key={t}
                    className={`flex-1 text-center py-2 text-[9px] font-medium whitespace-nowrap px-1 border-b-2 transition-colors ${
                      t === "Eventos"
                        ? "border-dojo-red text-dojo-red"
                        : "border-transparent text-dojo-muted/60"
                    }`}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-dojo-darker p-3 overflow-auto" style={{ height: "420px" }}>
              <p className="text-[9px] font-bold text-dojo-muted uppercase tracking-widest mb-2 flex items-center gap-1">
                <Calendar size={9} /> Próximos eventos
              </p>
              <EventPreviewCard data={data} />
              <div className="mt-2 rounded-xl border border-dojo-border/30 bg-dojo-card/30 h-12 flex items-center justify-center">
                <div className="space-y-1 w-full px-3">
                  <div className="h-2 bg-dojo-border/30 rounded w-3/4" />
                  <div className="h-1.5 bg-dojo-border/20 rounded w-1/2" />
                </div>
              </div>
            </div>
            <div className="h-4 bg-dojo-dark flex items-center justify-center">
              <div className="w-10 h-1 bg-dojo-border/60 rounded-full" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="btn-secondary text-sm">
            <X size={15} /> Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Card de evento con tabs inline ──────────────────────────── */
function EventCard({ ev, isPast, onEdit, onDelete, onPreview, deleting, syncing, onSyncList }: {
  ev:        DojoEvent;
  isPast:    boolean;
  onEdit:    () => void;
  onDelete:  () => void;
  onPreview: () => void;
  deleting:  boolean;
  syncing:   boolean;
  onSyncList: () => void;
}) {
  const [activeTab,   setActiveTab]   = useState<"info" | "attendees">("info");
  const [rsvpData,    setRsvpData]    = useState<RsvpData | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const fetched = useRef(false);

  const [downloading, setDownloading] = useState(false);

  const fetchRsvp = useCallback((silent = false) => {
    if (!silent) setRsvpLoading(true);
    fetch(`/api/events/${ev.id}/rsvp`)
      .then(r => r.ok ? r.json() : null)
      .then((d: RsvpData | null) => {
        if (d) {
          // Ordenar alfabéticamente las tres listas
          d.attending    = [...d.attending].sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
          d.notAttending = [...d.notAttending].sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
          d.pending      = [...d.pending].sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
          setRsvpData(d);
          setLastRefresh(new Date());
        }
      })
      .catch(() => {})
      .finally(() => { if (!silent) setRsvpLoading(false); });
  }, [ev.id]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/events/${ev.id}/rsvp/export`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1]
        ?? `evento-asistencias.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ } finally {
      setDownloading(false);
    }
  }

  function loadAttendees() {
    if (fetched.current) return;
    fetched.current = true;
    fetchRsvp(false);
  }

  // Auto-polling cada 15s mientras el tab de asistencias está activo
  useEffect(() => {
    if (activeTab !== "attendees" || !fetched.current) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchRsvp(true);
    }, 15_000);
    return () => clearInterval(interval);
  }, [activeTab, fetchRsvp]);

  function switchToAttendees() {
    setActiveTab("attendees");
    loadAttendees();
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex flex-col md:flex-row">

        {/* Flyer — mismo ancho proporcional que el portal (max-w-2xl → ~288px en desktop) */}
        <div className="w-full md:w-72 md:shrink-0 md:border-r md:border-dojo-border/40">
          {ev.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ev.imageUrl}
              alt={ev.title}
              className="w-full h-auto block md:h-full md:object-cover md:object-top"
            />
          ) : (
            <div className="w-full h-36 md:h-full bg-dojo-border/20 flex items-center justify-center">
              <ImageIcon size={32} className="text-dojo-muted opacity-30" />
            </div>
          )}
        </div>

        {/* Columna derecha */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* Tabs — arriba */}
          <div className="flex shrink-0 border-b border-dojo-border/40">
            <button
              onClick={() => setActiveTab("info")}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border-b-2 -mb-px ${
                activeTab === "info"
                  ? "border-dojo-red text-dojo-white"
                  : "border-transparent text-dojo-muted hover:text-dojo-white"
              }`}
            >
              <Calendar size={12} /> Detalles
            </button>
            <button
              onClick={switchToAttendees}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border-b-2 -mb-px ${
                activeTab === "attendees"
                  ? "border-dojo-red text-dojo-white"
                  : "border-transparent text-dojo-muted hover:text-dojo-white"
              }`}
            >
              <Users size={12} />
              Asistencias
              {rsvpData && (
                <span className="flex items-center gap-1 text-[10px] font-bold">
                  <span className="px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">{rsvpData.attendingCount}✅</span>
                  {rsvpData.notAttendingCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">{rsvpData.notAttendingCount}🚫</span>
                  )}
                  {rsvpData.pendingCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-dojo-border/40 text-dojo-muted">{rsvpData.pendingCount}⏳</span>
                  )}
                </span>
              )}
            </button>
          </div>

          {/* Contenido del tab */}
          <div className="flex-1">
            {activeTab === "info" ? (
              <div className="p-4 space-y-2.5 h-full flex flex-col">
                <div className="flex items-start justify-between gap-2 flex-1">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <p className="font-semibold text-dojo-white text-base leading-tight flex-1">{ev.title}</p>
                      {isPast && <span className="badge-gold text-xs shrink-0">Finalizado</span>}
                    </div>
                    {ev.description && (
                      <p className="text-dojo-muted text-sm line-clamp-3">{ev.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-dojo-muted">
                      <span className="flex items-center gap-1">
                        <Clock size={12} className="text-dojo-red shrink-0" />
                        {formatDate(ev.startDate)} — {formatDate(ev.endDate)}
                      </span>
                      {ev.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="text-dojo-red shrink-0" /> {ev.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 pt-2 border-t border-dojo-border/40 mt-auto flex-wrap">
                  {ev.tournamentEventId ? (
                    <>
                      <Link href={`/dashboard/tournament-events/${ev.tournamentEventId}`}
                        className="btn-ghost py-1.5 px-2 text-dojo-gold hover:text-dojo-gold flex items-center gap-1.5 text-xs">
                        <Trophy size={13} /> <span className="hidden sm:inline">Ver Lista de Asistencia</span>
                      </Link>
                      {ev.pendingSyncCount > 0 && (
                        <button onClick={onSyncList} disabled={syncing}
                          title={`${ev.pendingSyncCount} cambio(s) de confirmación sin sincronizar`}
                          className="btn-ghost py-1.5 px-2 text-yellow-400 hover:text-yellow-300 flex items-center gap-1.5 text-xs disabled:opacity-40">
                          <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
                          <span className="hidden sm:inline">{syncing ? "Sincronizando..." : `Sincronizar (${ev.pendingSyncCount})`}</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <button onClick={onSyncList} disabled={syncing}
                      className="btn-ghost py-1.5 px-2 text-dojo-muted hover:text-dojo-gold flex items-center gap-1.5 text-xs disabled:opacity-40">
                      <Trophy size={13} /> <span className="hidden sm:inline">{syncing ? "Creando..." : "Crear Lista de Asistencia"}</span>
                    </button>
                  )}
                  <button onClick={onPreview}
                    className="btn-ghost py-1.5 px-2 text-dojo-muted hover:text-dojo-red flex items-center gap-1.5 text-xs">
                    <Eye size={13} /> <span className="hidden sm:inline">Vista previa</span>
                  </button>
                  <button onClick={onEdit}
                    className="btn-ghost py-1.5 px-2 text-dojo-muted hover:text-dojo-white flex items-center gap-1.5 text-xs">
                    <Edit2 size={13} /> <span className="hidden sm:inline">Editar</span>
                  </button>
                  <button onClick={onDelete} disabled={deleting}
                    className="btn-ghost py-1.5 px-2 text-dojo-muted hover:text-red-400 flex items-center gap-1.5 text-xs disabled:opacity-40">
                    <Trash2 size={13} /> <span className="hidden sm:inline">Eliminar</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4 overflow-y-auto max-h-96">
                {/* Indicador de auto-actualización + botón descarga */}
                {lastRefresh && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-dojo-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Actualiza automáticamente · última vez {lastRefresh.toLocaleTimeString("es-PA", { timeZone: "America/Panama", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </div>
                    <button
                      onClick={handleDownload}
                      disabled={downloading}
                      title="Descargar lista en Excel"
                      className="flex items-center gap-1 text-[10px] font-semibold text-green-400 hover:text-green-300 border border-green-900/40 hover:border-green-700/60 bg-green-900/10 hover:bg-green-900/20 rounded px-2 py-1 transition-colors disabled:opacity-50 shrink-0"
                    >
                      <Download size={11} />
                      {downloading ? "Generando..." : "Excel"}
                    </button>
                  </div>
                )}
                {rsvpLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-5 h-5 rounded-full border-2 border-dojo-red border-t-transparent animate-spin" />
                  </div>
                ) : !rsvpData ? (
                  <div className="text-center py-10 space-y-2">
                    <Users size={26} className="mx-auto text-dojo-muted opacity-40" />
                    <p className="text-dojo-muted text-sm">Sin datos de respuestas.</p>
                  </div>
                ) : (
                  <>
                    {/* ── Confirmados ── */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-green-400 flex items-center gap-1.5">
                        <CheckCircle2 size={11} />
                        Confirmados
                        <span className="bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-full text-[10px]">
                          {rsvpData.attendingCount}
                        </span>
                      </p>
                      {rsvpData.attendingCount === 0 ? (
                        <p className="text-xs text-dojo-muted pl-4">Ningún alumno ha confirmado aún.</p>
                      ) : (
                        rsvpData.attending.map((a, i) => (
                          <div key={a.rsvpId} className="flex items-center gap-2.5 bg-dojo-darker border border-green-900/30 rounded-lg px-3 py-2">
                            <span className="text-[10px] text-dojo-muted w-4 shrink-0">{i + 1}.</span>
                            {a.photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a.photo} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-dojo-border flex items-center justify-center text-[11px] font-bold text-dojo-gold shrink-0">
                                {a.fullName[0]?.toUpperCase() ?? "?"}
                              </div>
                            )}
                            <p className="text-dojo-white text-sm font-medium truncate flex-1">{a.fullName}</p>
                            <span className="text-[10px] text-dojo-muted shrink-0">
                              {new Date(a.createdAt).toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "short" })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* ── No asistirá ── */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                        <X size={11} />
                        No asistirá
                        <span className="bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full text-[10px]">
                          {rsvpData.notAttendingCount}
                        </span>
                      </p>
                      {rsvpData.notAttendingCount === 0 ? (
                        <p className="text-xs text-dojo-muted pl-4">Ningún alumno ha declinado.</p>
                      ) : (
                        rsvpData.notAttending.map((a, i) => (
                          <div key={a.rsvpId} className="flex items-center gap-2.5 bg-dojo-darker border border-red-900/30 rounded-lg px-3 py-2">
                            <span className="text-[10px] text-dojo-muted w-4 shrink-0">{i + 1}.</span>
                            <div className="w-7 h-7 rounded-full bg-red-900/20 flex items-center justify-center text-[11px] font-bold text-red-400 shrink-0">
                              {a.fullName[0]?.toUpperCase() ?? "?"}
                            </div>
                            <p className="text-dojo-white text-sm font-medium truncate flex-1">{a.fullName}</p>
                            <span className="text-[10px] text-dojo-muted shrink-0">
                              {new Date(a.createdAt).toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "short" })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* ── Sin respuesta / Pendiente ── */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-yellow-400/80 flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-full border border-yellow-400/60 shrink-0" />
                        Sin respuesta
                        <span className="bg-yellow-500/10 text-yellow-400/80 px-1.5 py-0.5 rounded-full text-[10px]">
                          {rsvpData.pendingCount}
                        </span>
                      </p>
                      {rsvpData.pendingCount === 0 ? (
                        <p className="text-xs text-dojo-muted pl-4">Todos los alumnos respondieron. ✓</p>
                      ) : (
                        rsvpData.pending.map((s, i) => (
                          <div key={s.studentId} className="flex items-center gap-2.5 bg-dojo-darker border border-yellow-900/20 rounded-lg px-3 py-2">
                            <span className="text-[10px] text-dojo-muted w-4 shrink-0">{i + 1}.</span>
                            {s.photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.photo} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-yellow-900/20 flex items-center justify-center text-[11px] font-bold text-yellow-400/70 shrink-0">
                                {s.fullName[0]?.toUpperCase() ?? "?"}
                              </div>
                            )}
                            <p className="text-dojo-white text-sm font-medium truncate flex-1">{s.fullName}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Página principal ────────────────────────────────────────── */
export default function EventsPage() {
  const [tab,       setTab]      = useState<Tab>("active");
  const [events,    setEvents]   = useState<DojoEvent[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [modal,     setModal]    = useState(false);
  const [editing,   setEditing]  = useState<DojoEvent | null>(null);
  const [form,      setForm]     = useState(EMPTY_FORM);
  const [saving,    setSaving]   = useState(false);
  const [deleting,  setDeleting] = useState<string | null>(null);
  const [error,     setError]    = useState("");
  const [uploading, setUploading]= useState(false);
  const [preview,   setPreview]  = useState<PreviewData | null>(null);
  const [syncingList, setSyncingList] = useState<string | null>(null);
  const { toasts, show: showToast, dismiss } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/events?status=${tab}`);
    if (r.ok) setEvents(await r.json());
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setModal(true);
  }

  function openEdit(ev: DojoEvent) {
    setEditing(ev);
    setForm({
      title:       ev.title,
      description: ev.description ?? "",
      location:    ev.location    ?? "",
      imageUrl:    ev.imageUrl    ?? "",
      startDate:   toDateTimeLocal(ev.startDate),
      endDate:     toDateTimeLocal(ev.endDate),
    });
    setError("");
    setModal(true);
  }

  function openPreview(ev: DojoEvent) {
    setPreview({
      title:       ev.title,
      description: ev.description ?? "",
      location:    ev.location    ?? "",
      imageUrl:    ev.imageUrl    ?? "",
      startDate:   ev.startDate,
      endDate:     ev.endDate,
    });
  }

  function openFormPreview() {
    setPreview({
      title:       form.title       || "Sin título",
      description: form.description || "",
      location:    form.location    || "",
      imageUrl:    form.imageUrl    || "",
      startDate:   form.startDate   || new Date().toISOString(),
      endDate:     form.endDate     || new Date().toISOString(),
    });
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file",    file);
      fd.append("type",    "image");
      fd.append("purpose", "event-image");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Error al subir imagen");
      setForm(f => ({ ...f, imageUrl: j.url }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al subir imagen");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError("");
    if (!form.title.trim()) { setError("El título es requerido"); return; }
    if (!form.startDate)    { setError("La fecha de inicio es requerida"); return; }
    if (!form.endDate)      { setError("La fecha de fin es requerida"); return; }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      setError("La fecha de fin debe ser posterior al inicio"); return;
    }
    setSaving(true);
    try {
      const body = {
        title:       form.title.trim(),
        description: form.description.trim() || null,
        location:    form.location.trim()    || null,
        imageUrl:    form.imageUrl           || null,
        startDate:   new Date(form.startDate).toISOString(),
        endDate:     new Date(form.endDate).toISOString(),
      };
      const url    = editing ? `/api/events/${editing.id}` : "/api/events";
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Error al guardar"); return; }
      setModal(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este evento? Esta acción no se puede deshacer.")) return;
    setDeleting(id);
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  }

  async function handleSyncAttendanceList(ev: DojoEvent) {
    setSyncingList(ev.id);
    try {
      const r = await fetch(`/api/events/${ev.id}/attendance-list`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) { showToast(j.error ?? "Error al crear la lista de asistencia", "error"); return; }

      // Refleja el resultado en el estado local — no navegamos, el botón queda
      // deshabilitado (reemplazado por "Ver Lista") hasta que haya nuevos cambios.
      setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, tournamentEventId: j.id, pendingSyncCount: 0 } : e));

      if (j.created) {
        showToast(`Lista de asistencia creada en "Asistencia de Eventos" con ${j.added} alumno(s).`, "success");
      } else if (j.added > 0 || j.removed > 0) {
        const parts = [];
        if (j.added   > 0) parts.push(`${j.added} agregado(s)`);
        if (j.removed > 0) parts.push(`${j.removed} quitado(s)`);
        showToast(`Lista de asistencia sincronizada: ${parts.join(", ")}.`, "success");
      }
    } catch {
      showToast("Error de red al crear la lista de asistencia", "error");
    } finally {
      setSyncingList(null);
    }
  }

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-2">
            <Calendar size={22} className="text-dojo-red" /> Eventos
          </h1>
          <p className="text-dojo-muted text-sm mt-0.5">
            {tab === "active" ? "Eventos activos visibles para los alumnos" : "Historial de eventos pasados"}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} /> Nuevo Evento
        </button>
      </div>

      {/* Tabs principales */}
      <div className="flex gap-1 bg-dojo-dark border border-dojo-border rounded-lg p-1 w-fit">
        {(["active", "past"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              tab === t ? "bg-dojo-nav-active text-white" : "text-dojo-muted hover:text-dojo-white"
            }`}
          >
            {t === "active" ? "Activos" : "Historial"}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-4 border-dojo-red border-t-transparent animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="card text-center py-16 space-y-2">
          <CalendarCheck size={40} className="mx-auto text-dojo-muted opacity-40" />
          <p className="text-dojo-muted">
            {tab === "active" ? "No hay eventos activos." : "No hay eventos en el historial."}
          </p>
          {tab === "active" && (
            <button onClick={openCreate} className="text-dojo-red text-sm hover:underline">
              Crear el primero
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(ev => (
            <EventCard
              key={ev.id}
              ev={ev}
              isPast={tab === "past"}
              onEdit={() => openEdit(ev)}
              onDelete={() => handleDelete(ev.id)}
              onPreview={() => openPreview(ev)}
              deleting={deleting === ev.id}
              syncing={syncingList === ev.id}
              onSyncList={() => handleSyncAttendanceList(ev)}
            />
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Editar Evento" : "Nuevo Evento"} size="lg">
        <div className="space-y-4">
          {/* Imagen */}
          <div>
            <label className="form-label">Imagen del evento</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="relative cursor-pointer rounded-xl overflow-hidden border-2 border-dashed border-dojo-border hover:border-dojo-red transition-colors group"
              style={{ minHeight: "140px" }}
            >
              {form.imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.imageUrl} alt="" className="w-full h-auto block" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white text-sm font-semibold flex items-center gap-2">
                      <ImageIcon size={16} /> Cambiar imagen
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-36 gap-2 text-dojo-muted group-hover:text-dojo-red transition-colors">
                  {uploading
                    ? <div className="w-6 h-6 border-2 border-dojo-red border-t-transparent rounded-full animate-spin" />
                    : <><ImageIcon size={28} /><p className="text-sm">Clic para subir imagen</p></>
                  }
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }} />
            {form.imageUrl && (
              <button onClick={() => setForm(f => ({ ...f, imageUrl: "" }))}
                className="mt-1 text-xs text-dojo-muted hover:text-red-400 flex items-center gap-1">
                <X size={11} /> Quitar imagen
              </button>
            )}
          </div>

          {/* Título */}
          <div>
            <label className="form-label">Nombre del evento *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="form-input" placeholder="Ej. Torneo de Primavera 2026" />
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Inicio del evento *</label>
              <input type="datetime-local" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="form-input" />
            </div>
            <div>
              <label className="form-label">Fin del evento *</label>
              <input type="datetime-local" value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="form-input" />
            </div>
          </div>

          {/* Lugar */}
          <div>
            <label className="form-label">Lugar</label>
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              className="form-input" placeholder="Ej. Gimnasio Central, Panamá" />
          </div>

          {/* Descripción */}
          <div>
            <label className="form-label">Descripción</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="form-input min-h-[90px] resize-y" rows={3}
              placeholder="Detalles del evento, quiénes pueden participar, requisitos..." />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
            <button type="button" onClick={openFormPreview}
              className="flex items-center gap-2 text-sm text-dojo-muted hover:text-dojo-red transition-colors">
              <Eye size={15} /> Vista previa
            </button>
            <div className="flex gap-3">
              <button onClick={() => setModal(false)} className="btn-secondary">
                <X size={16} /> Cancelar
              </button>
              <button onClick={save} disabled={saving || uploading} className="btn-primary">
                <Save size={16} /> {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear evento"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal vista previa */}
      <PreviewModal data={preview} onClose={() => setPreview(null)} />

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
