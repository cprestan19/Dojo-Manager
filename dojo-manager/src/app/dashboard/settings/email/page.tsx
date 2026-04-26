"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Mail, Save, Server, Lock, Eye, EyeOff,
  Send, CheckCircle, AlertTriangle, ShieldCheck,
} from "lucide-react";

interface Cfg {
  host:         string;
  port:         number;
  user:         string;
  password:     string;
  securityType: "ssl" | "starttls" | "none";
  fromName:     string;
}

const SECURITY_OPTIONS = [
  { value: "starttls", label: "STARTTLS (recomendado — puerto 587)", port: 587, secure: false },
  { value: "ssl",      label: "SSL / TLS (puerto 465)",              port: 465, secure: true  },
  { value: "none",     label: "Sin seguridad (puerto 25)",            port: 25,  secure: false },
] as const;

type SecurityType = typeof SECURITY_OPTIONS[number]["value"];

function secureFromType(type: SecurityType): boolean {
  return SECURITY_OPTIONS.find(o => o.value === type)?.secure ?? false;
}

export default function EmailSettingsPage() {
  const { data: session } = useSession();
  const router             = useRouter();
  const role               = (session?.user as { role?: string })?.role;

  const [cfg,      setCfg]      = useState<Cfg>({
    host: "", port: 587, user: "", password: "",
    securityType: "starttls", fromName: "DojoManager",
  });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [saveErr,  setSaveErr]  = useState("");
  const [showPass, setShowPass] = useState(false);
  const [testTo,   setTestTo]   = useState("");
  const [testing,  setTesting]  = useState(false);
  const [testMsg,  setTestMsg]  = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (role === undefined) return;
    if (role !== "sysadmin" && role !== "admin") { router.replace("/dashboard"); return; }

    fetch("/api/admin/email-settings")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          const secType: SecurityType = d.secure ? "ssl" : (d.port === 25 ? "none" : "starttls");
          setCfg({
            host:         d.host        ?? "",
            port:         d.port        ?? 587,
            user:         d.user        ?? "",
            password:     d.password    ?? "",
            securityType: secType,
            fromName:     d.fromName    ?? "DojoManager",
          });
        }
      })
      .finally(() => setLoading(false));
  }, [role, router]);

  function handleSecurityChange(type: SecurityType) {
    const opt = SECURITY_OPTIONS.find(o => o.value === type)!;
    setCfg(p => ({ ...p, securityType: type, port: opt.port }));
  }

  async function handleSave() {
    setSaving(true); setSaved(false); setSaveErr("");
    const r = await fetch("/api/admin/email-settings", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        host:     cfg.host,
        port:     cfg.port,
        user:     cfg.user,
        password: cfg.password,
        secure:   secureFromType(cfg.securityType),
        fromName: cfg.fromName,
      }),
    });
    const d = await r.json();
    setSaving(false);
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else setSaveErr(d.error ?? "Error al guardar");
  }

  async function handleTest() {
    if (!testTo) return;
    setTesting(true); setTestMsg(null);
    const r = await fetch("/api/admin/email-settings/test", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ to: testTo }),
    });
    const d = await r.json();
    setTesting(false);
    setTestMsg(r.ok
      ? { ok: true,  text: `Correo de prueba enviado correctamente a ${testTo}` }
      : { ok: false, text: d.error ?? "Error al enviar" }
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-dojo-muted">Cargando configuración...</p>
      </div>
    );
  }

  if (role !== "sysadmin" && role !== "admin") return null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
          <Mail size={26} className="text-dojo-red shrink-0" /> Parámetros de Correo
        </h1>
        <p className="text-dojo-muted text-sm mt-1">
          Configura el servidor SMTP para el envío de recordatorios, recibos y notificaciones.
        </p>
      </div>

      {/* Remitente */}
      <div className="card space-y-4">
        <h2 className="text-dojo-white font-semibold border-b border-dojo-border pb-3 flex items-center gap-2">
          <Mail size={16} className="text-dojo-red" /> Correo de envío
        </h2>

        <div className="space-y-1.5">
          <label className="form-label">Correo electrónico (FROM)</label>
          <input
            type="email"
            value={cfg.user}
            onChange={e => setCfg(p => ({ ...p, user: e.target.value }))}
            className="form-input"
            placeholder="correo@midojo.com"
            style={{ fontSize: "16px" }}
          />
          <p className="text-xs text-dojo-muted">
            Este correo aparecerá como remitente en todos los mensajes enviados.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="form-label">Nombre del remitente</label>
          <input
            value={cfg.fromName}
            onChange={e => setCfg(p => ({ ...p, fromName: e.target.value }))}
            className="form-input"
            placeholder="Ej. Dojo Natsuki"
            style={{ fontSize: "16px" }}
          />
        </div>
      </div>

      {/* Servidor SMTP */}
      <div className="card space-y-4">
        <h2 className="text-dojo-white font-semibold border-b border-dojo-border pb-3 flex items-center gap-2">
          <Server size={16} className="text-dojo-red" /> Servidor SMTP
        </h2>

        <div className="space-y-1.5">
          <label className="form-label">Tipo de seguridad</label>
          <div className="grid grid-cols-1 gap-2">
            {SECURITY_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  cfg.securityType === opt.value
                    ? "border-dojo-red bg-dojo-red/10"
                    : "border-dojo-border bg-dojo-dark hover:border-dojo-border/80"
                }`}
              >
                <input
                  type="radio"
                  name="securityType"
                  value={opt.value}
                  checked={cfg.securityType === opt.value}
                  onChange={() => handleSecurityChange(opt.value as SecurityType)}
                  className="accent-dojo-red"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dojo-white">{opt.label}</p>
                </div>
                <ShieldCheck
                  size={15}
                  className={opt.secure ? "text-green-400" : "text-dojo-muted"}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="form-label">Servidor SMTP</label>
            <input
              value={cfg.host}
              onChange={e => setCfg(p => ({ ...p, host: e.target.value }))}
              className="form-input"
              placeholder="smtp.gmail.com"
              style={{ fontSize: "16px" }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="form-label">Puerto</label>
            <input
              type="number"
              value={cfg.port}
              onChange={e => setCfg(p => ({ ...p, port: Number(e.target.value) }))}
              className="form-input"
              style={{ fontSize: "16px" }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="form-label">Contraseña / Clave de aplicación</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
            <input
              type={showPass ? "text" : "password"}
              value={cfg.password}
              onChange={e => setCfg(p => ({ ...p, password: e.target.value }))}
              className="form-input pl-9 pr-10"
              placeholder="••••••••••••"
              style={{ fontSize: "16px" }}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dojo-muted hover:text-dojo-white"
            >
              {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
            </button>
          </div>
          <p className="text-xs text-dojo-muted">
            Para Gmail: genera una <strong className="text-dojo-white">Contraseña de Aplicación</strong> en tu cuenta Google
            (Seguridad → Verificación en 2 pasos → Contraseñas de aplicación).
          </p>
        </div>
      </div>

      {/* Guardar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <Save size={16} /> {saving ? "Guardando..." : "Guardar configuración"}
        </button>
        {saved   && <span className="text-green-400 text-sm flex items-center gap-1"><CheckCircle size={14}/> Guardado</span>}
        {saveErr && <span className="text-red-400 text-sm">{saveErr}</span>}
      </div>

      {/* Probar envío */}
      <div className="card space-y-4">
        <h2 className="text-dojo-white font-semibold border-b border-dojo-border pb-3 flex items-center gap-2">
          <Send size={16} className="text-dojo-red" /> Probar envío de correo
        </h2>
        <p className="text-dojo-muted text-sm">
          Guarda primero la configuración, luego envía un correo de prueba para verificar que todo funciona.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={testTo}
            onChange={e => setTestTo(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleTest(); }}
            className="form-input flex-1"
            placeholder="destinatario@email.com"
            style={{ fontSize: "16px" }}
          />
          <button
            onClick={handleTest}
            disabled={testing || !testTo.trim()}
            className="btn-secondary whitespace-nowrap disabled:opacity-50 flex items-center gap-2 justify-center"
          >
            <Send size={14}/> {testing ? "Enviando..." : "Enviar prueba"}
          </button>
        </div>
        {testMsg && (
          <div className={`flex items-start gap-2 p-3 rounded-lg ${
            testMsg.ok
              ? "bg-green-900/20 border border-green-800/40"
              : "bg-red-900/20 border border-red-800/40"
          }`}>
            {testMsg.ok
              ? <CheckCircle size={15} className="text-green-400 shrink-0 mt-0.5"/>
              : <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5"/>
            }
            <p className={`text-sm break-all ${testMsg.ok ? "text-green-300" : "text-red-300"}`}>
              {testMsg.text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
