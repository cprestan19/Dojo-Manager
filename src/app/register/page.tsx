"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Check, MessageCircle, Users, CreditCard,
  QrCode, Globe, Trophy, Video, ChevronRight, X,
} from "lucide-react";

const PRIMARY = "#C0392B";
const WA_SUPPORT = "https://wa.me/50766261768";

const COUNTRIES = [
  "Panamá","Costa Rica","México","Colombia","Venezuela",
  "República Dominicana","El Salvador","Bolivia","Guatemala",
  "Honduras","Nicaragua","Ecuador","Perú","Chile","Argentina","España","Otro",
];

/* ── Guía WhatsApp pre-escrita ─────────────────────────────── */
function buildWaGuide(senseiName: string, dojoName: string): string {
  const lines = [
    `🥋 *Guía rápida — Dojo Master*`,
    ``,
    `¡Hola ${senseiName}! Tu dojo *${dojoName}* ya está activo.`,
    ``,
    `*Primeros 3 pasos:*`,
    `1️⃣ Sube tu logo → Configuración → General`,
    `2️⃣ Agrega tus alumnos → Alumnos → Nuevo`,
    `3️⃣ Prueba el QR de asistencia → Menú → Scanner`,
    ``,
    `*📋 Plan Academia — tu primer mes es gratis:*`,
    `✓ Hasta 60 alumnos activos`,
    `✓ Asistencia QR solo con tu celular`,
    `✓ Cobros y recordatorios automáticos de mora`,
    `✓ Auto-registro de alumnos`,
    ``,
    `Al finalizar el mes gratis te llega el link de pago automáticamente por correo.`,
    ``,
    `*⬆️ ¿Cuándo subir de plan?*`,
    `• Portal de padres, carnet, diplomas y push → *Academia y padres $24.99/mes* (hasta 100)`,
    `• Torneos con streaming en vivo → *Academia, padres y Torneo $44.99/mes* (ilimitado)`,
    `  Incluye: página web, tienda, tatamis, jueces, overlay OBS, inscripciones federativas`,
    ``,
    `*🆘 Soporte:* wa.me/50766261768`,
  ];
  return encodeURIComponent(lines.join("\n"));
}

