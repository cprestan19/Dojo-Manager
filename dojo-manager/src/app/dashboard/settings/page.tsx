/**
 * Página: Configuración del Dojo
 * Desarrollado por Cristhian Paul Prestán — 2025
 */
"use client";
import { useState, useEffect, useRef } from "react";
import { Settings, Upload, Save, Eye, Globe, Trash2, Building2, Phone, User, MessageSquare, Bell, Clock, Percent, ImageIcon, Mail, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import type { DojoInfo } from "@/lib/hooks/useDojo";

interface DojoOption { id: string; name: string; slug: string }

export default function SettingsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;

  // Selector de dojo para sysadmin
  const [dojoList,     setDojoList]     = useState<DojoOption[]>([]);
  const [selectedId,   setSelectedId]   = useState<string>("");

  // Formulario
  const [dojo,    setDojo]    = useState<DojoInfo | null>(null);
  const [name,    setName]    = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone,   setPhone]   = useState("");
  const [slogan,  setSlogan]  = useState("");
  const [email,   setEmail]   = useState("");
  const [logo,          setLogo]          = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError,     setLogoError]     = useState("");
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [loading,       setLoading]       = useState(true);

  // Parámetros de recordatorios
  const [toleranceDays,        setToleranceDays]        = useState(5);
  const [interestPct,          setInterestPct]          = useState(10);
  const [autoRemindersEnabled, setAutoRemindersEnabled] = useState(false);
  const [loginBgImage,    setLoginBgImage]    = useState<string | null>(null);
  const [bgUploading,     setBgUploading]     = useState(false);
  const [bgError,         setBgError]         = useState("");
  const [savingBg,        setSavingBg]        = useState(false);
  const [bgSaved,         setBgSaved]         = useState(false);
  const fileRef   = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);

  // Cargar lista de dojos para sysadmin
  useEffect(() => {
    if (role !== "sysadmin") return;
    fetch("/api/dojos")
      .then(r => r.ok ? r.json() : [])
      .then((list: DojoOption[]) => {
        setDojoList(list);
        if (list.length > 0) setSelectedId(list[0].id);
      });
  }, [role]);

  // Cargar config del dojo
  useEffect(() => {
    const targetId = role === "sysadmin" ? selectedId : null;
    if (role === "sysadmin" && !selectedId) { setLoading(false); return; }

    setLoading(true);
    const url = targetId ? `/api/dojo?id=${targetId}&logo=1` : "/api/dojo?logo=1";
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setDojo(data);
          setName(data.name ?? "");
          setEmail(data.email ?? "");
          setOwnerName(data.ownerName ?? "");
          setPhone(data.phone ?? "");
          setSlogan(data.slogan ?? "");
          setLogo(data.logo ?? null);
          setToleranceDays(data.reminderToleranceDays ?? 5);
          setInterestPct(data.lateInterestPct ?? 10);
          setAutoRemindersEnabled(data.autoRemindersEnabled ?? false);
          setLoginBgImage(data.loginBgImage ?? null);
        }
        setLoading(false);
      });
  }, [role, selectedId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("El archivo supera 2 MB"); return; }
    setLogoError(""); setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file",    file);
      fd.append("type",    "image");
      fd.append("purpose", "dojo-logo");
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) setLogo(data.url);
      else        setLogoError(data.error ?? "Error al subir el logo");
    } catch {
      setLogoError("Error de conexión al subir el logo");
    } finally {
      setLogoUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    setSaving(true); setSaved(false);
    const url = role === "sysadmin" && selectedId ? `/api/dojo?id=${selectedId}` : "/api/dojo";
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, email, ownerName, phone, slogan, logo,
        reminderToleranceDays: toleranceDays,
        lateInterestPct:       interestPct,
        autoRemindersEnabled,
      }),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  }

  async function handleSaveBg() {
    setSavingBg(true); setBgSaved(false);
    const url = role === "sysadmin" && selectedId ? `/api/dojo?id=${selectedId}` : "/api/dojo";
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginBgImage }),
    });
    if (res.ok) { setBgSaved(true); setTimeout(() => setBgSaved(false), 3000); }
    setSavingBg(false);
  }

  async function handleBgFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("El archivo supera 5 MB"); return; }
    setBgError(""); setBgUploading(true);
    try {
      const fd = new FormData();
      fd.append("file",    file);
      fd.append("type",    "image");
      fd.append("purpose", "login-bg");
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) setLoginBgImage(data.url);
      else        setBgError(data.error ?? "Error al subir la imagen");
    } catch {
      setBgError("Error de conexión al subir la imagen");
    } finally {
      setBgUploading(false);
      if (bgFileRef.current) bgFileRef.current.value = "";
    }
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
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
          <Settings size={28} className="text-dojo-red" /> Configuración
        </h1>
        <p className="text-dojo-muted text-sm mt-1">Personaliza la identidad visual y datos de tu dojo</p>
      </div>

      {/* Selector de dojo (solo sysadmin) */}
      {role === "sysadmin" && (
        <div className="card">
          <label className="form-label mb-2 block">Seleccionar Dojo a configurar</label>
          {dojoList.length === 0 ? (
            <p className="text-dojo-muted text-sm">No hay dojos creados. <a href="/dashboard/dojos" className="text-dojo-gold underline">Crear un dojo</a></p>
          ) : (
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="form-input"
            >
              {dojoList.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.slug})</option>
              ))}
            </select>
          )}
        </div>
      )}

      {(!dojo && role !== "sysadmin") && (
        <div className="card text-center py-10">
          <p className="text-dojo-muted">No se encontró configuración del dojo. Contacta al administrador.</p>
        </div>
      )}

      {(dojo || (role === "sysadmin" && selectedId)) && (
        <>
          {/* Logo */}
          <div className="card space-y-6">
            <h2 className="text-dojo-white font-semibold text-lg border-b border-dojo-border pb-3 flex items-center gap-2">
              <Eye size={18} className="text-dojo-red" /> Identidad Visual
            </h2>

            <div className="space-y-3">
              <label className="form-label">Logo del Dojo</label>
              <p className="text-dojo-muted text-xs">
                Aparece en la pantalla de login, reportes y correos.
                URL de login: <span className="text-dojo-gold font-mono">/login?dojo={dojo?.slug ?? "..."}</span>
              </p>

              <div className="flex items-center gap-6">
                {/* Preview */}
                <div className="w-24 h-24 bg-dojo-red rounded-2xl flex items-center justify-center shadow-lg shadow-dojo-red/30 overflow-hidden flex-shrink-0">
                  {logo ? (
                    <Image src={logo} alt="Logo" width={96} height={96} className="object-contain w-full h-full" />
                  ) : (
                    <span className="text-white text-3xl font-display font-bold">
                      {name?.[0]?.toUpperCase() ?? "D"}
                    </span>
                  )}
                </div>

                <div className="space-y-2 flex-1">
                  <button
                    onClick={() => !logoUploading && fileRef.current?.click()}
                    disabled={logoUploading}
                    className="btn-secondary flex items-center gap-2 w-full justify-center disabled:opacity-60"
                  >
                    {logoUploading
                      ? <><Loader2 size={16} className="animate-spin" /> Subiendo a Cloudinary...</>
                      : <><Upload size={16} /> Subir imagen (PNG, JPG, SVG)</>
                    }
                  </button>
                  {logoError && <p className="text-xs text-red-400">{logoError}</p>}
                  {logo && !logoUploading && (
                    <button onClick={() => setLogo(null)} className="btn-ghost text-red-400 hover:text-red-300 flex items-center gap-2 w-full justify-center text-sm">
                      <Trash2 size={14} /> Eliminar logo
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={handleFileChange} />
                  <p className="text-xs text-dojo-muted">Recomendado: 200×200 px · Máximo 2 MB</p>
                </div>
              </div>

              {/* Vista previa del login */}
              <div className="mt-4 space-y-1">
                <label className="form-label text-xs">Vista previa — Pantalla de Login</label>
                <div className="bg-dojo-darker border border-dojo-border rounded-xl p-5 flex flex-col items-center gap-2">
                  <div className="w-14 h-14 bg-dojo-red rounded-xl flex items-center justify-center overflow-hidden shadow">
                    {logo
                      ? <Image src={logo} alt="preview" width={56} height={56} className="object-contain w-full h-full" />
                      : <span className="text-white font-display font-bold text-lg">{name?.[0]?.toUpperCase() ?? "D"}</span>
                    }
                  </div>
                  <p className="font-display text-dojo-white font-bold tracking-widest text-sm">{name.toUpperCase() || "NOMBRE DOJO"}</p>
                  <p className="font-display text-dojo-gold tracking-widest text-xs">DOJO MASTER</p>
                  {slogan && <p className="text-dojo-muted text-xs italic">{slogan}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Datos del dojo */}
          <div className="card space-y-5">
            <h2 className="text-dojo-white font-semibold text-lg border-b border-dojo-border pb-3 flex items-center gap-2">
              <Building2 size={18} className="text-dojo-red" /> Datos del Dojo
            </h2>

            <div className="space-y-2">
              <label className="form-label">Nombre del Dojo</label>
              <div className="relative">
                <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className="form-input pl-9" placeholder="Ej. Dojo Shotokan Guadalajara" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="form-label">Correo del Dojo (FROM en emails)</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="form-input pl-9" placeholder="dojo@miescuela.com" />
              </div>
              <p className="text-xs text-dojo-muted">Los recordatorios y recibos se enviarán desde este correo.</p>
            </div>

            <div className="space-y-2">
              <label className="form-label">Nombre del Propietario</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
                <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                  className="form-input pl-9" placeholder="Ej. Sensei Juan Ramírez" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="form-label">Teléfono del Dojo</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className="form-input pl-9" placeholder="Ej. +52 33 1234 5678" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="form-label">Eslogan del Dojo</label>
              <div className="relative">
                <MessageSquare size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
                <input type="text" value={slogan} onChange={e => setSlogan(e.target.value)}
                  className="form-input pl-9" placeholder="Ej. Disciplina, Respeto y Karate" />
              </div>
            </div>

            {/* URL de acceso */}
            <div className="space-y-2">
              <label className="form-label">URL de acceso al login</label>
              <div className="flex items-center gap-2 bg-dojo-darker border border-dojo-border rounded-lg px-3 py-2">
                <Globe size={14} className="text-dojo-muted flex-shrink-0" />
                <span className="text-dojo-muted text-sm">/login?dojo=</span>
                <span className="text-dojo-gold text-sm font-mono">{dojo?.slug ?? "..."}</span>
              </div>
              <p className="text-dojo-muted text-xs">Comparte esta URL con los usuarios del dojo para que vean el logo personalizado.</p>
            </div>
          </div>

          {/* Parámetros de recordatorios */}
          <div className="card space-y-5">
            <h2 className="text-dojo-white font-semibold text-lg border-b border-dojo-border pb-3 flex items-center gap-2">
              <Bell size={18} className="text-dojo-red" /> Parámetros de Recordatorios de Pago
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="form-label flex items-center gap-2">
                  <Clock size={13} className="text-dojo-muted" /> Días de tolerancia para atraso
                </label>
                <div className="relative">
                  <input
                    type="number" min={1} max={30} value={toleranceDays}
                    onChange={e => setToleranceDays(Number(e.target.value))}
                    className="form-input pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dojo-muted text-sm">días</span>
                </div>
                <p className="text-xs text-dojo-muted">
                  Días máximos después del vencimiento antes de catalogar el pago como atrasado.
                </p>
              </div>

              <div className="space-y-2">
                <label className="form-label flex items-center gap-2">
                  <Percent size={13} className="text-dojo-muted" /> Porcentaje de recargo por atraso
                </label>
                <div className="relative">
                  <input
                    type="number" min={0} max={100} step={0.5} value={interestPct}
                    onChange={e => setInterestPct(Number(e.target.value))}
                    className="form-input pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dojo-muted text-sm">%</span>
                </div>
                <p className="text-xs text-dojo-muted">
                  Se menciona en los correos como recargo aplicable sobre la mensualidad.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-dojo-dark rounded-lg border border-dojo-border">
              <input
                type="checkbox"
                id="autoReminders"
                checked={autoRemindersEnabled}
                onChange={e => setAutoRemindersEnabled(e.target.checked)}
                className="w-4 h-4 accent-dojo-red mt-0.5 shrink-0"
              />
              <div>
                <label htmlFor="autoReminders" className="text-sm text-dojo-white font-medium cursor-pointer">
                  Activar envío automático de recordatorios
                </label>
                <p className="text-xs text-dojo-muted mt-1">
                  Cuando está activo, el sistema envía correos automáticamente a los acudientes
                  cuyos pagos superen los días de tolerancia configurados.
                </p>
              </div>
            </div>

            {autoRemindersEnabled && (
              <div className="flex items-start gap-2 p-3 bg-yellow-900/20 border border-yellow-800/40 rounded-lg">
                <Bell size={14} className="text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-xs text-yellow-300">
                  Los recordatorios automáticos se enviarán a pagos con más de <strong>{toleranceDays} día(s)</strong> de atraso
                  y se aplicará un recargo de <strong>{interestPct}%</strong> indicado en el correo.
                </p>
              </div>
            )}
          </div>

          {/* Imagen de fondo del login */}
          <div className="card space-y-5">
            <h2 className="text-dojo-white font-semibold text-lg border-b border-dojo-border pb-3 flex items-center gap-2">
              <ImageIcon size={18} className="text-dojo-red" /> Personalización del Login
            </h2>
            <div>
              <label className="form-label">Imagen de fondo del Login</label>
              <p className="text-dojo-muted text-xs mb-4">
                Esta imagen se mostrará como fondo en la pantalla de inicio de sesión en dispositivos móviles.
              </p>
              <div className="flex gap-6 items-start">
                <div
                  className="w-[100px] h-[175px] rounded-xl border-2 border-dojo-border overflow-hidden shrink-0 flex items-center justify-center"
                  style={loginBgImage ? {
                    backgroundImage: `url(${loginBgImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  } : { backgroundColor: "#0F0F1A" }}
                >
                  {!loginBgImage && (
                    <div className="flex flex-col items-center gap-1 text-dojo-muted/40">
                      <ImageIcon size={20} />
                      <span className="text-[10px]">Sin imagen</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <button
                    onClick={() => !bgUploading && bgFileRef.current?.click()}
                    disabled={bgUploading}
                    className="btn-secondary flex items-center gap-2 w-full justify-center disabled:opacity-60"
                  >
                    {bgUploading
                      ? <><Loader2 size={16} className="animate-spin" /> Subiendo a Cloudinary...</>
                      : <><Upload size={16} /> Subir imagen (JPG, PNG, WEBP)</>
                    }
                  </button>
                  {bgError && <p className="text-xs text-red-400">{bgError}</p>}
                  {loginBgImage && !bgUploading && (
                    <button
                      onClick={() => setLoginBgImage(null)}
                      className="btn-ghost text-red-400 hover:text-red-300 flex items-center gap-2 w-full justify-center text-sm"
                    >
                      <Trash2 size={14} /> Eliminar imagen
                    </button>
                  )}
                  <input ref={bgFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBgFileChange} />
                  <p className="text-xs text-dojo-muted">Recomendado: 800×1400 px · Máximo 5 MB</p>
                  <button
                    onClick={handleSaveBg}
                    disabled={savingBg}
                    className="btn-primary flex items-center gap-2 w-full justify-center mt-2"
                  >
                    <Save size={15} /> {savingBg ? "Guardando..." : "Guardar imagen"}
                  </button>
                  {bgSaved && <p className="text-green-400 text-xs text-center">¡Imagen guardada!</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Guardar */}
          <div className="flex items-center gap-4">
            <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary flex items-center gap-2">
              <Save size={16} />
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            {saved && <span className="text-green-400 text-sm">¡Cambios guardados correctamente!</span>}
          </div>
        </>
      )}
    </div>
  );
}
