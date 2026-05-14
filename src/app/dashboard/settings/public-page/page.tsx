"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useDojo } from "@/lib/hooks/useDojo";
import {
  Globe, Eye, EyeOff, Copy, Check, Save, Image as ImageIcon,
  ExternalLink, X, Palette, ToggleLeft, ToggleRight,
} from "lucide-react";

interface PageData {
  id?:           string;
  published:     boolean;
  heroTitle:     string | null;
  heroSubtitle:  string | null;
  heroImage:     string | null;
  aboutText:     string | null;
  aboutImage:    string | null;
  primaryColor:  string;
  showFreeTrial: boolean;
  showSchedules: boolean;
  showContact:   boolean;
}

const DEFAULT: PageData = {
  published: false, heroTitle: null, heroSubtitle: null, heroImage: null,
  aboutText: null, aboutImage: null, primaryColor: "#C0392B",
  showFreeTrial: true, showSchedules: true, showContact: true,
};

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className="flex items-center gap-3 w-full py-2 text-sm text-left transition-colors">
      {value
        ? <ToggleRight size={22} className="text-dojo-red shrink-0" />
        : <ToggleLeft  size={22} className="text-dojo-muted shrink-0" />
      }
      <span className={value ? "text-dojo-white font-medium" : "text-dojo-muted"}>{label}</span>
    </button>
  );
}

