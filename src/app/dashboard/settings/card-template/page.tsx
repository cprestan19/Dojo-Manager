"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/lib/context/AppContext";
import {
  CreditCard, Upload, Save, Trash2, Loader2, RefreshCw,
  Move, Type, Palette, Image as ImageIcon, ChevronDown, Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CARD_FONTS, DEFAULT_CARD_LAYOUT, DEFAULT_LANDSCAPE_LAYOUT,
  CARD_PRESETS, getCardDimensions,
  getFontStack, getGoogleFontsUrl, parseCardLayout,
  type CardLayout, type CardPreset,
} from "@/lib/card-layout";

// ── Toggle switch ─────────────────────────────────────────────────────────────
function ToggleRow({ label, checked, onChange, hint }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <span className="text-xs text-dojo-muted">{label}</span>
        {hint && <span className="block text-[10px] text-dojo-muted/60">{hint}</span>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-9 h-5 rounded-full transition-colors flex-shrink-0",
          checked ? "bg-dojo-red" : "bg-dojo-border"
        )}
      >
        <span className={cn(
          "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )} />
      </button>
    </div>
  );
}

// ── Vista previa del carnet ───────────────────────────────────────────────────
function CardPreview({
  layout,
  templateUrl,
  dojoName,
  isDraggingPhoto,
  onPreviewMouseDown,
  onPreviewMouseMove,
  onPreviewMouseUp,
  previewRef,
}: {
  layout: CardLayout;
  templateUrl: string | null;
  dojoName: string;
  isDraggingPhoto: boolean;
  onPreviewMouseDown: (e: React.MouseEvent) => void;
  onPreviewMouseMove: (e: React.MouseEvent) => void;
  onPreviewMouseUp: () => void;
  previewRef: React.RefObject<HTMLDivElement>;
}) {
  const { w: CW, h: CH } = getCardDimensions(layout.preset);
  const scale = Math.min(420 / CW, 520 / CH);

  const ph = layout.photo;
  const nm = layout.name;
  const footerH = CH - layout.footer.y;
  const photoRadius = ph.shape === "rectangle" ? 12 : "50%";

  // QR border
  const qrBorder = (layout.qr.frameBorderWidth > 0 && layout.qr.frameBorderColor)
    ? `${layout.qr.frameBorderWidth}px solid ${layout.qr.frameBorderColor}`
    : "2px solid #ccc";
  const qrBg = layout.qr.bgTransparent ? "transparent" : "#fff";

  // Name styles
  const nameLetterSpacing = nm.letterSpacing ? `${nm.letterSpacing * 0.01}em` : undefined;
  const nameTextShadow = nm.shadowEnabled
    ? `${nm.shadowX}px ${nm.shadowY}px ${nm.shadowBlur}px ${nm.shadowColor}`
    : (templateUrl ? "0 1px 4px rgba(0,0,0,0.7)" : undefined);
  const nameTextStroke = nm.outlineEnabled
    ? `${nm.outlineWidth}px ${nm.outlineColor}` : undefined;

  const allFontKeys = CARD_FONTS.filter(f => f.key !== "Montserrat").map(f => f.key);
  const googleFontsUrl = getGoogleFontsUrl(allFontKeys);

  return (
    <>
      {googleFontsUrl && (
        <style>{`@import url('${googleFontsUrl}');`}</style>
      )}
      {/* Wrapper visual escalado */}
      <div style={{
        width: Math.round(CW * scale),
        height: Math.round(CH * scale),
        flexShrink: 0,
        overflow: "hidden",
      }}>
        <div
          ref={previewRef}
          style={{
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            cursor: isDraggingPhoto ? "grabbing" : "default",
          }}
          onMouseDown={onPreviewMouseDown}
          onMouseMove={onPreviewMouseMove}
          onMouseUp={onPreviewMouseUp}
          onMouseLeave={onPreviewMouseUp}
        >
          {/* Carnet CW × CH */}
          <div style={{
            position: "relative", width: CW, height: CH,
            background: templateUrl ? undefined : "#F0F0F0",
            overflow: "hidden", borderRadius: 10,
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            userSelect: "none",
          }}>
            {/* Fondo template */}
            {templateUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={templateUrl} alt="" style={{
                position: "absolute", inset: 0,
                width: CW, height: CH,
                objectFit: "cover", zIndex: 0,
              }} />
            )}

            {/* Sin template: fondo gris con texto */}
            {!templateUrl && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 1,
              }}>
                <p style={{ fontSize: 22, color: "#bbb", fontFamily: "sans-serif" }}>Sin plantilla</p>
              </div>
            )}

            {/* ── Footer ───────────────────────────── */}
            <div style={{
              position: "absolute", top: layout.footer.y, left: 0,
              width: CW, height: footerH,
              background: layout.footer.background, zIndex: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{
                fontSize: layout.slogan.fontSize, fontStyle: "italic", fontWeight: 700,
                color: layout.slogan.color, textTransform: "uppercase",
                fontFamily: getFontStack(layout.slogan.fontFamily),
                padding: "0 32px", textAlign: "center", lineHeight: 1.35,
              }}>
                {layout.slogan.text.trim() || "SLOGAN DEL DOJO"}
              </span>
            </div>

            {/* ── Zona QR ──────────────────────────── */}
            <div style={{
              position: "absolute", top: layout.qr.y, left: 0, right: 0,
              height: layout.qr.height,
              zIndex: 7, display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, padding: "0 16px",
            }}>
              <div style={{ width: "20%", flexShrink: 0 }} />
              <div style={{
                flex: "0 0 55%",
                background: qrBg,
                border: qrBorder,
                borderRadius: 12, height: "90%",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 14, color: "#aaa", fontFamily: "monospace" }}>QR</span>
              </div>
              <div style={{
                flex: "0 0 25%",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 11, color: layout.contactColor, fontFamily: "sans-serif" }}>
                  Acudiente
                </span>
              </div>
            </div>

            {/* ── Línea TEAM ───────────────────────── */}
            <div style={{
              position: "absolute", top: layout.team.y, left: 20, right: 20, zIndex: 7,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ flex: 1, height: 1.5, background: layout.team.color }} />
              <span style={{
                fontSize: 14, fontWeight: 700, color: layout.team.color,
                letterSpacing: "0.42em", textTransform: "uppercase", whiteSpace: "nowrap",
              }}>
                TEAM {dojoName.toUpperCase()}
              </span>
              <div style={{ flex: 1, height: 1.5, background: layout.team.color }} />
            </div>

            {/* ── Nombre ───────────────────────────── */}
            <div style={{
              position: "absolute", top: nm.y, left: 20, right: 20, zIndex: 7,
              textAlign: "center",
              fontSize: nm.fontSize, fontWeight: 800,
              color: nm.color, textTransform: "uppercase",
              fontFamily: getFontStack(nm.fontFamily), lineHeight: 1.1,
              ...(nameLetterSpacing ? { letterSpacing: nameLetterSpacing } : {}),
              ...(nameTextShadow ? { textShadow: nameTextShadow } : {}),
              ...(nameTextStroke ? { WebkitTextStroke: nameTextStroke } : {}),
            }}>
              NOMBRE DEL ALUMNO
            </div>

            {/* ── Foto ─────────────────────────────── */}
            {ph.borderWidth > 0 && (
              <>
                {/* Anillo exterior */}
                <div style={{
                  position: "absolute",
                  top: ph.y - ph.borderWidth - 4, left: ph.x - ph.borderWidth - 4,
                  width: ph.diameter + (ph.borderWidth + 4) * 2,
                  height: ph.diameter + (ph.borderWidth + 4) * 2,
                  borderRadius: photoRadius,
                  border: `2px solid rgba(204,0,0,0.22)`,
                  zIndex: 5,
                }} />
                {/* Borde sólido */}
                <div style={{
                  position: "absolute",
                  top: ph.y - ph.borderWidth, left: ph.x - ph.borderWidth,
                  width: ph.diameter + ph.borderWidth * 2,
                  height: ph.diameter + ph.borderWidth * 2,
                  borderRadius: photoRadius,
                  border: `${ph.borderWidth}px solid ${ph.borderColor}`,
                  zIndex: 6,
                  boxShadow: `0 6px 28px rgba(204,0,0,0.30)`,
                }} />
              </>
            )}
            <div style={{
              position: "absolute", top: ph.y, left: ph.x,
              width: ph.diameter, height: ph.diameter,
              borderRadius: photoRadius, overflow: "hidden",
              background: "#CCCCCC", zIndex: 7,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "grab",
            }}>
              <span style={{ fontSize: 20, color: "#888", fontFamily: "sans-serif" }}>Foto</span>
            </div>

            {/* ── Etiqueta de arrastre ─────────────── */}
            <div style={{
              position: "absolute",
              top: ph.y + ph.diameter / 2 - 12,
              left: ph.x + ph.diameter / 2 - 40,
              zIndex: 10, background: "rgba(0,0,0,0.6)",
              borderRadius: 8, padding: "4px 8px",
              fontSize: 11, color: "#fff", fontFamily: "sans-serif",
              pointerEvents: "none", whiteSpace: "nowrap",
            }}>
              ☰ Arrastrar
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Control deslizante ────────────────────────────────────────────────────────
function SliderRow({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-dojo-muted">
        <span>{label}</span>
        <span className="font-mono text-dojo-white">{value}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 accent-dojo-red"
        />
        <input
          type="number" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-16 text-xs text-center bg-dojo-dark border border-dojo-border rounded px-1 py-0.5 text-dojo-white"
        />
      </div>
    </div>
  );
}

// ── Selector de color ─────────────────────────────────────────────────────────
function ColorRow({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-dojo-muted">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded border border-dojo-border overflow-hidden">
          <input
            type="color" value={value}
            onChange={e => onChange(e.target.value)}
            className="w-8 h-8 -translate-x-1 -translate-y-1 cursor-pointer"
          />
        </div>
        <input
          type="text" value={value}
          onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onChange(e.target.value); }}
          className="w-24 text-xs font-mono bg-dojo-dark border border-dojo-border rounded px-2 py-0.5 text-dojo-white uppercase"
          maxLength={7}
        />
      </div>
    </div>
  );
}

