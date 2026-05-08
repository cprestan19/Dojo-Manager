"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Video, Plus, Edit2, Trash2, Save, X, Upload, Loader2, PlayCircle } from "lucide-react";
import { BeltBadge } from "@/components/ui/BeltBadge";
import { Modal } from "@/components/ui/Modal";
import { BELT_COLORS } from "@/lib/utils";

interface BeltVideo {
  id: string; beltColor: string; title: string;
  description: string | null; videoUrl: string; publicId: string;
  order: number; active: boolean;
}

const empty = (): Partial<BeltVideo> => ({
  title: "", beltColor: "blanca", description: "", order: 0,
});

export default function VideosSettingsPage() {
  const [videos,   setVideos]  = useState<BeltVideo[]>([]);
  const [loading,  setLoading] = useState(true);
  const [modal,    setModal]   = useState(false);
  const [editing,  setEditing] = useState<Partial<BeltVideo>>(empty());
  const [saving,   setSaving]  = useState(false);
  const [deleting, setDel]     = useState<string | null>(null);
  const [preview,  setPreview] = useState<BeltVideo | null>(null);

  // Upload state
  const [uploading,   setUploading]  = useState(false);
  const [uploadError, setUploadErr]  = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/belt-videos");
    if (r.ok) setVideos(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  function openCreate() { setEditing(empty()); setUploadErr(""); setModal(true); }
  function openEdit(v: BeltVideo) { setEditing({ ...v }); setUploadErr(""); setModal(true); }

  async function handleVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "video");
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al subir video");
      setEditing(p => ({ ...p, videoUrl: data.url, publicId: data.publicId }));
    } catch (err: unknown) {
      setUploadErr(err instanceof Error ? err.message : "Error al subir video");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!editing.videoUrl) { setUploadErr("Debes subir un video primero"); return; }
    setSaving(true);
    const isEdit = Boolean(editing.id);
    const url    = isEdit ? `/api/belt-videos/${editing.id}` : "/api/belt-videos";
    const method = isEdit ? "PUT" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editing,
        description: editing.description || null,
      }),
    });
    setSaving(false);
    setModal(false);
    fetch_();
  }

  async function deleteVideo(v: BeltVideo) {
    if (!confirm(`¿Eliminar "${v.title}"? Esta acción no se puede deshacer.`)) return;
    setDel(v.id);
    await fetch(`/api/belt-videos/${v.id}`, { method: "DELETE" });
    setDel(null);
    fetch_();
  }

  const grouped = BELT_COLORS.reduce<Record<string, BeltVideo[]>>((acc, b) => {
    acc[b.value] = videos.filter(v => v.beltColor === b.value);
    return acc;
  }, {});

  const totalActive   = videos.filter(v => v.active).length;
  const totalInactive = videos.filter(v => !v.active).length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
            <Video size={24} className="text-dojo-red" /> Videos por Cinta
          </h1>
          <p className="text-dojo-muted text-sm mt-1">
            {videos.length} video(s) · {totalActive} activos · {totalInactive} inactivos
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} /> Nuevo Video
        </button>
      </div>

      {loading && <div className="text-center py-20 text-dojo-muted">Cargando...</div>}

      {!loading && BELT_COLORS.map(belt => {
        const list = grouped[belt.value] ?? [];
        if (list.length === 0) return null;
        return (
          <div key={belt.value} className="card p-0 overflow-hidden">
            <div
              className="flex items-center gap-3 px-5 py-3 border-b border-dojo-border"
              style={{ backgroundColor: belt.hex + "15" }}
            >
              <span className="w-3 h-3 rounded-full border border-white/30" style={{ backgroundColor: belt.hex }} />
              <p className="font-semibold text-sm" style={{ color: belt.hex === "#FFFFFF" ? "#ccc" : belt.hex }}>
                Cinta {belt.label}
              </p>
              <span className="text-xs text-dojo-muted ml-auto">{list.length} video(s)</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {list.map(v => (
                  <tr key={v.id} className="border-b border-dojo-border/40 hover:bg-dojo-border/10 last:border-0">
                    <td className="px-5 py-3 w-10 text-dojo-muted text-center text-xs">{v.order}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-dojo-white">{v.title}</p>
                      {v.description && (
                        <p className="text-xs text-dojo-muted mt-0.5">{v.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3"><BeltBadge beltColor={v.beltColor} /></td>
                    <td className="px-4 py-3">
                      <span className={v.active ? "badge-green" : "badge-red"}>
                        {v.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setPreview(v)}
                          className="btn-ghost p-1.5 text-dojo-muted hover:text-dojo-gold"
                          title="Vista previa"
                        >
                          <PlayCircle size={15} />
                        </button>
                        <button
                          onClick={() => openEdit(v)}
                          className="btn-ghost p-1.5 text-dojo-muted hover:text-dojo-white"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => deleteVideo(v)}
                          disabled={deleting === v.id}
                          className="btn-ghost p-1.5 text-dojo-muted hover:text-red-400"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {!loading && videos.length === 0 && (
        <div className="text-center py-16 text-dojo-muted">
          <Video size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-semibold">No hay videos registrados.</p>
          <p className="text-sm mt-1">Crea el primer video usando el botón "Nuevo Video".</p>
        </div>
      )}

      {/* Modal crear / editar */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? "Editar Video" : "Nuevo Video"} size="lg">
        <div className="space-y-4">
          {/* Título */}
          <div>
            <label className="form-label">Título *</label>
            <input
              value={editing.title ?? ""}
              onChange={e => setEditing(p => ({ ...p, title: e.target.value }))}
              className="form-input"
              placeholder="Ej. Heian Shodan — Explicación completa"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Cinta */}
            <div>
              <label className="form-label">Cinta Requerida *</label>
              <select
                value={editing.beltColor ?? "blanca"}
                onChange={e => setEditing(p => ({ ...p, beltColor: e.target.value }))}
                className="form-input"
              >
                {BELT_COLORS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>

            {/* Orden */}
            <div>
              <label className="form-label">Orden</label>
              <input
                type="number" min={0}
                value={editing.order ?? 0}
                onChange={e => setEditing(p => ({ ...p, order: Number(e.target.value) }))}
                className="form-input"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="form-label">Descripción</label>
            <textarea
              value={editing.description ?? ""}
              onChange={e => setEditing(p => ({ ...p, description: e.target.value }))}
              className="form-input min-h-[70px] resize-none"
              placeholder="Descripción opcional del video..."
            />
          </div>

          {/* Upload video */}
          <div>
            <label className="form-label">Archivo de Video *</label>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="btn-secondary flex items-center gap-2"
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploading ? "Subiendo..." : editing.videoUrl ? "Reemplazar video" : "Seleccionar video"}
                </button>
                {editing.videoUrl && !uploading && (
                  <span className="text-xs text-green-400 flex items-center gap-1">
                    <PlayCircle size={13} /> Video listo
                  </span>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={handleVideoFile}
              />
              <p className="text-xs text-dojo-muted">MP4, WebM o MOV · máx. 200 MB</p>
              {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}

              {/* Preview del video actual */}
              {editing.videoUrl && !uploading && (
                <video
                  src={editing.videoUrl}
                  controls
                  className="w-full rounded-lg mt-2 max-h-48 bg-black"
                />
              )}
            </div>
          </div>

          {/* Activo (solo en edición) */}
          {editing.id && (
            <div className="flex items-center gap-3 p-3 bg-dojo-dark rounded-lg border border-dojo-border">
              <input
                type="checkbox" id="active" checked={editing.active ?? true}
                onChange={e => setEditing(p => ({ ...p, active: e.target.checked }))}
                className="w-4 h-4 accent-dojo-red"
              />
              <label htmlFor="active" className="text-sm text-dojo-white cursor-pointer select-none">
                Video activo (visible para alumnos con esta cinta)
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">
              <X size={16} /> Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || uploading || !editing.title || !editing.videoUrl}
              className="btn-primary"
            >
              <Save size={16} /> {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal vista previa */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ""} size="lg">
        {preview && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BeltBadge beltColor={preview.beltColor} />
              {preview.description && <p className="text-sm text-dojo-muted">{preview.description}</p>}
            </div>
            <video
              src={preview.videoUrl}
              controls
              autoPlay
              className="w-full rounded-lg bg-black"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
