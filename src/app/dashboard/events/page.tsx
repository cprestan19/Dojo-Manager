"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Calendar, Plus, Edit2, Trash2, X, Save, Image as ImageIcon,
  MapPin, Clock, CalendarCheck, Eye, Smartphone,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface DojoEvent {
  id:          string;
  title:       string;
  description: string | null;
  location:    string | null;
  imageUrl:    string | null;
  startDate:   string;
  endDate:     string;
}

// Forma del objeto que se pasa al preview (puede venir del form o de un evento guardado)
interface PreviewData {
  title:       string;
  description: string;
  location:    string;
  imageUrl:    string;
  startDate:   string; // ISO o datetime-local
  endDate:     string;
}

type Tab = "active" | "past";

/* ── Helpers de formato ──────────────────────────────────────── */
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PA", { day: "2-digit", month: "short", year: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit" });
}
function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  if (s.toDateString() === e.toDateString())
    return s.toLocaleDateString("es-PA", { day: "2-digit", month: "long", year: "numeric" });
  return `${s.toLocaleDateString("es-PA", { day: "2-digit", month: "short" })} — ${e.toLocaleDateString("es-PA", { day: "2-digit", month: "long", year: "numeric" })}`;
}
function toIso(val: string): string {
  if (!val) return new Date().toISOString();
  // Si ya es ISO (tiene Z o +) lo usa directo, si no lo parsea
  return isNaN(Date.parse(val)) ? new Date().toISOString() : new Date(val).toISOString();
}
function toDateTimeLocal(iso: string) {
  const d   = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_FORM = { title: "", description: "", location: "", imageUrl: "", startDate: "", endDate: "" };

/* ── Vista previa del evento (portal view) ───────────────────── */
function EventPreviewCard({ data }: { data: PreviewData }) {
  const start = toIso(data.startDate);
  const end   = toIso(data.endDate);
  return (
    <div className="rounded-xl overflow-hidden bg-dojo-card border border-dojo-border">
      {data.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.imageUrl} alt={data.title} className="w-full object-cover" style={{ maxHeight: "160px" }} />
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

/* ── Modal de vista previa con frame de teléfono ─────────────── */
function PreviewModal({ data, onClose }: { data: PreviewData | null; onClose: () => void }) {
  if (!data) return null;
  return (
    <Modal open={!!data} onClose={onClose} title="Vista previa" size="md">
      <div className="space-y-4">
        {/* Subtítulo */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dojo-border/20 border border-dojo-border/40">
          <Smartphone size={14} className="text-dojo-red shrink-0" />
          <p className="text-xs text-dojo-muted">
            Así verán el evento tus alumnos desde el portal
          </p>
        </div>

        {/* Frame tipo teléfono */}
        <div className="mx-auto" style={{ maxWidth: "340px" }}>
          <div className="rounded-[2rem] border-[3px] border-dojo-border bg-dojo-darker overflow-hidden shadow-xl">

            {/* Barra superior del teléfono */}
            <div className="h-6 bg-dojo-dark flex items-center justify-center">
              <div className="w-16 h-1.5 bg-dojo-border/60 rounded-full" />
            </div>

            {/* Simulación header del portal */}
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

            {/* Simulación tabs del portal */}
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

            {/* Contenido del evento */}
            <div className="bg-dojo-darker p-3 overflow-auto" style={{ height: "420px" }}>
              <p className="text-[9px] font-bold text-dojo-muted uppercase tracking-widest mb-2 flex items-center gap-1">
                <Calendar size={9} /> Próximos eventos
              </p>
              <EventPreviewCard data={data} />
              {/* Card vacía para dar contexto de lista */}
              <div className="mt-2 rounded-xl border border-dojo-border/30 bg-dojo-card/30 h-12 flex items-center justify-center">
                <div className="space-y-1 w-full px-3">
                  <div className="h-2 bg-dojo-border/30 rounded w-3/4" />
                  <div className="h-1.5 bg-dojo-border/20 rounded w-1/2" />
                </div>
              </div>
            </div>

            {/* Barra inferior del teléfono */}
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

  // Vista previa desde la lista de eventos
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

  // Vista previa desde el modal de creación/edición
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

      {/* Tabs */}
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

      {/* List */}
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
            <div key={ev.id} className="card p-0 overflow-hidden">
              <div className="flex gap-0">
                {/* Imagen */}
                {ev.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ev.imageUrl} alt={ev.title}
                    className="w-28 sm:w-40 h-auto object-cover shrink-0 rounded-l-xl"
                    style={{ minHeight: "100px", maxHeight: "160px" }}
                  />
                ) : (
                  <div className="w-28 sm:w-40 shrink-0 bg-dojo-border/40 flex items-center justify-center rounded-l-xl"
                    style={{ minHeight: "100px" }}>
                    <ImageIcon size={28} className="text-dojo-muted opacity-40" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 p-4 flex flex-col justify-between gap-2 min-w-0">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-dojo-white text-base leading-tight">{ev.title}</p>
                      {tab === "past" && (
                        <span className="badge-gold text-xs shrink-0">Finalizado</span>
                      )}
                    </div>
                    {ev.description && (
                      <p className="text-dojo-muted text-sm mt-1 line-clamp-2">{ev.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-dojo-muted">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(ev.startDate)} — {formatDate(ev.endDate)}
                    </span>
                    {ev.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {ev.location}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-center justify-center gap-1 px-3 border-l border-dojo-border/40 shrink-0">
                  <button onClick={() => openPreview(ev)}
                    className="btn-ghost p-2 text-dojo-muted hover:text-dojo-red" title="Vista previa">
                    <Eye size={15} />
                  </button>
                  <button onClick={() => openEdit(ev)}
                    className="btn-ghost p-2 text-dojo-muted hover:text-dojo-white" title="Editar">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => handleDelete(ev.id)} disabled={deleting === ev.id}
                    className="btn-ghost p-2 text-dojo-muted hover:text-red-400" title="Eliminar">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
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
                  <img src={form.imageUrl} alt="" className="w-full h-48 object-cover" />
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
            {/* Vista previa desde el formulario */}
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
    </div>
  );
}
