"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Plus, Trash2, Save, Upload, Eye, X } from "lucide-react";

// ── Fuentes disponibles para diplomas ────────────────────────────────────────
const CERT_FONTS = [
  { key: "sans-serif",         label: "Sans-Serif (defecto)",       google: "" },
  { key: "serif",              label: "Serif (sistema)",             google: "" },
  { key: "Cinzel",             label: "Cinzel",                      google: "Cinzel:wght@400;700;900" },
  { key: "Cormorant Garamond", label: "Cormorant Garamond",          google: "Cormorant+Garamond:ital,wght@0,400;0,700;1,400" },
  { key: "Playfair Display",   label: "Playfair Display",            google: "Playfair+Display:ital,wght@0,400;0,700;1,400" },
  { key: "Dancing Script",     label: "Dancing Script",              google: "Dancing+Script:wght@400;700" },
  { key: "Great Vibes",        label: "Great Vibes (caligrafía)",    google: "Great+Vibes" },
  { key: "Montserrat",         label: "Montserrat",                  google: "Montserrat:wght@400;700" },
  { key: "Oswald",             label: "Oswald",                      google: "Oswald:wght@400;600;700" },
  { key: "Lato",               label: "Lato",                        google: "Lato:ital,wght@0,400;0,700;1,400" },
] as const;

function fontStack(key: string): string {
  if (key === "sans-serif" || key === "serif") return key;
  return `'${key}', sans-serif`;
}

function buildFontUrl(families: string[]): string {
  const items = CERT_FONTS.filter(f => f.google && families.includes(f.key));
  if (!items.length) return "";
  return `https://fonts.googleapis.com/css2?${items.map(f => `family=${f.google}`).join("&")}&display=swap`;
}

interface CertElement {
  id:             string;
  type:           "studentName" | "belt" | "date" | "instructor" | "customText";
  label:          string;
  xPct:           number;
  yPct:           number;
  fontSize:       number;
  fontFamily:     string;
  color:          string;
  fontWeight:     "normal" | "bold";
  fontStyle:      "normal" | "italic";
  textDecoration: "none" | "underline";
  textAlign:      "left" | "center" | "right";
  rotation:       number;
}

interface Template {
  id:            string;
  name:          string;
  imageUrl:      string;
  imagePublicId: string;
  canvasWidth:   number;
  canvasHeight:  number;
  elements:      CertElement[];
  active:        boolean;
}

const ELEMENT_TYPES = [
  { value: "studentName", label: "Nombre del alumno" },
  { value: "belt",        label: "Cinta obtenida"    },
  { value: "date",        label: "Fecha de emisión"  },
  { value: "instructor",  label: "Instructor"        },
  { value: "customText",  label: "Texto libre"       },
] as const;

// Datos de ejemplo para la vista previa
const PREVIEW_VALUES: Record<string, string> = {
  studentName: "Juan García López",
  belt:        "Cinta Negra",
  date:        new Date().toLocaleDateString("es-PA", {
    timeZone: "America/Panama",
    day:      "2-digit",
    month:    "long",
    year:     "numeric",
  }),
  instructor: "Sensei Ejemplo",
};

function genId() { return Math.random().toString(36).slice(2); }

function defaultElement(): CertElement {
  return {
    id:             genId(),
    type:           "studentName",
    label:          "Nombre del alumno",
    xPct:           50,
    yPct:           50,
    fontSize:       28,
    fontFamily:     "sans-serif",
    color:          "#1A1A1A",
    fontWeight:     "normal",
    fontStyle:      "normal",
    textDecoration: "none",
    textAlign:      "center",
    rotation:       0,
  };
}