// ── Selector de fuente ────────────────────────────────────────────────────────
function FontRow({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-dojo-muted">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs bg-dojo-dark border border-dojo-border rounded px-2 py-1 text-dojo-white"
      >
        {CARD_FONTS.map(f => (
          <option key={f.key} value={f.key}>{f.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Sección colapsable ────────────────────────────────────────────────────────
function CollapsibleSection({ title, icon: Icon, children, defaultOpen = true, hint }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  hint?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 text-dojo-white font-semibold text-sm"
      >
        <Icon size={16} className="text-dojo-red flex-shrink-0" />
        <span className="flex-1 text-left">{title}</span>
        {hint && <span className="text-[10px] text-dojo-muted font-normal mr-1">{hint}</span>}
        <ChevronDown size={14} className={cn("text-dojo-muted transition-transform duration-200 flex-shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-dojo-border space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function CardTemplatePage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const router = useRouter();
  const { refreshDojo } = useAppContext();

  const [dojoList,   setDojoList]   = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [dojoName,   setDojoName]   = useState("Mi Dojo");

  const [templateUrl,  setTemplateUrl]  = useState<string | null>(null);
  const [tplUploading, setTplUploading] = useState(false);
  const [tplError,     setTplError]     = useState("");
  const [layout,       setLayout]       = useState<CardLayout>(DEFAULT_CARD_LAYOUT);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);

  const tplFileRef  = useRef<HTMLInputElement>(null);
  const previewRef  = useRef<HTMLDivElement>(null);
  const dragging    = useRef(false);
  const dragOffsetX = useRef(0);
  const dragOffsetY = useRef(0);
  const previewScaleRef = useRef(0.44);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);

  // Dimensiones dinámicas según preset actual
  const { w: CW, h: CH } = getCardDimensions(layout.preset);
  // Actualizar scale en cada render para que los drag handlers la usen
  previewScaleRef.current = Math.min(420 / CW, 520 / CH);

  // ── Cargar lista de dojos para sysadmin ──────────────────────────────────
  useEffect(() => {
    if (role !== "sysadmin") return;
    Promise.all([
      fetch("/api/dojos").then(r => r.ok ? r.json() : []),
      fetch("/api/dojo").then(r => r.ok ? r.json() : null),
    ]).then(([list, ctx]: [Array<{ id: string; name: string; slug: string }>, { id: string } | null]) => {
      setDojoList(list);
      if (ctx?.id) setSelectedId(ctx.id);
      else if (list.length > 0) setSelectedId(list[0].id);
    });
  }, [role]);

  // ── Cargar config del dojo ────────────────────────────────────────────────
  useEffect(() => {
    if (role === "sysadmin" && !selectedId) { setLoading(false); return; }
    setLoading(true);
    const url = role === "sysadmin" && selectedId
      ? `/api/dojo?id=${selectedId}&logo=1`
      : "/api/dojo?logo=1";
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setDojoName(data.name ?? "Mi Dojo");
          setTemplateUrl(data.cardTemplateImage ?? null);
          setLayout(parseCardLayout(data.cardLayout) ?? DEFAULT_CARD_LAYOUT);
        }
        setLoading(false);
      });
  }, [role, selectedId]);

  // ── Subir imagen de fondo ─────────────────────────────────────────────────
  async function handleTplFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("El archivo supera 5 MB"); return; }
    setTplError(""); setTplUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "image");
      fd.append("purpose", "card-template");
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) setTemplateUrl(data.url);
      else        setTplError(data.error ?? "Error al subir la imagen");
    } catch {
      setTplError("Error de conexión");
    } finally {
      setTplUploading(false);
      if (tplFileRef.current) tplFileRef.current.value = "";
    }
  }

  // ── Guardar todo ──────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true); setSaved(false);
    const url = role === "sysadmin" && selectedId ? `/api/dojo?id=${selectedId}` : "/api/dojo";
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardTemplateImage: templateUrl, cardLayout: layout }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      refreshDojo();
      router.refresh();
    }
    setSaving(false);
  }

  // ── Cambiar preset (portrait / landscape) ────────────────────────────────
  function handlePresetChange(preset: CardPreset) {
    setLayout(preset === "landscape" ? DEFAULT_LANDSCAPE_LAYOUT : DEFAULT_CARD_LAYOUT);
  }

  // ── Drag-and-drop foto en el preview ─────────────────────────────────────
  const handlePreviewMouseDown = useCallback((e: React.MouseEvent) => {
    if (!previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const scale = previewScaleRef.current;
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;
    const ph = layout.photo;
    if (mx >= ph.x && mx <= ph.x + ph.diameter && my >= ph.y && my <= ph.y + ph.diameter) {
      dragging.current = true;
      dragOffsetX.current = mx - ph.x;
      dragOffsetY.current = my - ph.y;
      setIsDraggingPhoto(true);
      e.preventDefault();
    }
  }, [layout.photo]);

  const handlePreviewMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current || !previewRef.current) return;
    const { w: dCW, h: dCH } = getCardDimensions(layout.preset);
    const scale = previewScaleRef.current;
    const rect = previewRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;
    const newX = Math.max(0, Math.min(dCW - layout.photo.diameter, Math.round(mx - dragOffsetX.current)));
    const newY = Math.max(0, Math.min(dCH - layout.photo.diameter, Math.round(my - dragOffsetY.current)));
    setLayout(prev => ({ ...prev, photo: { ...prev.photo, x: newX, y: newY } }));
  }, [layout.photo.diameter, layout.preset]);

  const handlePreviewMouseUp = useCallback(() => {
    dragging.current = false;
    setIsDraggingPhoto(false);
  }, []);

  function updatePhoto(key: keyof CardLayout["photo"], value: number | string | boolean) {
    setLayout(prev => ({ ...prev, photo: { ...prev.photo, [key]: value } as CardLayout["photo"] }));
  }
  function updateQr(key: keyof CardLayout["qr"], value: number | string | boolean) {
    setLayout(prev => ({ ...prev, qr: { ...prev.qr, [key]: value } as CardLayout["qr"] }));
  }
  function updateName(key: keyof CardLayout["name"], value: number | string | boolean) {
    setLayout(prev => ({ ...prev, name: { ...prev.name, [key]: value } as CardLayout["name"] }));
  }
  function updateTeam(key: keyof CardLayout["team"], value: number | string | boolean) {
    setLayout(prev => ({ ...prev, team: { ...prev.team, [key]: value } as CardLayout["team"] }));
  }
  function updateSlogan(key: keyof CardLayout["slogan"], value: number | string | boolean) {
    setLayout(prev => ({ ...prev, slogan: { ...prev.slogan, [key]: value } as CardLayout["slogan"] }));
  }
  function updateFooter(key: keyof CardLayout["footer"], value: number | string | boolean) {
    setLayout(prev => ({ ...prev, footer: { ...prev.footer, [key]: value } as CardLayout["footer"] }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-dojo-muted">Cargando editor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
          <CreditCard size={28} className="text-dojo-red" /> Diseño de Carnet
        </h1>
        <p className="text-dojo-muted text-sm mt-1">
          Personaliza la posición de los elementos del carnet para este dojo
        </p>
      </div>

      {/* Selector de dojo (sysadmin) */}
      {role === "sysadmin" && (
        <div className="card">
          <label className="form-label mb-2 block">Seleccionar Dojo</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="form-input"
          >
            {dojoList.map(d => <option key={d.id} value={d.id}>{d.name} ({d.slug})</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-start">

        {/* ── Preview ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 sticky top-4">
          <div className="bg-dojo-darker border border-dojo-border rounded-2xl p-4 shadow-xl">
            <CardPreview
              layout={layout}
              templateUrl={templateUrl}
              dojoName={dojoName}
              isDraggingPhoto={isDraggingPhoto}
              onPreviewMouseDown={handlePreviewMouseDown}
              onPreviewMouseMove={handlePreviewMouseMove}
              onPreviewMouseUp={handlePreviewMouseUp}
              previewRef={previewRef}
            />
          </div>
          <p className="text-[10px] text-dojo-muted text-center">
            Arrastra la foto en el preview · {CW} × {CH} px (CR80)
          </p>

          {/* Botón reset */}
          <button
            onClick={() => setLayout(layout.preset === "landscape" ? DEFAULT_LANDSCAPE_LAYOUT : DEFAULT_CARD_LAYOUT)}
            className="btn-ghost text-xs flex items-center gap-1.5 text-dojo-muted"
          >
            <RefreshCw size={13} /> Restablecer posiciones por defecto
          </button>
        </div>

        {/* ── Controles ───────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* 1. Dimensiones del carnet */}
          <CollapsibleSection title="Dimensiones del Carnet" icon={Maximize2} defaultOpen={false}>
            <p className="text-xs text-dojo-muted">
              Cambiar orientación restablece posiciones a valores por defecto.
            </p>
            <div className="flex gap-2">
              {CARD_PRESETS.map(p => (
                <button
                  key={p.key}
                  onClick={() => handlePresetChange(p.key)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded text-xs font-semibold border transition-colors",
                    layout.preset === p.key
                      ? "bg-dojo-red text-white border-dojo-red"
                      : "bg-transparent text-dojo-muted border-dojo-border hover:border-dojo-red/50"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </CollapsibleSection>

          {/* 2. Plantilla de fondo */}
          <CollapsibleSection title="Plantilla de Fondo" icon={ImageIcon}>
            <p className="text-dojo-muted text-xs">
              Imagen de fondo del carnet. Recomendado: {CW} × {CH} px · Máximo 5 MB
            </p>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => !tplUploading && tplFileRef.current?.click()}
                disabled={tplUploading}
                className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-60"
              >
                {tplUploading
                  ? <><Loader2 size={14} className="animate-spin" /> Subiendo...</>
                  : <><Upload size={14} /> Subir imagen</>
                }
              </button>
              {templateUrl && !tplUploading && (
                <button
                  onClick={() => setTemplateUrl(null)}
                  className="btn-ghost text-red-400 hover:text-red-300 flex items-center gap-1.5 text-sm"
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              )}
            </div>
            {tplError && <p className="text-xs text-red-400">{tplError}</p>}
            {templateUrl && <p className="text-xs text-green-400">✓ Plantilla cargada</p>}
            <input
              ref={tplFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleTplFileChange}
            />
          </CollapsibleSection>

          {/* 3. Foto del alumno */}
          <CollapsibleSection title="Foto del Alumno" icon={Move} hint="Arrastrar en preview">
            {/* Shape toggle */}
            <div className="flex gap-2">
              {(["circle", "rectangle"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => updatePhoto("shape", s)}
                  className={cn(
                    "flex-1 py-1.5 px-3 rounded text-xs font-semibold border transition-colors",
                    layout.photo.shape === s
                      ? "bg-dojo-red text-white border-dojo-red"
                      : "bg-transparent text-dojo-muted border-dojo-border hover:border-dojo-red/50"
                  )}
                >
                  {s === "circle" ? "Círculo" : "Cuadrado"}
                </button>
              ))}
            </div>
            <SliderRow
              label="Posición X (izquierda)"
              value={layout.photo.x}
              min={0} max={CW - layout.photo.diameter}
              onChange={v => updatePhoto("x", v)}
            />
            <SliderRow
              label="Posición Y (arriba)"
              value={layout.photo.y}
              min={0} max={CH - layout.photo.diameter}
              onChange={v => updatePhoto("y", v)}
            />
            <SliderRow
              label="Diámetro"
              value={layout.photo.diameter}
              min={100} max={500}
              onChange={v => updatePhoto("diameter", v)}
            />
            <ToggleRow
              label="Marco de la foto"
              checked={layout.photo.borderWidth > 0}
              onChange={v => setLayout(prev => ({
                ...prev,
                photo: { ...prev.photo, borderWidth: v ? (prev.photo.borderWidth || 4) : 0 },
              }))}
            />
            {layout.photo.borderWidth > 0 && (
              <>
                <SliderRow
                  label="Grosor"
                  value={layout.photo.borderWidth}
                  min={1} max={12}
                  onChange={v => updatePhoto("borderWidth", v)}
                />
                <ColorRow
                  label="Color del marco"
                  value={layout.photo.borderColor}
                  onChange={v => updatePhoto("borderColor", v)}
                />
              </>
            )}
          </CollapsibleSection>

          {/* 4. Nombre del alumno */}
          <CollapsibleSection title="Nombre del Alumno" icon={Type}>
            <SliderRow
              label="Posición Y"
              value={layout.name.y}
              min={0} max={CH - 60}
              onChange={v => updateName("y", v)}
            />
            <SliderRow
              label="Tamaño de fuente"
              value={layout.name.fontSize}
              min={16} max={70}
              onChange={v => updateName("fontSize", v)}
            />
            <ColorRow label="Color" value={layout.name.color} onChange={v => updateName("color", v)} />
            <FontRow  label="Fuente" value={layout.name.fontFamily} onChange={v => updateName("fontFamily", v)} />
            <SliderRow
              label="Espaciado de letras"
              value={layout.name.letterSpacing}
              min={-5} max={30}
              onChange={v => updateName("letterSpacing", v)}
            />
            <div className="border-t border-dojo-border/50 pt-2 space-y-2">
              <ToggleRow
                label="Sombra"
                checked={layout.name.shadowEnabled}
                onChange={v => updateName("shadowEnabled", v)}
              />
              {layout.name.shadowEnabled && (
                <>
                  <ColorRow
                    label="Color sombra"
                    value={layout.name.shadowColor}
                    onChange={v => updateName("shadowColor", v)}
                  />
                  <SliderRow
                    label="X sombra"
                    value={layout.name.shadowX}
                    min={-20} max={20}
                    onChange={v => updateName("shadowX", v)}
                  />
                  <SliderRow
                    label="Y sombra"
                    value={layout.name.shadowY}
                    min={-20} max={20}
                    onChange={v => updateName("shadowY", v)}
                  />
                  <SliderRow
                    label="Desenfoque"
                    value={layout.name.shadowBlur}
                    min={0} max={30}
                    onChange={v => updateName("shadowBlur", v)}
                  />
                </>
              )}
            </div>
            <div className="border-t border-dojo-border/50 pt-2 space-y-2">
              <ToggleRow
                label="Contorno"
                checked={layout.name.outlineEnabled}
                onChange={v => updateName("outlineEnabled", v)}
              />
              {layout.name.outlineEnabled && (
                <>
                  <ColorRow
                    label="Color contorno"
                    value={layout.name.outlineColor}
                    onChange={v => updateName("outlineColor", v)}
                  />
                  <SliderRow
                    label="Grosor"
                    value={layout.name.outlineWidth}
                    min={1} max={8}
                    onChange={v => updateName("outlineWidth", v)}
                  />
                </>
              )}
            </div>
          </CollapsibleSection>

          {/* 5. Línea de equipo */}
          <CollapsibleSection title="Línea de Equipo" icon={Palette}>
            <SliderRow
              label="Posición Y"
              value={layout.team.y}
              min={0} max={CH - 30}
              onChange={v => updateTeam("y", v)}
            />
            <ColorRow label="Color" value={layout.team.color} onChange={v => updateTeam("color", v)} />
          </CollapsibleSection>

          {/* 6. Zona QR */}
          <CollapsibleSection title="Zona QR" icon={CreditCard}>
            <SliderRow
              label="Posición Y (inicio)"
              value={layout.qr.y}
              min={200} max={800}
              onChange={v => updateQr("y", v)}
            />
            <SliderRow
              label="Altura"
              value={layout.qr.height}
              min={100} max={450}
              onChange={v => updateQr("height", v)}
            />
            <div className="border-t border-dojo-border/50 pt-2 space-y-2">
              <ToggleRow
                label="Marco del QR"
                checked={layout.qr.frameBorderWidth > 0}
                onChange={v => setLayout(prev => ({
                  ...prev,
                  qr: {
                    ...prev.qr,
                    frameBorderWidth: v ? (prev.qr.frameBorderWidth || 2) : 0,
                    frameBorderColor: prev.qr.frameBorderColor || "#CC0000",
                  },
                }))}
              />
              {layout.qr.frameBorderWidth > 0 && (
                <>
                  <SliderRow
                    label="Grosor"
                    value={layout.qr.frameBorderWidth}
                    min={1} max={8}
                    onChange={v => updateQr("frameBorderWidth", v)}
                  />
                  <ColorRow
                    label="Color del marco"
                    value={layout.qr.frameBorderColor || "#CC0000"}
                    onChange={v => updateQr("frameBorderColor", v)}
                  />
                </>
              )}
              <ToggleRow
                label="Fondo transparente"
                checked={layout.qr.bgTransparent}
                onChange={v => updateQr("bgTransparent", v)}
              />
            </div>
          </CollapsibleSection>

          {/* 7. Footer y Slogan */}
          <CollapsibleSection title="Footer y Slogan" icon={Palette}>
            <div className="space-y-1">
              <label className="text-xs text-dojo-muted block">Texto del slogan</label>
              <input
                type="text"
                value={layout.slogan.text}
                onChange={e => updateSlogan("text", e.target.value)}
                placeholder="(usa el slogan del dojo si está vacío)"
                className="form-input text-sm w-full"
              />
            </div>
            <SliderRow
              label="Inicio del footer"
              value={layout.footer.y}
              min={600} max={CH - 40}
              onChange={v => updateFooter("y", v)}
            />
            <ColorRow
              label="Color del fondo"
              value={layout.footer.background}
              onChange={v => updateFooter("background", v)}
            />
            <SliderRow
              label="Tamaño del slogan"
              value={layout.slogan.fontSize}
              min={9} max={24}
              onChange={v => updateSlogan("fontSize", v)}
            />
            <ColorRow
              label="Color del slogan"
              value={layout.slogan.color}
              onChange={v => updateSlogan("color", v)}
            />
            <FontRow
              label="Fuente del slogan"
              value={layout.slogan.fontFamily}
              onChange={v => updateSlogan("fontFamily", v)}
            />
          </CollapsibleSection>

          {/* 8. Acudiente / Contacto */}
          <CollapsibleSection title="Acudiente / Contacto" icon={Palette}>
            <ColorRow
              label="Color del texto"
              value={layout.contactColor}
              onChange={v => setLayout(prev => ({ ...prev, contactColor: v }))}
            />
          </CollapsibleSection>

          {/* Guardar */}
          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              <Save size={16} /> {saving ? "Guardando..." : "Guardar diseño"}
            </button>
            {saved && <span className="text-green-400 text-sm">¡Diseño guardado!</span>}
          </div>

          <div className="card bg-dojo-darker/50">
            <p className="text-xs text-dojo-muted leading-relaxed">
              <strong className="text-dojo-white">Nota:</strong> Estos cambios aplican únicamente a este dojo.
              Dojo Natsuki mantiene su diseño original sin cambios.
              Los cambios se verán reflejados en el carnet de cada alumno al regenerar la página de su carnet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
