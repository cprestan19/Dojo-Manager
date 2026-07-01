"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Plus, Trash2, Save, Upload } from "lucide-react";

interface CertElement {
  id:         string;
  type:       "studentName" | "belt" | "date" | "instructor" | "customText";
  label:      string;
  xPct:       number;
  yPct:       number;
  fontSize:   number;
  fontFamily: string;
  color:      string;
  fontWeight: "normal" | "bold";
  fontStyle:  "normal" | "italic";
  textAlign:  "left" | "center" | "right";
  rotation:   number;
}

interface Template {
  id:           string;
  name:         string;
  imageUrl:     string;
  imagePublicId: string;
  canvasWidth:  number;
  canvasHeight: number;
  elements:     CertElement[];
  active:       boolean;
}

const ELEMENT_TYPES = [
  { value: "studentName", label: "Nombre del alumno"  },
  { value: "belt",        label: "Cinta obtenida"     },
  { value: "date",        label: "Fecha de emisión"   },
  { value: "instructor",  label: "Instructor"         },
  { value: "customText",  label: "Texto libre"        },
] as const;

function genId() { return Math.random().toString(36).slice(2); }

function defaultElement(): CertElement {
  return {
    id:         genId(),
    type:       "studentName",
    label:      "Nombre del alumno",
    xPct:       50,
    yPct:       50,
    fontSize:   28,
    fontFamily: "sans-serif",
    color:      "#1A1A1A",
    fontWeight: "normal",
    fontStyle:  "normal",
    textAlign:  "center",
    rotation:   0,
  };
}

