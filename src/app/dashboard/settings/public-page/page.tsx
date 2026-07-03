"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useDojo } from "@/lib/hooks/useDojo";
import {
  Globe, Eye, EyeOff, Copy, Check, Save, Image as ImageIcon,
  ExternalLink, X, Palette, ToggleLeft, ToggleRight, MapPin, Plus, Building2, Loader2,
} from "lucide-react";

interface OrgItem { id: string; name: string; logoUrl: string | null; order: number }

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
  showStore:     boolean;
  address:       string | null;
  galleryImages: string[];
  stats:         { value: string; label: string }[];
  testimonials:  { name: string; role: string; quote: string; photo: string }[];
  sensei:        { name: string; rank: string; experience: string; bio: string; photo: string } | null;
}

const DEFAULT: PageData = {
  published: false, heroTitle: null, heroSubtitle: null, heroImage: null,
  aboutText: null, aboutImage: null, primaryColor: "#C0392B",
  showFreeTrial: true, showSchedules: true, showContact: true, showStore: false,
  address: null, galleryImages: [], stats: [], testimonials: [], sensei: null,
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
  const [saveError,  setSaveError]  = useState("");
  const [copied,     setCopied]     = useState(false);
  const [uploading,  setUploading]  = useState<"hero" | "about" | "gallery" | "sensei" | `testimonial-${number}` | `org-logo-${number}` | null>(null);
  const heroRef    = useRef<HTMLInputElement>(null);
  const aboutRef   = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Organizaciones
  const [orgs,         setOrgs]         = useState<OrgItem[]>([]);
  const [newOrgName,   setNewOrgName]   = useState("");
  const [addingOrg,    setAddingOrg]    = useState(false);

  const loadOrgs = useCallback(async () => {
    const r = await fetch("/api/dojo-organizations");
    if (r.ok) setOrgs(await r.json());
  }, []);

  async function addOrg() {
    if (!newOrgName.trim()) return;
    setAddingOrg(true);
    const r = await fetch("/api/dojo-organizations", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: newOrgName.trim(), order: orgs.length }),
    });
    if (r.ok) { const org = await r.json(); setOrgs(p => [...p, org]); setNewOrgName(""); }
    setAddingOrg(false);
  }

  async function deleteOrg(id: string) {
    await fetch(`/api/dojo-organizations/${id}`, { method: "DELETE" });
    setOrgs(p => p.filter(o => o.id !== id));
  }

  async function uploadOrgLogo(orgId: string, idx: number, file: File) {
    setUploading(`org-logo-${idx}`);
    const fd = new FormData(); fd.append("file", file); fd.append("type", "image"); fd.append("purpose", "org-logo");
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    if (r.ok) {
      await fetch(`/api/dojo-organizations/${orgId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ logoUrl: j.url }),
      });
      setOrgs(p => p.map(o => o.id === orgId ? { ...o, logoUrl: j.url } : o));
    }
    setUploading(null);
  }

  const load = useCallback(async () => {
    const r = await fetch("/api/dojo-page");
    if (r.ok) {
      const d = await r.json();
      if (d) setPage({
      ...DEFAULT, ...d,
      galleryImages: Array.isArray(d.galleryImages) ? d.galleryImages : [],
      stats:         Array.isArray(d.stats)         ? d.stats         : [],
      testimonials:  Array.isArray(d.testimonials)  ? d.testimonials  : [],
      sensei:        d.sensei && typeof d.sensei === "object" && !Array.isArray(d.sensei) ? d.sensei : null,
    });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); loadOrgs(); }, [load, loadOrgs]);

  const publicUrl = dojo?.slug ? `${window.location.origin}/dojo/${dojo.slug}` : "";

  async function uploadGalleryImage(file: File) {
    setUploading("gallery");
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("type", "image"); fd.append("purpose", "dojo-gallery");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (r.ok) setPage(p => ({ ...p, galleryImages: [...p.galleryImages, j.url] }));
    } finally { setUploading(null); }
  }

  function removeGalleryImage(idx: number) {
    setPage(p => ({ ...p, galleryImages: p.galleryImages.filter((_, i) => i !== idx) }));
  }

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
    setSaving(true); setSaved(false); setSaveError("");
    try {
      const r = await fetch("/api/dojo-page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(page),
      });
      if (r.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 4000);
      } else {
        const j = await r.json().catch(() => ({}));
        setSaveError(j.error ?? "Error al guardar. Intenta de nuevo.");
      }
    } catch {
      setSaveError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
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
    navigator.clipboard?.writeText(publicUrl).catch(() => {});
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
            <a href={`${publicUrl}?preview=1`} target="_blank" rel="noopener noreferrer"
              className="shrink-0 text-dojo-muted hover:text-dojo-white transition-colors"
              title="Ver vista previa">
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
        <Toggle value={page.showStore}      onChange={v => setPage(p => ({ ...p, showStore: v }))}      label="Mostrar tienda (catálogo de productos)" />
      </div>

      {/* Ubicación */}
      <div className="card space-y-3">
        <p className="text-xs font-bold text-dojo-white uppercase tracking-widest">Ubicación</p>
        <div>
          <label className="form-label">Dirección física del dojo</label>
          <input value={page.address ?? ""}
            onChange={e => setPage(p => ({ ...p, address: e.target.value || null }))}
            className="form-input"
            placeholder="Av. Principal, Local 5, Ciudad de Panamá" />
          <p className="text-xs text-dojo-muted mt-1">
            Se muestra un botón "Ver en Google Maps" con esta dirección.
          </p>
        </div>
      </div>

      {/* Galería de atletas */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-dojo-white uppercase tracking-widest">Galería de Atletas</p>
          <span className="text-xs text-dojo-muted">{page.galleryImages.length}/12 fotos</span>
        </div>

        {/* Grid de imágenes subidas */}
        {page.galleryImages.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {page.galleryImages.map((url, idx) => (
              <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeGalleryImage(idx)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center
                             opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-red-600">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Botón agregar */}
        {page.galleryImages.length < 12 && (
          <div>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-dojo-border hover:border-dojo-red transition-colors text-sm text-dojo-muted hover:text-dojo-red">
              {uploading === "gallery"
                ? <div className="w-4 h-4 border-2 border-dojo-red border-t-transparent rounded-full animate-spin" />
                : <><ImageIcon size={16} /> Agregar fotos de atletas</>
              }
            </button>
            <input
              ref={galleryRef}
              type="file" accept="image/*" multiple className="hidden"
              onChange={e => {
                const files = Array.from(e.target.files ?? []).slice(0, 12 - page.galleryImages.length);
                files.forEach(f => uploadGalleryImage(f));
                e.target.value = "";
              }}
            />
            <p className="text-xs text-dojo-muted mt-1.5">
              Sube fotos de entrenamientos, competencias o atletas. Máx. 12 imágenes. Se muestran en galería tipo mosaico.
            </p>
          </div>
        )}
      </div>

      {/* Perfil del Sensei */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-dojo-white uppercase tracking-widest">Perfil del Sensei</p>
          {page.sensei
            ? <button onClick={() => setPage(p => ({ ...p, sensei: null }))}
                className="text-xs text-dojo-muted hover:text-red-400 flex items-center gap-1 transition-colors">
                <X size={12}/> Quitar perfil
              </button>
            : <button onClick={() => setPage(p => ({ ...p, sensei: { name:"", rank:"", experience:"", bio:"", photo:"" } }))}
                className="btn-secondary text-xs px-3 py-1.5">
                <Plus size={13}/> Agregar Sensei
              </button>
          }
        </div>

        {!page.sensei ? (
          <p className="text-xs text-dojo-muted">
            Agrega el perfil del maestro para generar confianza en los visitantes. Aparece entre "Sobre nosotros" y "Horarios".
          </p>
        ) : (
          <div className="space-y-4">
            {/* Foto */}
            <div className="flex items-start gap-4">
              <div>
                <label className="form-label">Foto</label>
                <div onClick={() => {
                  const input = document.getElementById("sensei-photo-input") as HTMLInputElement;
                  input?.click();
                }}
                  className="w-24 h-24 rounded-full overflow-hidden cursor-pointer border-2 border-dashed border-dojo-border hover:border-dojo-red transition-colors flex items-center justify-center group">
                  {page.sensei.photo
                    ? // eslint-disable-next-line @next/next/no-img-element
                      <img src={page.sensei.photo} alt="" className="w-full h-full object-cover" />
                    : <div className="flex flex-col items-center gap-1 text-dojo-muted group-hover:text-dojo-red transition-colors">
                        {uploading === "sensei" ? <div className="w-4 h-4 border-2 border-dojo-red border-t-transparent rounded-full animate-spin"/> : <><ImageIcon size={18}/><span className="text-[9px]">Foto</span></>}
                      </div>
                  }
                </div>
                <input id="sensei-photo-input" type="file" accept="image/*" className="hidden"
                  onChange={async e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setUploading("sensei" as "hero");
                    const fd = new FormData(); fd.append("file",f); fd.append("type","image"); fd.append("purpose","sensei-photo");
                    const r = await fetch("/api/upload",{method:"POST",body:fd}); const j = await r.json();
                    if (r.ok) setPage(p => p.sensei ? ({ ...p, sensei: { ...p.sensei!, photo:j.url } }) : p);
                    setUploading(null); e.target.value="";
                  }} />
                {page.sensei.photo && (
                  <button onClick={() => setPage(p => p.sensei ? ({ ...p, sensei: { ...p.sensei!, photo:"" } }) : p)}
                    className="mt-1 text-[10px] text-dojo-muted hover:text-red-400 flex items-center gap-1 mx-auto">
                    <X size={9}/> Quitar
                  </button>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <label className="form-label">Nombre completo *</label>
                  <input value={page.sensei.name}
                    onChange={e => setPage(p => p.sensei ? ({ ...p, sensei: { ...p.sensei!, name:e.target.value } }) : p)}
                    className="form-input" placeholder="Sensei Carlos López" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Grado / Rango *</label>
                    <input value={page.sensei.rank}
                      onChange={e => setPage(p => p.sensei ? ({ ...p, sensei: { ...p.sensei!, rank:e.target.value } }) : p)}
                      className="form-input" placeholder="Cinturón Negro 5° Dan" />
                  </div>
                  <div>
                    <label className="form-label">Experiencia</label>
                    <input value={page.sensei.experience}
                      onChange={e => setPage(p => p.sensei ? ({ ...p, sensei: { ...p.sensei!, experience:e.target.value } }) : p)}
                      className="form-input" placeholder="25 años de experiencia" />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label className="form-label">Biografía / Descripción</label>
              <textarea value={page.sensei.bio}
                onChange={e => setPage(p => p.sensei ? ({ ...p, sensei: { ...p.sensei!, bio:e.target.value } }) : p)}
                className="form-input resize-y" rows={4}
                placeholder="Historia, logros, filosofía de enseñanza, federaciones, campeonatos..." />
            </div>
          </div>
        )}
      </div>

      {/* Estadísticas del Hero */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-dojo-white uppercase tracking-widest">Estadísticas</p>
          <span className="text-xs text-dojo-muted">{page.stats.length}/4</span>
        </div>
        <p className="text-xs text-dojo-muted">Aparecen debajo del hero. Ej: "150+ Alumnos", "10 Años de experiencia"</p>
        <div className="space-y-2">
          {page.stats.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input value={s.value} onChange={e => setPage(p => ({ ...p, stats: p.stats.map((x,j) => j===i ? {...x, value:e.target.value} : x) }))}
                className="form-input w-24 text-center font-bold" placeholder="150+" />
              <input value={s.label} onChange={e => setPage(p => ({ ...p, stats: p.stats.map((x,j) => j===i ? {...x, label:e.target.value} : x) }))}
                className="form-input flex-1" placeholder="Alumnos formados" />
              <button onClick={() => setPage(p => ({ ...p, stats: p.stats.filter((_,j) => j!==i) }))}
                className="btn-ghost p-1.5 text-dojo-muted hover:text-red-400 shrink-0"><X size={14}/></button>
            </div>
          ))}
        </div>
        {page.stats.length < 4 && (
          <button onClick={() => setPage(p => ({ ...p, stats: [...p.stats, { value:"", label:"" }] }))}
            className="btn-secondary text-sm w-full"><Plus size={14}/> Agregar estadística</button>
        )}
      </div>

      {/* Testimonios */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-dojo-white uppercase tracking-widest">Testimonios de Alumnos</p>
          <span className="text-xs text-dojo-muted">{page.testimonials.length}/6</span>
        </div>
        <div className="space-y-4">
          {page.testimonials.map((t, i) => (
            <div key={i} className="p-4 rounded-xl border border-dojo-border/40 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-dojo-muted font-semibold">Testimonio {i+1}</p>
                <button onClick={() => setPage(p => ({ ...p, testimonials: p.testimonials.filter((_,j) => j!==i) }))}
                  className="text-dojo-muted hover:text-red-400 transition-colors"><X size={14}/></button>
              </div>
              <textarea value={t.quote}
                onChange={e => setPage(p => ({ ...p, testimonials: p.testimonials.map((x,j) => j===i ? {...x, quote:e.target.value} : x) }))}
                className="form-input resize-none w-full" rows={2}
                placeholder='"Llevo 2 años y mi hijo cambió completamente..."' />
              <div className="grid grid-cols-2 gap-2">
                <input value={t.name}
                  onChange={e => setPage(p => ({ ...p, testimonials: p.testimonials.map((x,j) => j===i ? {...x, name:e.target.value} : x) }))}
                  className="form-input text-sm" placeholder="Nombre del alumno" />
                <input value={t.role}
                  onChange={e => setPage(p => ({ ...p, testimonials: p.testimonials.map((x,j) => j===i ? {...x, role:e.target.value} : x) }))}
                  className="form-input text-sm" placeholder="Cinta Negra · 3 años" />
              </div>
              {/* Foto opcional */}
              <div className="flex items-center gap-3">
                {t.photo
                  ? <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                      <button onClick={() => setPage(p => ({ ...p, testimonials: p.testimonials.map((x,j) => j===i ? {...x, photo:""} : x) }))}
                        className="text-xs text-dojo-muted hover:text-red-400 flex items-center gap-1"><X size={10}/> Quitar</button>
                    </div>
                  : <label className="flex items-center gap-2 cursor-pointer text-xs text-dojo-muted hover:text-dojo-red transition-colors">
                      <ImageIcon size={14}/>
                      {uploading === `testimonial-${i}` ? "Subiendo..." : "Foto (opcional)"}
                      <input type="file" accept="image/*" className="hidden" onChange={async e => {
                        const f = e.target.files?.[0]; if (!f) return;
                        setUploading(`testimonial-${i}`);
                        const fd = new FormData(); fd.append("file",f); fd.append("type","image"); fd.append("purpose","testimonial");
                        const r = await fetch("/api/upload",{method:"POST",body:fd}); const j = await r.json();
                        if (r.ok) setPage(p => ({ ...p, testimonials: p.testimonials.map((x,k) => k===i ? {...x, photo:j.url} : x) }));
                        setUploading(null); e.target.value="";
                      }} />
                    </label>
                }
              </div>
            </div>
          ))}
        </div>
        {page.testimonials.length < 6 && (
          <button onClick={() => setPage(p => ({ ...p, testimonials: [...p.testimonials, { name:"", role:"", quote:"", photo:"" }] }))}
            className="btn-secondary text-sm w-full"><Plus size={14}/> Agregar testimonio</button>
        )}
      </div>

      {/* Organizaciones */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-dojo-red" />
          <p className="text-xs font-bold text-dojo-white uppercase tracking-widest">Organizaciones / Federaciones</p>
        </div>
        <p className="text-xs text-dojo-muted">
          Federaciones o asociaciones a las que pertenece el dojo. Se muestran como logos en la página pública.
        </p>

        {/* Lista existente */}
        {orgs.length > 0 && (
          <div className="space-y-2">
            {orgs.map((org, idx) => (
              <div key={org.id} className="flex items-center gap-3 p-3 rounded-xl border border-dojo-border/40 bg-dojo-darker/40">
                {/* Logo */}
                <label className="cursor-pointer shrink-0" title="Cambiar logo">
                  {org.logoUrl
                    ? // eslint-disable-next-line @next/next/no-img-element
                      <img src={org.logoUrl} alt={org.name} className="h-10 w-14 object-contain rounded" />
                    : <div className="h-10 w-14 rounded border border-dashed border-dojo-border flex items-center justify-center text-dojo-muted hover:text-dojo-red transition-colors">
                        {uploading === `org-logo-${idx}` ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                      </div>
                  }
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadOrgLogo(org.id, idx, f); e.target.value = ""; }} />
                </label>
                <span className="flex-1 text-sm text-dojo-white font-medium truncate">{org.name}</span>
                <button onClick={() => deleteOrg(org.id)} className="shrink-0 text-dojo-muted hover:text-red-400 transition-colors">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Agregar nueva */}
        <div className="flex gap-2">
          <input
            value={newOrgName}
            onChange={e => setNewOrgName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addOrg(); } }}
            className="form-input flex-1 text-sm"
            placeholder="FEPAKA, WKF, Ryo-Bukai..."
          />
          <button onClick={addOrg} disabled={addingOrg || !newOrgName.trim()} className="btn-secondary text-sm shrink-0">
            {addingOrg ? <Loader2 size={14} className="animate-spin" /> : <><Plus size={14}/> Agregar</>}
          </button>
        </div>
        <p className="text-xs text-dojo-muted">Agrega el nombre primero, luego sube el logo haciendo clic en el espacio gris.</p>
      </div>

      {/* Guardar */}
      <div className="space-y-3">
        {/* Banner de éxito */}
        {saved && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-600/50 bg-green-900/30 text-green-300 text-sm font-semibold">
            <Check size={16} className="text-green-400 shrink-0" />
            ¡Cambios guardados correctamente! La página pública ya está actualizada.
          </div>
        )}
        {/* Banner de error */}
        {saveError && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-700/40 bg-red-900/20 text-red-300 text-sm">
            <X size={16} className="text-red-400 shrink-0" />
            {saveError}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving || saved}
            className={`btn-primary transition-all ${saved ? "opacity-90" : ""}`}
            style={saved ? { background: "#16A34A" } : undefined}>
            {saving ? "Guardando..." : saved ? <><Check size={16}/> ¡Guardado!</> : <><Save size={16}/> Guardar cambios</>}
          </button>
          {dojo?.slug && (
            <a href={`/dojo/${dojo.slug}?preview=1`} target="_blank" rel="noopener noreferrer"
              className="btn-secondary text-sm">
              <ExternalLink size={15}/> Ver vista previa
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
