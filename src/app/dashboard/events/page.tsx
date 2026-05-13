"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Calendar, Plus, Edit2, Trash2, X, Save, Image as ImageIcon,
  MapPin, Clock, ChevronRight, CalendarCheck,
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

type Tab = "active" | "past";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PA", { day: "2-digit", month: "short", year: "numeric" });
}
function toDateTimeLocal(iso: string) {
  const d   = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_FORM = { title: "", description: "", location: "", imageUrl: "", startDate: "", endDate: "" };

export default function EventsPage() {
  const [tab,      setTab]     = useState<Tab>("active");
  const [events,   setEvents]  = useState<DojoEvent[]>([]);
  const [loading,  setLoading] = useState(true);
  const [modal,    setModal]   = useState(false);
  const [editing,  setEditing] = useState<DojoEvent | null>(null);
  const [form,     setForm]    = useState(EMPTY_FORM);
  const [saving,   setSaving]  = useState(false);
  const [deleting, setDeleting]= useState<string | null>(null);
  const [error,    setError]   = useState("");
  const [uploading,setUploading]= useState(false);
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
                    src={ev.imageUrl}
                    alt={ev.title}
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
                  <button onClick={() => openEdit(ev)} className="btn-ghost p-2 text-dojo-muted hover:text-dojo-white" title="Editar">
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

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setModal(false)} className="btn-secondary">
              <X size={16} /> Cancelar
            </button>
            <button onClick={save} disabled={saving || uploading} className="btn-primary">
              <Save size={16} /> {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear evento"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