export default function PublicPageSettings() {
  const dojo = useDojo();
  const [page,       setPage]       = useState<PageData>(DEFAULT);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [uploading,  setUploading]  = useState<"hero" | "about" | null>(null);
  const heroRef  = useRef<HTMLInputElement>(null);
  const aboutRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/dojo-page");
    if (r.ok) { const d = await r.json(); if (d) setPage(d); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const publicUrl = dojo?.slug ? `${window.location.origin}/dojo/${dojo.slug}` : "";

  async function uploadImage(file: File, field: "heroImage" | "aboutImage") {
    setUploading(field === "heroImage" ? "hero" : "about");
    const fd = new FormData();
    fd.append("file", file); fd.append("type", "image"); fd.append("purpose", "dojo-page");
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    if (r.ok) setPage(p => ({ ...p, [field]: j.url }));
    setUploading(null);
  }

  async function save() {
    setSaving(true); setSaved(false);
    const r = await fetch("/api/dojo-page", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(page),
    });
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  }

  async function togglePublish() {
    const next = { ...page, published: !page.published };
    setPage(next);
    await fetch("/api/dojo-page", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  function copyUrl() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div className="animate-pulse space-y-4 max-w-2xl">
      <div className="h-8 w-56 bg-dojo-border/60 rounded" />
      {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-dojo-border/40 rounded-xl" />)}
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-2">
          <Globe size={22} className="text-dojo-red" /> Página Pública
        </h1>
        <p className="text-dojo-muted text-sm mt-0.5">
          Configura la página de marketing de tu dojo
        </p>
      </div>

      {/* Estado + URL */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${page.published ? "bg-green-400 animate-pulse" : "bg-dojo-muted"}`} />
            <span className={`text-sm font-semibold ${page.published ? "text-green-400" : "text-dojo-muted"}`}>
              {page.published ? "Publicada — visible para el público" : "No publicada — solo tú la ves"}
            </span>
          </div>
          <button onClick={togglePublish}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              page.published
                ? "bg-dojo-border text-dojo-muted hover:text-red-400"
                : "bg-dojo-red text-white hover:opacity-90"
            }`}>
            {page.published ? <><EyeOff size={15}/> Despublicar</> : <><Eye size={15}/> Publicar</>}
          </button>
        </div>

        {dojo?.slug && (
          <div className="flex items-center gap-2 bg-dojo-darker rounded-lg px-3 py-2 border border-dojo-border/40">
            <span className="text-xs text-dojo-muted truncate flex-1">{publicUrl}</span>
            <button onClick={copyUrl} className="shrink-0 text-dojo-muted hover:text-dojo-white transition-colors">
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer"
              className="shrink-0 text-dojo-muted hover:text-dojo-white transition-colors">
              <ExternalLink size={14} />
            </a>
          </div>
        )}
      </div>

      {/* Sección Hero */}
      <div className="card space-y-4">
        <p className="text-xs font-bold text-dojo-white uppercase tracking-widest">Hero</p>

        <div>
          <label className="form-label">Título principal</label>
          <input value={page.heroTitle ?? ""} onChange={e => setPage(p => ({ ...p, heroTitle: e.target.value }))}
            className="form-input" placeholder={dojo?.name ?? "Nombre del dojo"} />
        </div>
        <div>
          <label className="form-label">Subtítulo</label>
          <input value={page.heroSubtitle ?? ""} onChange={e => setPage(p => ({ ...p, heroSubtitle: e.target.value }))}
            className="form-input" placeholder="Arte marcial · Disciplina · Vida" />
        </div>

        {/* Hero image */}
        <div>
          <label className="form-label">Imagen de fondo del hero</label>
          <div onClick={() => heroRef.current?.click()}
            className="relative cursor-pointer rounded-xl overflow-hidden border-2 border-dashed border-dojo-border hover:border-dojo-red transition-colors group"
            style={{ minHeight: "100px" }}>
            {page.heroImage
              ? <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={page.heroImage} alt="" className="w-full h-32 object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white text-sm font-semibold">Cambiar imagen</p>
                  </div>
                </>
              : <div className="flex flex-col items-center justify-center h-24 gap-2 text-dojo-muted group-hover:text-dojo-red transition-colors">
                  {uploading === "hero"
                    ? <div className="w-5 h-5 border-2 border-dojo-red border-t-transparent rounded-full animate-spin" />
                    : <><ImageIcon size={22}/><p className="text-xs">Clic para subir</p></>
                  }
                </div>
            }
          </div>
          <input ref={heroRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, "heroImage"); e.target.value = ""; }} />
          {page.heroImage && (
            <button onClick={() => setPage(p => ({ ...p, heroImage: null }))}
              className="mt-1 text-xs text-dojo-muted hover:text-red-400 flex items-center gap-1">
              <X size={10}/> Quitar imagen
            </button>
          )}
        </div>
      </div>

      {/* Sección Sobre nosotros */}
      <div className="card space-y-4">
        <p className="text-xs font-bold text-dojo-white uppercase tracking-widest">Sobre nosotros</p>
        <div>
          <label className="form-label">Texto (quiénes somos, historia, valores)</label>
          <textarea value={page.aboutText ?? ""} onChange={e => setPage(p => ({ ...p, aboutText: e.target.value }))}
            className="form-input min-h-[120px] resize-y" rows={5}
            placeholder="Somos un dojo dedicado a enseñar karate con valores de disciplina y respeto..." />
        </div>
        <div>
          <label className="form-label">Foto del dojo</label>
          <div onClick={() => aboutRef.current?.click()}
            className="relative cursor-pointer rounded-xl overflow-hidden border-2 border-dashed border-dojo-border hover:border-dojo-red transition-colors group"
            style={{ minHeight: "80px" }}>
            {page.aboutImage
              ? <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={page.aboutImage} alt="" className="w-full h-28 object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white text-sm font-semibold">Cambiar foto</p>
                  </div>
                </>
              : <div className="flex flex-col items-center justify-center h-20 gap-1 text-dojo-muted group-hover:text-dojo-red transition-colors">
                  {uploading === "about"
                    ? <div className="w-5 h-5 border-2 border-dojo-red border-t-transparent rounded-full animate-spin" />
                    : <><ImageIcon size={20}/><p className="text-xs">Clic para subir</p></>
                  }
                </div>
            }
          </div>
          <input ref={aboutRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, "aboutImage"); e.target.value = ""; }} />
          {page.aboutImage && (
            <button onClick={() => setPage(p => ({ ...p, aboutImage: null }))}
              className="mt-1 text-xs text-dojo-muted hover:text-red-400 flex items-center gap-1">
              <X size={10}/> Quitar foto
            </button>
          )}
        </div>
      </div>

      {/* Color de acento */}
      <div className="card space-y-3">
        <p className="text-xs font-bold text-dojo-white uppercase tracking-widest flex items-center gap-2">
          <Palette size={13} /> Color de acento
        </p>
        <div className="flex items-center gap-3">
          <input type="color" value={page.primaryColor}
            onChange={e => setPage(p => ({ ...p, primaryColor: e.target.value }))}
            className="w-10 h-10 rounded-lg cursor-pointer border border-dojo-border bg-transparent" />
          <input value={page.primaryColor}
            onChange={e => setPage(p => ({ ...p, primaryColor: e.target.value }))}
            className="form-input font-mono" placeholder="#C0392B" maxLength={7} style={{ maxWidth: "140px" }} />
          <div className="flex gap-2">
            {["#C0392B","#DC2626","#0044CC","#059669","#7C3AED","#D97706"].map(c => (
              <button key={c} onClick={() => setPage(p => ({ ...p, primaryColor: c }))}
                className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                style={{ backgroundColor: c, borderColor: page.primaryColor === c ? "#fff" : "transparent" }} />
            ))}
          </div>
        </div>
      </div>

      {/* Secciones visibles */}
      <div className="card space-y-1">
        <p className="text-xs font-bold text-dojo-white uppercase tracking-widest mb-3">Secciones visibles</p>
        <Toggle value={page.showSchedules}  onChange={v => setPage(p => ({ ...p, showSchedules: v }))}  label="Mostrar horarios de clases" />
        <Toggle value={page.showFreeTrial}  onChange={v => setPage(p => ({ ...p, showFreeTrial: v }))}  label="Mostrar formulario de clase gratuita" />
        <Toggle value={page.showContact}    onChange={v => setPage(p => ({ ...p, showContact: v }))}    label="Mostrar sección de contacto" />
      </div>

      {/* Guardar */}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="btn-primary">
          {saving ? "Guardando..." : saved ? <><Check size={16}/> Guardado</> : <><Save size={16}/> Guardar cambios</>}
        </button>
        {dojo?.slug && (
          <a href={`/dojo/${dojo.slug}`} target="_blank" rel="noopener noreferrer"
            className="btn-secondary text-sm">
            <ExternalLink size={15}/> Ver página
          </a>
        )}
      </div>
    </div>
  );
}