// Normaliza elementos cargados desde la BD (rellena campos nuevos si faltan)
function normalizeElement(e: Partial<CertElement>): CertElement {
  return {
    id:             e.id ?? genId(),
    type:           e.type ?? "customText",
    label:          e.label ?? "",
    xPct:           e.xPct ?? 50,
    yPct:           e.yPct ?? 50,
    fontSize:       e.fontSize ?? 24,
    fontFamily:     e.fontFamily ?? "sans-serif",
    color:          e.color ?? "#1A1A1A",
    fontWeight:     e.fontWeight ?? "normal",
    fontStyle:      e.fontStyle ?? "normal",
    textDecoration: e.textDecoration ?? "none",
    textAlign:      e.textAlign ?? "center",
    rotation:       e.rotation ?? 0,
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
  const [showPreview, setShowPreview] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Inyectar Google Fonts cuando cambian las fuentes usadas en la plantilla
  useEffect(() => {
    const families = [...new Set((selected?.elements ?? []).map(e => e.fontFamily))];
    const url = buildFontUrl(families);
    const existing = document.getElementById("cert-google-fonts");
    if (existing) existing.remove();
    if (url) {
      const link = document.createElement("link");
      link.id   = "cert-google-fonts";
      link.rel  = "stylesheet";
      link.href = url;
      document.head.appendChild(link);
    }
  }, [selected?.elements]);

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
      setSelected({
        id:            "",
        name:          file.name.replace(/\.[^.]+$/, ""),
        imageUrl:      d.url!,
        imagePublicId: d.publicId!,
        canvasWidth:   1000,
        canvasHeight:  700,
        elements:      [],
        active:        true,
      });
    } finally { setUploading(false); }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      let res: Response;
      if (selected.id) {
        res = await fetch(`/api/certificate-templates/${selected.id}`, {
          method:  "PUT",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ name: selected.name, elements: selected.elements, canvasWidth: selected.canvasWidth, canvasHeight: selected.canvasHeight }),
        });
      } else {
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
      setSelected({ ...d, elements: (d.elements ?? []).map(normalizeElement) });
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

  function elText(el: CertElement, preview: boolean): string {
    if (el.type === "customText") return el.label;
    if (preview) return PREVIEW_VALUES[el.type] ?? `[${el.type}]`;
    return `[${ELEMENT_TYPES.find(t => t.value === el.type)?.label ?? el.type}]`;
  }

  function elStyle(el: CertElement, scale: number, interactive: boolean): React.CSSProperties {
    return {
      position:        "absolute",
      left:            `${el.xPct}%`,
      top:             `${el.yPct}%`,
      transform:       `translate(-50%, -50%) rotate(${el.rotation}deg)`,
      fontSize:        `${el.fontSize * scale}px`,
      fontWeight:      el.fontWeight,
      fontStyle:       el.fontStyle,
      textDecoration:  el.textDecoration,
      color:           el.color,
      textAlign:       el.textAlign,
      fontFamily:      fontStack(el.fontFamily),
      cursor:          interactive ? "move" : "default",
      padding:         "2px 4px",
      border:          interactive && activeEl === el.id ? "1px dashed #FFD700" : "1px dashed transparent",
      userSelect:      "none",
      whiteSpace:      "nowrap",
      background:      interactive && activeEl === el.id ? "rgba(0,0,0,0.15)" : "transparent",
      borderRadius:    "4px",
    };
  }

  const activeElement = elements.find(e => e.id === activeEl) ?? null;

  return (
    <div className="p-6 flex flex-col lg:flex-row gap-6" style={{ minHeight: "80vh" }}>

      {/* ── Modal Vista Previa ───────────────────────────────────────────── */}
      {showPreview && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="relative bg-dojo-dark rounded-xl border border-dojo-border overflow-hidden max-w-3xl w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-dojo-border">
              <h3 className="font-semibold text-dojo-white text-sm">Vista Previa — {selected.name}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-dojo-muted hover:text-dojo-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <div
                className="relative select-none w-full"
                style={{
                  aspectRatio:        `${selected.canvasWidth} / ${selected.canvasHeight}`,
                  backgroundImage:    `url(${selected.imageUrl})`,
                  backgroundSize:     "cover",
                  backgroundPosition: "center",
                  borderRadius:       "6px",
                  overflow:           "hidden",
                }}
              >
                {elements.map(el => (
                  <div key={el.id} style={elStyle(el, 0.7, false)}>
                    {elText(el, true)}
                  </div>
                ))}
              </div>
              <p className="text-xs text-dojo-muted mt-3 text-center">
                Los datos mostrados son de ejemplo. El diploma real tendrá la información del alumno.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Panel izquierdo: lista de plantillas ────────────────────────── */}
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
              selected?.id === t.id
                ? "border-dojo-gold/50 bg-dojo-gold/5"
                : "border-dojo-border hover:border-dojo-border/80"
            }`}
            onClick={async () => {
              const res = await fetch(`/api/certificate-templates/${t.id}`);
              if (res.ok) {
                const data = await res.json() as Template;
                setSelected({ ...data, elements: (data.elements ?? []).map(normalizeElement) });
              }
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

      {/* ── Editor ──────────────────────────────────────────────────────── */}
      <div className="flex-1 space-y-4">
        {error && (
          <div className="bg-red-900/40 border border-red-800/50 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

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
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }}
                  />
                </label>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Barra superior: nombre + acciones */}
            <div className="flex items-center gap-3 flex-wrap">
              <input
                className="form-input flex-1 min-w-0"
                value={selected.name}
                onChange={e => setSelected({ ...selected, name: e.target.value })}
                placeholder="Nombre de la plantilla"
              />
              <button
                onClick={() => setShowPreview(true)}
                className="btn-secondary flex items-center gap-2 text-sm shrink-0"
              >
                <Eye size={14} /> Vista Previa
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-2 text-sm shrink-0"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Guardar
              </button>
              <button
                onClick={addElement}
                className="btn-secondary flex items-center gap-2 text-sm shrink-0"
              >
                <Plus size={14} /> Agregar elemento
              </button>
            </div>

            {/* Canvas */}
            <div className="overflow-x-auto">
              <div
                ref={canvasRef}
                className="relative select-none cursor-default"
                style={{
                  width:              "100%",
                  maxWidth:           "700px",
                  aspectRatio:        `${selected.canvasWidth} / ${selected.canvasHeight}`,
                  backgroundImage:    `url(${selected.imageUrl})`,
                  backgroundSize:     "cover",
                  backgroundPosition: "center",
                  borderRadius:       "8px",
                  border:             "1px solid var(--color-dojo-border)",
                }}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
              >
                {elements.map(el => (
                  <div
                    key={el.id}
                    onMouseDown={e => onMouseDown(e, el.id)}
                    style={elStyle(el, 0.7, true)}
                  >
                    {elText(el, false)}
                  </div>
                ))}
              </div>
            </div>

            {/* Panel de propiedades */}
            {activeElement && (
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-dojo-white text-sm">Propiedades del elemento</h3>
                  <button
                    onClick={() => removeElement(activeElement.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Tipo de campo */}
                  <div>
                    <label className="form-label text-xs">Tipo de campo</label>
                    <select
                      className="form-input text-xs"
                      value={activeElement.type}
                      onChange={e => {
                        const t = e.target.value as CertElement["type"];
                        const lbl = ELEMENT_TYPES.find(x => x.value === t)?.label ?? t;
                        updateElement(activeElement.id, { type: t, label: t === "customText" ? "" : lbl });
                      }}
                    >
                      {ELEMENT_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Texto libre */}
                  {activeElement.type === "customText" && (
                    <div className="col-span-2">
                      <label className="form-label text-xs">Texto</label>
                      <input
                        className="form-input text-xs"
                        value={activeElement.label}
                        onChange={e => updateElement(activeElement.id, { label: e.target.value })}
                      />
                    </div>
                  )}

                  {/* Tamaño */}
                  <div>
                    <label className="form-label text-xs">Tamaño</label>
                    <input
                      type="number" min={8} max={120}
                      className="form-input text-xs"
                      value={activeElement.fontSize}
                      onChange={e => updateElement(activeElement.id, { fontSize: parseInt(e.target.value) || 24 })}
                    />
                  </div>

                  {/* Color */}
                  <div>
                    <label className="form-label text-xs">Color</label>
                    <input
                      type="color"
                      className="form-input text-xs h-9 p-1"
                      value={activeElement.color}
                      onChange={e => updateElement(activeElement.id, { color: e.target.value })}
                    />
                  </div>

                  {/* Fuente */}
                  <div className="col-span-2">
                    <label className="form-label text-xs">Fuente</label>
                    <select
                      className="form-input text-xs"
                      value={activeElement.fontFamily}
                      onChange={e => updateElement(activeElement.id, { fontFamily: e.target.value })}
                    >
                      {CERT_FONTS.map(f => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Estilo: B / I / U */}
                  <div>
                    <label className="form-label text-xs">Estilo</label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        title="Negrita"
                        onClick={() => updateElement(activeElement.id, {
                          fontWeight: activeElement.fontWeight === "bold" ? "normal" : "bold",
                        })}
                        className={`w-8 h-8 rounded border text-sm font-bold transition-colors ${
                          activeElement.fontWeight === "bold"
                            ? "bg-dojo-gold/20 border-dojo-gold/50 text-dojo-gold"
                            : "border-dojo-border text-dojo-muted hover:border-dojo-muted"
                        }`}
                      >B</button>
                      <button
                        type="button"
                        title="Cursiva"
                        onClick={() => updateElement(activeElement.id, {
                          fontStyle: activeElement.fontStyle === "italic" ? "normal" : "italic",
                        })}
                        className={`w-8 h-8 rounded border text-sm italic transition-colors ${
                          activeElement.fontStyle === "italic"
                            ? "bg-dojo-gold/20 border-dojo-gold/50 text-dojo-gold"
                            : "border-dojo-border text-dojo-muted hover:border-dojo-muted"
                        }`}
                      >I</button>
                      <button
                        type="button"
                        title="Subrayado"
                        onClick={() => updateElement(activeElement.id, {
                          textDecoration: activeElement.textDecoration === "underline" ? "none" : "underline",
                        })}
                        className={`w-8 h-8 rounded border text-sm underline transition-colors ${
                          activeElement.textDecoration === "underline"
                            ? "bg-dojo-gold/20 border-dojo-gold/50 text-dojo-gold"
                            : "border-dojo-border text-dojo-muted hover:border-dojo-muted"
                        }`}
                      >U</button>
                    </div>
                  </div>

                  {/* Alineación */}
                  <div>
                    <label className="form-label text-xs">Alineación</label>
                    <select
                      className="form-input text-xs"
                      value={activeElement.textAlign}
                      onChange={e => updateElement(activeElement.id, { textAlign: e.target.value as "left" | "center" | "right" })}
                    >
                      <option value="left">Izquierda</option>
                      <option value="center">Centrado</option>
                      <option value="right">Derecha</option>
                    </select>
                  </div>

                  {/* Rotación */}
                  <div>
                    <label className="form-label text-xs">Rotación (°)</label>
                    <input
                      type="number" min={-180} max={180}
                      className="form-input text-xs"
                      value={activeElement.rotation}
                      onChange={e => updateElement(activeElement.id, { rotation: parseInt(e.target.value) || 0 })}
                    />
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