export default function CertificadosSettingsPage() {
  const [templates,   setTemplates]   = useState<Template[]>([]);
  const [selected,    setSelected]    = useState<Template | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState("");
  const [activeEl,    setActiveEl]    = useState<string | null>(null);
  const [dragging,    setDragging]    = useState<string | null>(null);
  const [dragOffset,  setDragOffset]  = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/certificate-templates");
    if (res.ok) setTemplates(await res.json() as Template[]);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const elements: CertElement[] = selected?.elements ?? [];

  function setElements(els: CertElement[]) {
    if (!selected) return;
    setSelected({ ...selected, elements: els });
  }

  function updateElement(id: string, patch: Partial<CertElement>) {
    setElements(elements.map(e => e.id === id ? { ...e, ...patch } : e));
  }

  function removeElement(id: string) {
    setElements(elements.filter(e => e.id !== id));
    if (activeEl === id) setActiveEl(null);
  }

  function addElement() {
    const el = defaultElement();
    setElements([...elements, el]);
    setActiveEl(el.id);
  }

  // Dragging
  function onMouseDown(e: React.MouseEvent, elId: string) {
    e.stopPropagation();
    setActiveEl(elId);
    setDragging(elId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const el = elements.find(x => x.id === elId);
    if (!el) return;
    const elXpx = (el.xPct / 100) * rect.width;
    const elYpx = (el.yPct / 100) * rect.height;
    setDragOffset({ x: e.clientX - rect.left - elXpx, y: e.clientY - rect.top - elYpx });
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xPct = Math.min(100, Math.max(0, ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100));
    const yPct = Math.min(100, Math.max(0, ((e.clientY - rect.top  - dragOffset.y) / rect.height) * 100));
    updateElement(dragging, { xPct, yPct });
  }

  function onMouseUp() { setDragging(null); }

  async function handleImageUpload(file: File) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", "image");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const d   = await res.json() as { url?: string; publicId?: string; error?: string };
      if (!res.ok) { setError(d.error ?? "Error al subir imagen"); return; }
      const tmpl: Template = {
        id:           "",
        name:         file.name.replace(/\.[^.]+$/, ""),
        imageUrl:     d.url!,
        imagePublicId: d.publicId!,
        canvasWidth:  1000,
        canvasHeight: 700,
        elements:     [],
        active:       true,
      };
      setSelected(tmpl);
    } finally { setUploading(false); }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      let res: Response;
      if (selected.id) {
        // Update
        res = await fetch(`/api/certificate-templates/${selected.id}`, {
          method:  "PUT",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ name: selected.name, elements: selected.elements, canvasWidth: selected.canvasWidth, canvasHeight: selected.canvasHeight }),
        });
      } else {
        // Create
        res = await fetch("/api/certificate-templates", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            name:          selected.name,
            imageUrl:      selected.imageUrl,
            imagePublicId: selected.imagePublicId,
            canvasWidth:   selected.canvasWidth,
            canvasHeight:  selected.canvasHeight,
            elements:      selected.elements,
          }),
        });
      }
      const d = await res.json() as Template & { error?: string };
      if (!res.ok) { setError(d.error ?? "Error al guardar"); return; }
      setSelected(d);
      await loadTemplates();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    const res = await fetch(`/api/certificate-templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (selected?.id === id) setSelected(null);
      await loadTemplates();
    } else {
      const d = await res.json() as { error?: string };
      setError(d.error ?? "Error al eliminar");
    }
  }

  const activeElement = elements.find(e => e.id === activeEl) ?? null;

  return (
    <div className="p-6 flex flex-col lg:flex-row gap-6" style={{ minHeight: "80vh" }}>
      {/* Lista izquierda */}
      <div className="w-full lg:w-64 shrink-0 space-y-3">
        <h2 className="font-display font-bold text-dojo-white">Plantillas</h2>
        <button
          onClick={() => setSelected(null)}
          className="btn-secondary w-full flex items-center gap-2 text-sm justify-center"
        >
          <Plus size={15} /> Nueva Plantilla
        </button>
        {templates.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
              selected?.id === t.id ? "border-dojo-gold/50 bg-dojo-gold/5" : "border-dojo-border hover:border-dojo-border/80"
            }`}
            onClick={async () => {
              const res = await fetch(`/api/certificate-templates/${t.id}`);
              if (res.ok) setSelected(await res.json() as Template);
            }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dojo-white truncate">{t.name}</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); handleDelete(t.id); }}
              className="p-1 text-dojo-muted hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 space-y-4">
        {error && <div className="bg-red-900/40 border border-red-800/50 rounded-lg p-3 text-red-400 text-sm">{error}</div>}

        {/* Sin plantilla seleccionada: upload */}
        {!selected ? (
          <div className="border-2 border-dashed border-dojo-border rounded-xl p-12 flex flex-col items-center gap-4 text-center">
            {uploading ? (
              <Loader2 size={32} className="animate-spin text-dojo-gold" />
            ) : (
              <>
                <Upload size={32} className="text-dojo-border" />
                <p className="text-dojo-muted">Arrastra una imagen o haz click para subir</p>
                <label className="btn-primary cursor-pointer text-sm">
                  Seleccionar imagen
                  <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }} />
                </label>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Nombre de la plantilla */}
            <div className="flex items-center gap-3">
              <input
                className="form-input flex-1"
                value={selected.name}
                onChange={e => setSelected({ ...selected, name: e.target.value })}
                placeholder="Nombre de la plantilla"
              />
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm shrink-0">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Guardar
              </button>
              <button onClick={addElement} className="btn-secondary flex items-center gap-2 text-sm shrink-0">
                <Plus size={14} /> Agregar elemento
              </button>
            </div>

            {/* Canvas — 70% del ancho disponible */}
            <div className="overflow-x-auto">
              <div
                ref={canvasRef}
                className="relative select-none cursor-default"
                style={{
                  width:           "100%",
                  maxWidth:        "700px",
                  aspectRatio:     `${selected.canvasWidth} / ${selected.canvasHeight}`,
                  backgroundImage: `url(${selected.imageUrl})`,
                  backgroundSize:  "cover",
                  backgroundPosition: "center",
                  borderRadius:    "8px",
                  border:          "1px solid var(--color-dojo-border)",
                }}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
              >
                {elements.map(el => (
                  <div
                    key={el.id}
                    onMouseDown={e => onMouseDown(e, el.id)}
                    style={{
                      position:  "absolute",
                      left:      `${el.xPct}%`,
                      top:       `${el.yPct}%`,
                      transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
                      fontSize:  `${el.fontSize * 0.7}px`,
                      fontWeight: el.fontWeight,
                      fontStyle:  el.fontStyle,
                      color:      el.color,
                      textAlign:  el.textAlign,
                      fontFamily: el.fontFamily,
                      cursor:     "move",
                      padding:    "2px 4px",
                      border:     activeEl === el.id ? "1px dashed #FFD700" : "1px dashed transparent",
                      userSelect: "none",
                      whiteSpace: "nowrap",
                      background: activeEl === el.id ? "rgba(0,0,0,0.15)" : "transparent",
                      borderRadius: "4px",
                    }}
                  >
                    {el.type === "customText" ? el.label : `[${ELEMENT_TYPES.find(t => t.value === el.type)?.label ?? el.type}]`}
                  </div>
                ))}
              </div>
            </div>

            {/* Panel de propiedades */}
            {activeElement && (
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-dojo-white text-sm">Propiedades del elemento</h3>
                  <button onClick={() => removeElement(activeElement.id)} className="text-red-400 hover:text-red-300 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="form-label text-xs">Tipo de campo</label>
                    <select
                      className="form-input text-xs"
                      value={activeElement.type}
                      onChange={e => {
                        const t = e.target.value as CertElement["type"];
                        const label = ELEMENT_TYPES.find(x => x.value === t)?.label ?? t;
                        updateElement(activeElement.id, { type: t, label: t === "customText" ? "" : label });
                      }}
                    >
                      {ELEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  {activeElement.type === "customText" && (
                    <div className="col-span-2">
                      <label className="form-label text-xs">Texto</label>
                      <input className="form-input text-xs" value={activeElement.label} onChange={e => updateElement(activeElement.id, { label: e.target.value })} />
                    </div>
                  )}
                  <div>
                    <label className="form-label text-xs">Tamaño de fuente</label>
                    <input type="number" min={8} max={120} className="form-input text-xs" value={activeElement.fontSize} onChange={e => updateElement(activeElement.id, { fontSize: parseInt(e.target.value) || 24 })} />
                  </div>
                  <div>
                    <label className="form-label text-xs">Color</label>
                    <input type="color" className="form-input text-xs h-9 p-1" value={activeElement.color} onChange={e => updateElement(activeElement.id, { color: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label text-xs">Negrita</label>
                    <select className="form-input text-xs" value={activeElement.fontWeight} onChange={e => updateElement(activeElement.id, { fontWeight: e.target.value as "normal" | "bold" })}>
                      <option value="normal">Normal</option>
                      <option value="bold">Negrita</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label text-xs">Cursiva</label>
                    <select className="form-input text-xs" value={activeElement.fontStyle} onChange={e => updateElement(activeElement.id, { fontStyle: e.target.value as "normal" | "italic" })}>
                      <option value="normal">Normal</option>
                      <option value="italic">Cursiva</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label text-xs">Alineación</label>
                    <select className="form-input text-xs" value={activeElement.textAlign} onChange={e => updateElement(activeElement.id, { textAlign: e.target.value as "left" | "center" | "right" })}>
                      <option value="left">Izquierda</option>
                      <option value="center">Centrado</option>
                      <option value="right">Derecha</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label text-xs">Rotación (°)</label>
                    <input type="number" min={-180} max={180} className="form-input text-xs" value={activeElement.rotation} onChange={e => updateElement(activeElement.id, { rotation: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