/* ── Componente principal ─────────────────────────────────── */
export default function RegisterPage() {
  const [step,        setStep]        = useState<"form" | "success">("form");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [successData, setSuccessData] = useState<{ senseiName: string; dojoName: string; email: string } | null>(null);

  const [form, setForm] = useState({
    senseiName:    "",
    dojoName:      "",
    country:       "Panamá",
    email:         "",
    phone:         "",
    studentCount:  "",
    yearsTeaching: "",
  });
  const [termsAccepted, setTermsAccepted] = useState(false);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!termsAccepted) {
      setError("Debes confirmar que eres mayor de edad y aceptar los Términos de Uso.");
      return;
    }
    if (!form.yearsTeaching) {
      setError("Indica cuántos años llevas enseñando karate.");
      return;
    }
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/public/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al registrarse"); return; }
      setSuccessData({ senseiName: form.senseiName, dojoName: form.dojoName, email: form.email });
      setStep("success");
    } catch {
      setError("Error de conexión. Verifica tu internet e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080C14", fontFamily: "'Nunito', sans-serif" }}>

      {/* Nav mínimo */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between" style={{ background: "rgba(8,12,20,0.9)" }}>
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Dojo Master" className="w-8 h-8 object-contain rounded-lg" />
          <span className="font-black text-white text-lg tracking-wide">Dojo Master</span>
        </Link>
        <Link href="/login" className="text-sm text-white/50 hover:text-white transition-colors font-semibold">
          Ya tengo cuenta →
        </Link>
      </nav>

      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-4xl">

          {step === "form" ? (
            <div className="grid md:grid-cols-2 gap-10 items-start">

              {/* ── Columna izquierda: beneficios ── */}
              <div className="space-y-6 md:sticky md:top-12">
                <div>
                  <p className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: PRIMARY }}>Registro gratuito</p>
                  <h1 className="font-black text-4xl text-white leading-tight" style={{ fontFamily: "'Cinzel', serif" }}>
                    Tu dojo en Dojo Master<br />en 2 minutos
                  </h1>
                  <p className="text-white/50 text-base mt-3 leading-relaxed">
                    Sin tarjeta de crédito. <strong className="text-white/70">Tu primer mes es gratis</strong> en cualquier plan.
                  </p>
                </div>

                {/* Qué incluye */}
                <div className="space-y-3">
                  {[
                    { icon: QrCode,        label: "Asistencia QR — solo tu celular, sin hardware" },
                    { icon: CreditCard,    label: "Cobros y recordatorios automáticos de mora" },
                    { icon: Users,         label: "Fichas completas de alumnos con historial" },
                    { icon: Video,         label: "Portal del alumno con videos de katas (Academia y padres)" },
                    { icon: Globe,         label: "Carnet digital (Academia y padres) · página web (Torneo)" },
                    { icon: Trophy,        label: "Torneos con streaming en vivo (plan Torneo)" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${PRIMARY}22` }}>
                        <Icon size={14} style={{ color: PRIMARY }} />
                      </div>
                      <p className="text-sm text-white/65">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Planes mini */}
                <div className="rounded-2xl p-4 space-y-2.5 border border-white/5" style={{ background: "#0D1117" }}>
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Planes disponibles — 1er mes gratis</p>
                  {[
                    { name: "🥋 Academia", limit: "Hasta 60 alumnos", price: "$14.99/mes", color: "#94A3B8" },
                    { name: "🥈 Academia y padres",  limit: "Hasta 100 alumnos + portal", price: "$24.99/mes", color: "#F59E0B" },
                    { name: "🥇 Academia, padres y Torneo",   limit: "Ilimitado + torneos Pro", price: "$44.99/mes", color: "#F59E0B" },
                  ].map(p => (
                    <div key={p.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm" style={{ color: p.color }}>{p.name}</span>
                        <span className="text-xs text-white/35">{p.limit}</span>
                      </div>
                      <span className="text-xs font-bold text-white/60">{p.price}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Columna derecha: formulario ── */}
              <div className="rounded-3xl p-8 border border-white/5" style={{ background: "#111827" }}>
                <h2 className="font-black text-xl text-white mb-6">Crea tu cuenta — 1 mes gratis</h2>

                {error && (
                  <div className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl border border-red-700/40 bg-red-900/20 text-red-300 text-sm">
                    <X size={14} className="shrink-0" /> {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-1.5">Nombre del Sensei *</label>
                    <input
                      value={form.senseiName} onChange={e => set("senseiName", e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 border border-white/10 focus:outline-none focus:border-white/30 transition-colors"
                      style={{ background: "#0D1117" }}
                      placeholder="Ej. Carlos Molina"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-1.5">Nombre del dojo *</label>
                    <input
                      value={form.dojoName} onChange={e => set("dojoName", e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 border border-white/10 focus:outline-none focus:border-white/30 transition-colors"
                      style={{ background: "#0D1117" }}
                      placeholder="Ej. Dojo Bushido"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-1.5">País *</label>
                      <select
                        value={form.country} onChange={e => set("country", e.target.value)}
                        className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30 transition-colors"
                        style={{ background: "#0D1117" }}
                      >
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-1.5">¿Cuántos alumnos?</label>
                      <select
                        value={form.studentCount} onChange={e => set("studentCount", e.target.value)}
                        className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30 transition-colors"
                        style={{ background: "#0D1117" }}
                      >
                        <option value="">Seleccionar</option>
                        <option value="1-60">1–60 (Plan Academia)</option>
                        <option value="61-100">61–100 (Plan Academia y padres)</option>
                        <option value="100+">Más de 100 (Plan Academia, padres y Torneo)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-1.5">Email *</label>
                    <input
                      type="email" value={form.email} onChange={e => set("email", e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 border border-white/10 focus:outline-none focus:border-white/30 transition-colors"
                      style={{ background: "#0D1117" }}
                      placeholder="sensei@midojo.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-1.5">WhatsApp *</label>
                    <input
                      type="tel" value={form.phone} onChange={e => set("phone", e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 border border-white/10 focus:outline-none focus:border-white/30 transition-colors"
                      style={{ background: "#0D1117" }}
                      placeholder="+507 6000-0000"
                      required
                    />
                    <p className="text-xs text-white/30 mt-1">Te enviaremos la guía de configuración aquí</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-1.5">¿Cuántos años llevas enseñando karate? *</label>
                    <select
                      value={form.yearsTeaching} onChange={e => set("yearsTeaching", e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30 transition-colors"
                      style={{ background: "#0D1117", color: form.yearsTeaching ? "white" : "rgba(255,255,255,0.25)" }}
                      required
                    >
                      <option value="" disabled>Seleccionar</option>
                      <option value="menos-1">Menos de 1 año</option>
                      <option value="1-3">1 a 3 años</option>
                      <option value="4-7">4 a 7 años</option>
                      <option value="8-15">8 a 15 años</option>
                      <option value="mas-15">Más de 15 años</option>
                    </select>
                  </div>

                  {/* Checkbox de mayoría de edad + términos */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={e => { setTermsAccepted(e.target.checked); setError(""); }}
                        className="sr-only"
                      />
                      <div
                        className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
                        style={{
                          background:   termsAccepted ? PRIMARY : "transparent",
                          borderColor:  termsAccepted ? PRIMARY : "rgba(255,255,255,0.2)",
                        }}
                      >
                        {termsAccepted && <Check size={12} color="white" strokeWidth={3} />}
                      </div>
                    </div>
                    <span className="text-xs text-white/45 leading-relaxed group-hover:text-white/60 transition-colors">
                      Confirmo que soy <strong className="text-white/65">mayor de edad</strong>, tengo un dojo de karate activo y acepto los{" "}
                      <a href="/terminos" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/80 transition-colors" style={{ color: PRIMARY }}>
                        Términos de Uso
                      </a>
                      {" "}y la{" "}
                      <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/80 transition-colors" style={{ color: PRIMARY }}>
                        Política de Privacidad
                      </a>
                      .
                    </span>
                  </label>

                  <button
                    type="submit" disabled={loading}
                    className="w-full py-4 rounded-2xl font-black text-white text-base transition-all hover:opacity-90 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    style={{ background: PRIMARY, boxShadow: `0 4px 24px ${PRIMARY}50` }}>
                    {loading ? "Creando tu cuenta..." : <>Crear cuenta — 1 mes gratis <ArrowRight size={16} className="inline ml-1" /></>}
                  </button>

                  <p className="text-center text-xs text-white/25">
                    Sin tarjeta de crédito · Cancela cuando quieras · Datos seguros
                  </p>
                </form>
              </div>
            </div>

          ) : (
            /* ── PANTALLA DE ÉXITO ── */
            <div className="max-w-lg mx-auto text-center">

              {/* Ícono éxito */}
              <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl" style={{ background: "#10B98122", border: "2px solid #10B98140" }}>
                🥋
              </div>

              <h1 className="font-black text-3xl text-white mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
                ¡Bienvenido, {successData?.senseiName}!
              </h1>
              <p className="text-white/50 mb-8 leading-relaxed">
                Tu dojo <strong className="text-white/80">{successData?.dojoName}</strong> ya está activo.<br />
                Revisa tu email <strong className="text-white/80">{successData?.email}</strong> — te enviamos las credenciales.
              </p>

              {/* Guía rápida visual */}
              <div className="rounded-2xl p-6 text-left mb-6 border border-white/5" style={{ background: "#111827" }}>
                <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">⚡ Primeros 3 pasos</p>
                <div className="space-y-4">
                  {[
                    { n: "1", title: "Sube tu logo", desc: "Configuración → General", color: "#3B82F6" },
                    { n: "2", title: "Agrega tus alumnos", desc: "Alumnos → Nuevo alumno", color: "#10B981" },
                    { n: "3", title: "Prueba el QR de asistencia", desc: "Menú lateral → Scanner QR (desde tu celular)", color: "#8B5CF6" },
                  ].map(s => (
                    <div key={s.n} className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white shrink-0" style={{ background: s.color+"22", color: s.color }}>
                        {s.n}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{s.title}</p>
                        <p className="text-xs text-white/40">{s.desc}</p>
                      </div>
                      <Check size={14} className="ml-auto shrink-0 text-white/20" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Mes gratis y plan actual */}
              <div className="rounded-2xl p-5 text-left mb-6 border" style={{ background: "#0D1117", borderColor: "#F59E0B30" }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#F59E0B" }}>🎁 Tu plan actual — Academia, primer mes gratis</p>
                <div className="space-y-2 mb-4">
                  {["Hasta 60 alumnos activos","Asistencia QR solo desde tu celular","Cobros y recordatorios automáticos de mora","Auto-registro de alumnos","Historial de cintas y rangos"].map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm text-white/65">
                      <Check size={12} className="text-emerald-400 shrink-0" />{f}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/50 border-t border-white/5 pt-3 mb-3">
                  Al finalizar tu primer mes te enviaremos automáticamente por correo el enlace de pago para continuar — no tienes que hacer nada ahora.
                </p>
                <div className="border-t border-white/5 pt-3 space-y-1.5">
                  <p className="text-xs text-white/40 font-bold uppercase tracking-wider mb-2">¿Cuándo subir de plan?</p>
                  <p className="text-xs text-white/50">
                    <span className="font-bold text-white/70">🥈 Academia y padres $24.99/mes</span> — Cuando quieras el <strong>portal de padres</strong>, carnet y diplomas digitales, eventos, reportes y notificaciones push (hasta 100 alumnos)
                  </p>
                  <p className="text-xs text-white/50">
                    <span className="font-bold text-white/70">🥇 Academia, padres y Torneo $44.99/mes</span> — Página web, tienda, torneos profesionales con <strong>streaming en vivo</strong>, tatamis, jueces, inscripciones federativas y alumnos ilimitados
                  </p>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="space-y-3">
                {/* Guardar guía en WhatsApp */}
                <a
                  href={`https://wa.me/?text=${buildWaGuide(successData?.senseiName ?? "", successData?.dojoName ?? "")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-bold text-white transition-all hover:opacity-90"
                  style={{ background: "#25D366", boxShadow: "0 4px 20px #25D36640" }}>
                  <MessageCircle size={20} fill="white" />
                  Guardar guía en mi WhatsApp
                </a>

                {/* Ir al panel */}
                <Link href="/login"
                  className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-bold text-white transition-all hover:opacity-90"
                  style={{ background: PRIMARY }}>
                  Entrar al panel <ChevronRight size={18} />
                </Link>

                {/* Soporte */}
                <a href={WA_SUPPORT} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 w-full py-3 rounded-2xl text-sm font-semibold text-white/50 hover:text-white transition-colors border border-white/10">
                  ¿Tienes dudas? Escríbenos →
                </a>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
