"use client";
import { useState, useEffect, useRef } from "react";
import { ImageIcon, Upload, Save, Trash2, Loader2, CheckCircle } from "lucide-react";
import Image from "next/image";

export function PlatformBrandingForm() {
  const [logo,       setLogo]       = useState<string | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [loading,    setLoading]    = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/superadmin/platform-settings")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setLogo(data.logo ?? null); })
      .finally(() => setLoading(false));
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("El archivo supera 2 MB"); return; }
    setUploadError(""); setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file",    file);
      fd.append("type",    "image");
      fd.append("purpose", "platform-logo");
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) setLogo(data.url);
      else        setUploadError(data.error ?? "Error al subir el logo");
    } catch {
      setUploadError("Error de conexión al subir el logo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    setSaving(true); setSaved(false);
    const res = await fetch("/api/superadmin/platform-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logo }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-dojo-muted">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
          <ImageIcon size={28} className="text-dojo-red" /> Logo de la Plataforma
        </h1>
        <p className="text-dojo-muted text-sm mt-1">
          Logo por defecto de Dojo Master — se usa en la página principal, el login sin dojo asociado,
          y en los dojos que aún no subieron su propio logo. No afecta a los dojos que ya tienen el suyo.
        </p>
      </div>

      <div className="card space-y-6">
        <h2 className="text-dojo-white font-semibold text-lg border-b border-dojo-border pb-3 flex items-center gap-2">
          <ImageIcon size={18} className="text-dojo-red" /> Logo por defecto
        </h2>

        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/10 overflow-hidden flex-shrink-0 border border-dojo-border">
            {logo ? (
              <Image src={logo} alt="Logo de la plataforma" width={96} height={96} className="object-contain w-full h-full" unoptimized />
            ) : (
              <Image src="/logo.png" alt="Logo actual (por defecto)" width={96} height={96} className="object-contain w-full h-full" />
            )}
          </div>

          <div className="space-y-2 flex-1">
            <button
              onClick={() => !uploading && fileRef.current?.click()}
              disabled={uploading}
              className="btn-secondary flex items-center gap-2 w-full justify-center disabled:opacity-60"
            >
              {uploading
                ? <><Loader2 size={16} className="animate-spin" /> Subiendo a Cloudinary...</>
                : <><Upload size={16} /> Subir imagen (PNG, JPG, WebP)</>
              }
            </button>
            {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
            {logo && !uploading && (
              <button onClick={() => setLogo(null)} className="btn-ghost text-red-400 hover:text-red-300 flex items-center gap-2 w-full justify-center text-sm">
                <Trash2 size={14} /> Quitar y usar el logo por defecto de fábrica
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
            <p className="text-xs text-dojo-muted">Recomendado: cuadrado, mínimo 512×512 px · Máximo 2 MB</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {saved
            ? <><CheckCircle size={16} /> Guardado</>
            : <><Save size={16} /> {saving ? "Guardando..." : "Guardar"}</>
          }
        </button>
      </div>
    </div>
  );
}
