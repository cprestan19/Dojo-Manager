"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Users, CreditCard, ClipboardList, Award, Trophy, Calendar,
  Globe, BarChart2, QrCode, Shield, Star, Check, ChevronDown,
  MessageCircle, ArrowRight, Zap, Clock, X, Menu,
  Smartphone, Monitor, Play, Gift,
} from "lucide-react";

/* ── Animación scroll-reveal ─────────────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className={className}
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}>
      {children}
    </div>
  );
}

/* ── Mockup del Dashboard (CSS puro) ────────────────────── */
function DashboardMockup() {
  return (
    <div className="relative w-full max-w-[680px] mx-auto select-none">
      {/* Laptop frame */}
      <div className="rounded-2xl overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.7)]"
        style={{ border: "2px solid #2A3447", background: "#111827" }}>
        {/* Browser bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10"
          style={{ background: "#1A2233" }}>
          <div className="flex gap-1.5">
            {["#EF4444","#F59E0B","#10B981"].map(c => (
              <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />
            ))}
          </div>
          <div className="flex-1 mx-3 rounded-md px-3 py-1 text-[10px] text-white/30"
            style={{ background: "#0B0F14" }}>
            app.dojomaster.com/dashboard
          </div>
        </div>
        {/* Dashboard content */}
        <div className="flex" style={{ height: "340px", background: "#0B0F14" }}>
          {/* Sidebar */}
          <div className="w-[130px] shrink-0 flex flex-col gap-1 p-3 border-r border-white/5"
            style={{ background: "#111827" }}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-6 h-6 rounded-lg" style={{ background: "#C0392B" }} />
              <div className="h-2 w-16 rounded" style={{ background: "#E5E7EB20" }} />
            </div>
            {[["#C0392B",true],["",false],["",false],["",false],["",false],["",false]].map(([c, active], i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                style={{ background: active ? (c as string)+"22" : "transparent" }}>
                <div className="w-3 h-3 rounded" style={{ background: active ? c as string : "#374151" }} />
                <div className="h-1.5 rounded flex-1" style={{ background: active ? "#E5E7EB40" : "#374151" }} />
              </div>
            ))}
          </div>
          {/* Main */}
          <div className="flex-1 p-4 overflow-hidden space-y-3">
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-2">
              {[["#10B981","87"],["#3B82F6","$2,340"],["#F59E0B","3"]].map(([color, val], i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: "#1A2233", border: `1px solid ${color}30` }}>
                  <div className="w-5 h-5 rounded-lg mb-2" style={{ background: color+"25" }}>
                    <div className="w-full h-full rounded-lg" style={{ background: color+"60" }} />
                  </div>
                  <div className="text-white font-bold text-sm">{val}</div>
                  <div className="h-1.5 w-12 rounded mt-1" style={{ background: "#374151" }} />
                </div>
              ))}
            </div>
            {/* Chart */}
            <div className="rounded-xl p-3" style={{ background: "#1A2233" }}>
              <div className="h-1.5 w-24 rounded mb-3" style={{ background: "#374151" }} />
              <div className="flex items-end gap-1 h-14">
                {[40,65,55,80,70,90,75].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i === 5 ? "#C0392B" : "#C0392B33" }} />
                ))}
              </div>
            </div>
            {/* Table rows */}
            <div className="rounded-xl overflow-hidden" style={{ background: "#1A2233" }}>
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                  <div className="w-6 h-6 rounded-full" style={{ background: "#C0392B33" }} />
                  <div className="flex-1 space-y-1">
                    <div className="h-1.5 rounded w-20" style={{ background: "#374151" }} />
                    <div className="h-1 rounded w-14" style={{ background: "#2A3447" }} />
                  </div>
                  <div className="h-4 w-10 rounded-full" style={{ background: "#10B98120" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Laptop base */}
      <div className="mx-auto h-4 rounded-b-xl" style={{ width: "88%", background: "#1A2233" }} />
      <div className="mx-auto h-2 rounded-b-2xl" style={{ width: "70%", background: "#0F172A" }} />

      {/* Phone floating */}
      <div className="absolute -right-6 bottom-4 w-[110px] rounded-[22px] overflow-hidden shadow-2xl"
        style={{ border: "2px solid #2A3447", background: "#111827" }}>
        <div className="h-5 flex items-center justify-center border-b border-white/10" style={{ background: "#1A2233" }}>
          <div className="w-10 h-1.5 rounded-full" style={{ background: "#374151" }} />
        </div>
        <div className="p-2 space-y-1.5" style={{ background: "#0B0F14", minHeight: "180px" }}>
          <div className="h-1.5 w-14 rounded mx-auto" style={{ background: "#C0392B" }} />
          {[1,2,3].map(i => (
            <div key={i} className="rounded-xl p-2" style={{ background: "#1A2233" }}>
              <div className="h-1 rounded w-full mb-1" style={{ background: "#374151" }} />
              <div className="h-1 rounded w-10" style={{ background: "#2A3447" }} />
            </div>
          ))}
          <div className="rounded-xl p-2 text-center" style={{ background: "#C0392B22", border: "1px solid #C0392B40" }}>
            <div className="h-1.5 rounded w-12 mx-auto" style={{ background: "#C0392B60" }} />
          </div>
        </div>
        <div className="h-4 flex items-center justify-center" style={{ background: "#1A2233" }}>
          <div className="w-6 h-1 rounded-full" style={{ background: "#374151" }} />
        </div>
      </div>
    </div>
  );
}

/* ── Data ────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Users, color: "#3B82F6",
    title: "Gestión de Alumnos",
    desc: "Fichas completas con foto, historial de cintas, pagos y asistencia. Busca, filtra y exporta en segundos.",
    stat: "Todo en una pantalla",
  },
  {
    icon: CreditCard, color: "#10B981",
    title: "Cobros y Recordatorios",
    desc: "Genera mensualidades con un clic. Recordatorios automáticos por email. Nunca más perseguir pagos.",
    stat: "Ahorra 5 hrs/semana",
  },
  {
    icon: QrCode, color: "#8B5CF6",
    title: "Asistencia con QR",
    desc: "Cada alumno tiene su QR único. El scanner registra la entrada en menos de 1 segundo desde cualquier celular.",
    stat: "Sin papel, sin demoras",
  },
  {
    icon: Trophy, color: "#F59E0B",
    title: "Torneos Completos",
    desc: "Crea brackets de Kumite y Kata automáticamente. Registra scores, determina ganadores y genera el podio.",
    stat: "Kumite + Kata",
  },
  {
    icon: Globe, color: "#C0392B",
    title: "Tu Dojo en Internet",
    desc: "Página pública con tu información, horarios, fotos y formulario de clase gratuita. Lista en 5 minutos.",
    stat: "Sin costo adicional",
  },
];

const MODULES = [
  { icon: Users,        label: "Alumnos"      },
  { icon: CreditCard,   label: "Pagos"        },
  { icon: ClipboardList,label: "Asistencia"   },
  { icon: Award,        label: "Cintas"       },
  { icon: Trophy,       label: "Torneos"      },
  { icon: Calendar,     label: "Eventos"      },
  { icon: Globe,        label: "Página web"   },
  { icon: BarChart2,    label: "Reportes"     },
  { icon: QrCode,       label: "Scanner QR"   },
  { icon: Smartphone,   label: "Portal alumno"},
  { icon: Shield,       label: "Roles y accesos"},
  { icon: Star,         label: "Temas visuales"},
];

const PRICING = [
  {
    name: "Gratis",
    price: "$0",
    period: "para siempre",
    color: "#6B7280",
    highlight: false,
    features: [
      "Hasta 30 alumnos",
      "Gestión básica de alumnos",
      "Control de asistencia QR",
      "1 usuario administrador",
      "Soporte por email",
    ],
    missing: ["Torneos","Página pública","Prospectos","Reportes avanzados"],
    cta: "Empieza gratis",
  },
  {
    name: "Starter",
    price: "$29",
    period: "/mes  ·  $290/año",
    color: "#C0392B",
    highlight: true,
    badge: "Más popular",
    features: [
      "Hasta 150 alumnos",
      "Todos los módulos incluidos",
      "Torneos Kumite y Kata",
      "Página pública del dojo",
      "CRM de prospectos",
      "5 usuarios administradores",
      "Soporte prioritario",
    ],
    missing: [],
    cta: "Empieza ahora",
  },
  {
    name: "Pro",
    price: "$59",
    period: "/mes  ·  $590/año",
    color: "#F39C12",
    highlight: false,
    features: [
      "Alumnos ilimitados",
      "Todo de Starter incluido",
      "Usuarios ilimitados",
      "Multi-sede (próximamente)",
      "Soporte prioritario 24/7",
    ],
    missing: [],
    cta: "Empieza ahora",
  },
];

const FAQS = [
  {
    q: "¿Funciona desde el celular?",
    a: "Sí. El panel de administración es completamente responsive. El portal del alumno está optimizado para móvil y puede instalarse como app.",
  },
  {
    q: "¿Cuánto tiempo toma configurarlo?",
    a: "La configuración básica (logo, nombre, primeros alumnos) toma menos de 10 minutos. Puedes tener tu primer QR de asistencia listo el mismo día.",
  },
  {
    q: "¿Puedo importar mis alumnos actuales?",
    a: "Sí. Podemos ayudarte a importar tu lista desde Excel o Google Sheets. El equipo de soporte te guía en el proceso.",
  },
  {
    q: "¿Qué pasa con mis datos si cancelo?",
    a: "Tus datos son tuyos. Puedes exportar toda la información en cualquier momento en formato CSV antes de cancelar.",
  },
  {
    q: "¿Es seguro? ¿Dónde se guardan los datos?",
    a: "Los datos se almacenan en servidores PostgreSQL con cifrado. Las imágenes van a Cloudinary (CDN global). Cada dojo tiene sus datos completamente aislados de los demás.",
  },
];

/* ── Componente principal ────────────────────────────────── */
export default function LandingPage() {
  const [navOpen,     setNavOpen]     = useState(false);
  const [openFaq,     setOpenFaq]     = useState<number | null>(null);
  const [count,       setCount]       = useState(0);

  // Animación contador de dojos
  useEffect(() => {
    const target = 47;
    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      setCount(current);
      if (current >= target) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, []);

  const WA = "https://wa.me/50760000000?text=Hola!%20Quiero%20saber%20m%C3%A1s%20sobre%20Dojo%20Master";

  return (
    <div className="min-h-screen text-white" style={{ background: "#080C14", fontFamily: "'Nunito', sans-serif" }}>

      {/* ──────────────────── NAV ──────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5"
        style={{ background: "rgba(8,12,20,0.9)", backdropFilter: "blur(16px)" }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
              style={{ background: "#C0392B" }}>
              DM
            </div>
            <span className="font-black text-lg tracking-wide">Dojo Master</span>
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
            {[["Características","#caracteristicas"],["Precios","#precios"],["FAQ","#faq"]].map(([l,h]) => (
              <a key={l} href={h} className="hover:text-white transition-colors">{l}</a>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors">
              Iniciar sesión
            </Link>
            <a href={WA} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ background: "#C0392B" }}>
              Empieza gratis <ArrowRight size={14} />
            </a>
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setNavOpen(o => !o)} className="md:hidden p-2 text-white/70">
            {navOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {navOpen && (
          <div className="md:hidden border-t border-white/10 px-4 py-4 space-y-3"
            style={{ background: "#080C14" }}>
            {[["Características","#caracteristicas"],["Precios","#precios"],["FAQ","#faq"]].map(([l,h]) => (
              <a key={l} href={h} onClick={() => setNavOpen(false)}
                className="block py-2 text-white/70 hover:text-white text-sm">{l}</a>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <Link href="/login" className="text-center py-2.5 rounded-xl border border-white/10 text-sm text-white/70">
                Iniciar sesión
              </Link>
              <a href={WA} target="_blank" rel="noopener noreferrer"
                className="text-center py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: "#C0392B" }}>
                Empieza gratis
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* ──────────────────── HERO ──────────────────── */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* BG glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(ellipse, #C0392B 0%, transparent 70%)" }} />
        </div>

        <div className="max-w-6xl mx-auto relative">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm"
              style={{ borderColor: "#C0392B40", background: "#C0392B12" }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#C0392B" }} />
              <span className="text-white/70"><span style={{ color: "#C0392B" }} className="font-bold">{count}+ dojos</span> ya gestionan con Dojo Master</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-center font-black leading-none mb-6"
            style={{ fontSize: "clamp(2.5rem, 7vw, 5.5rem)", fontFamily: "'Cinzel', serif" }}>
            Tu dojo,{" "}
            <span style={{ color: "#C0392B" }}>sin el caos</span>
          </h1>
          <p className="text-center text-white/60 max-w-2xl mx-auto mb-10"
            style={{ fontSize: "clamp(1rem, 2.5vw, 1.25rem)", lineHeight: 1.6 }}>
            Gestiona alumnos, cobros, asistencia y torneos desde un solo lugar.
            Tu dojo en internet en menos de 10 minutos.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap justify-center gap-4 mb-16">
            <a href={WA} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg text-white transition-all hover:scale-105 shadow-lg"
              style={{ background: "#C0392B", boxShadow: "0 8px 32px #C0392B55" }}>
              <Gift size={20} /> Empieza gratis — es gratis
            </a>
            <a href="#caracteristicas"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg border border-white/15 hover:border-white/30 transition-all">
              <Play size={18} /> Ver características
            </a>
          </div>

          {/* Dashboard mockup */}
          <div className="flex justify-center">
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ──────────────────── TRUST BAR ──────────────────── */}
      <div className="border-y border-white/5 py-6 px-4" style={{ background: "#0D1117" }}>
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8 text-white/30 text-sm">
          {["🇵🇦 Panamá","🇨🇷 Costa Rica","🇲🇽 México","🇨🇴 Colombia","🇻🇪 Venezuela"].map(c => (
            <span key={c} className="font-semibold">{c}</span>
          ))}
        </div>
      </div>

      {/* ──────────────────── PROBLEMA / SOLUCIÓN ──────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p className="text-center text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#C0392B" }}>
              ¿Te reconoces?
            </p>
            <h2 className="text-center font-black text-4xl md:text-5xl mb-16" style={{ fontFamily: "'Cinzel', serif" }}>
              Del caos al control
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Problemas */}
            <Reveal delay={100}>
              <div className="rounded-2xl p-6 space-y-3 h-full" style={{ background: "#0D1117", border: "1px solid #EF444420" }}>
                <p className="font-bold text-red-400 text-sm uppercase tracking-wider mb-4">Antes</p>
                {[
                  "Lista de alumnos en Excel que nadie actualiza",
                  "Cobros por WhatsApp, nunca sabes quién debe",
                  "Asistencia en papel que se pierde",
                  "Sin página web — pierdes prospectos a diario",
                  "Torneos organizados con hojas sueltas",
                  "3 apps distintas para gestionar el dojo",
                ].map(p => (
                  <div key={p} className="flex items-start gap-3 text-white/50 text-sm">
                    <X size={15} className="text-red-400 shrink-0 mt-0.5" />
                    {p}
                  </div>
                ))}
              </div>
            </Reveal>

            {/* Soluciones */}
            <Reveal delay={200}>
              <div className="rounded-2xl p-6 space-y-3 h-full" style={{ background: "#0D1117", border: "1px solid #10B98120" }}>
                <p className="font-bold text-emerald-400 text-sm uppercase tracking-wider mb-4">Con Dojo Master</p>
                {[
                  "Fichas completas con foto, cinta y pagos",
                  "Cobros automáticos y recordatorios por email",
                  "Scanner QR — asistencia en 1 segundo",
                  "Página pública lista en 5 minutos",
                  "Brackets automáticos de Kumite y Kata",
                  "Todo en un solo lugar, desde el celular",
                ].map(s => (
                  <div key={s} className="flex items-start gap-3 text-white/80 text-sm">
                    <Check size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                    {s}
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ──────────────────── FEATURES ──────────────────── */}
      <section id="caracteristicas" className="py-24 px-4" style={{ background: "#0D1117" }}>
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p className="text-center text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#C0392B" }}>
              Características
            </p>
            <h2 className="text-center font-black text-4xl md:text-5xl mb-4" style={{ fontFamily: "'Cinzel', serif" }}>
              Todo lo que necesitas
            </h2>
            <p className="text-center text-white/50 text-lg mb-16 max-w-xl mx-auto">
              No es un software genérico de gimnasio. Está construido específicamente para artes marciales.
            </p>
          </Reveal>

          <div className="space-y-16">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              const even = i % 2 === 0;
              return (
                <Reveal key={f.title} delay={100}>
                  <div className={`flex flex-col ${even ? "md:flex-row" : "md:flex-row-reverse"} items-center gap-10`}>
                    {/* Text */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: f.color + "22" }}>
                          <Icon size={20} style={{ color: f.color }} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: f.color }}>
                          {f.stat}
                        </span>
                      </div>
                      <h3 className="text-2xl font-black" style={{ fontFamily: "'Cinzel', serif" }}>{f.title}</h3>
                      <p className="text-white/60 text-lg leading-relaxed">{f.desc}</p>
                    </div>
                    {/* Visual */}
                    <div className="flex-1 w-full">
                      <div className="rounded-2xl overflow-hidden" style={{ background: "#111827", border: `1px solid ${f.color}25` }}>
                        {/* Browser bar */}
                        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5" style={{ background: "#1A2233" }}>
                          {["#EF4444","#F59E0B","#10B981"].map(c => <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />)}
                        </div>
                        {/* Feature preview */}
                        <div className="p-5 space-y-2" style={{ minHeight: "160px" }}>
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 rounded-lg" style={{ background: f.color + "30" }} />
                            <div className="h-2 w-24 rounded" style={{ background: f.color + "40" }} />
                          </div>
                          {[80,60,90,45].map((w, j) => (
                            <div key={j} className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full shrink-0" style={{ background: f.color + "20" }} />
                              <div className="flex-1 space-y-1">
                                <div className="h-2 rounded" style={{ width: `${w}%`, background: f.color + "30" }} />
                                <div className="h-1.5 rounded" style={{ width: `${w * 0.6}%`, background: "#374151" }} />
                              </div>
                              <div className="h-5 w-14 rounded-full shrink-0" style={{ background: f.color + "20" }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ──────────────────── MÓDULOS GRID ──────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <p className="text-center text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#C0392B" }}>
              Módulos incluidos
            </p>
            <h2 className="text-center font-black text-3xl md:text-4xl mb-12" style={{ fontFamily: "'Cinzel', serif" }}>
              Todo en un solo lugar
            </h2>
          </Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {MODULES.map((m, i) => {
              const Icon = m.icon;
              return (
                <Reveal key={m.label} delay={i * 40}>
                  <div className="flex items-center gap-3 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-colors"
                    style={{ background: "#0D1117" }}>
                    <Icon size={18} style={{ color: "#C0392B" }} />
                    <span className="text-sm font-semibold text-white/70">{m.label}</span>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ──────────────────── CÓMO FUNCIONA ──────────────────── */}
      <section className="py-24 px-4" style={{ background: "#0D1117" }}>
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <p className="text-center text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#C0392B" }}>
              Cómo funciona
            </p>
            <h2 className="text-center font-black text-3xl md:text-4xl mb-16" style={{ fontFamily: "'Cinzel', serif" }}>
              Empieza en 3 pasos
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "01", icon: Zap,      title: "Crea tu cuenta", desc: "Regístrate gratis. Sin tarjeta de crédito. En 2 minutos tu dojo está creado." },
              { n: "02", icon: Monitor,  title: "Configura en minutos", desc: "Sube tu logo, agrega tus primeros alumnos y activa tu página pública." },
              { n: "03", icon: Clock,    title: "Empieza a gestionar", desc: "Pasa lista con QR, controla pagos y comparte el link de tu dojo desde el día 1." },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <Reveal key={s.n} delay={i * 150}>
                  <div className="text-center p-6 rounded-2xl border border-white/5" style={{ background: "#111827" }}>
                    <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                      style={{ background: "#C0392B22" }}>
                      <Icon size={24} style={{ color: "#C0392B" }} />
                    </div>
                    <div className="text-xs font-black text-white/20 mb-2">{s.n}</div>
                    <h3 className="font-black text-lg mb-2">{s.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ──────────────────── PRICING ──────────────────── */}
      <section id="precios" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p className="text-center text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#C0392B" }}>
              Precios
            </p>
            <h2 className="text-center font-black text-4xl md:text-5xl mb-4" style={{ fontFamily: "'Cinzel', serif" }}>
              Simple y transparente
            </h2>
            <p className="text-center text-white/50 text-lg mb-16">
              Sin sorpresas. Cambia o cancela cuando quieras.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PRICING.map((p, i) => (
              <Reveal key={p.name} delay={i * 100}>
                <div className="rounded-2xl p-6 relative"
                  style={{
                    background: p.highlight ? "#111827" : "#0D1117",
                    border: `2px solid ${p.highlight ? p.color : "#1A2233"}`,
                    boxShadow: p.highlight ? `0 0 40px ${p.color}25` : "none",
                  }}>
                  {p.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white"
                      style={{ background: p.color }}>
                      {p.badge}
                    </div>
                  )}
                  <div className="mb-6">
                    <p className="font-bold mb-1" style={{ color: p.color }}>{p.name}</p>
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-black">{p.price}</span>
                      <span className="text-white/40 text-sm mb-1">{p.period}</span>
                    </div>
                  </div>
                  <ul className="space-y-2.5 mb-6">
                    {p.features.map(f => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-white/80">
                        <Check size={14} style={{ color: p.color, flexShrink: 0 }} />
                        {f}
                      </li>
                    ))}
                    {p.missing.map(f => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-white/25 line-through">
                        <X size={14} className="text-white/20 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a href={WA} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                    style={{
                      background: p.highlight ? p.color : "transparent",
                      color: p.highlight ? "#fff" : p.color,
                      border: p.highlight ? "none" : `1px solid ${p.color}50`,
                    }}>
                    {p.cta} <ArrowRight size={15} />
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────── FAQ ──────────────────── */}
      <section id="faq" className="py-24 px-4" style={{ background: "#0D1117" }}>
        <div className="max-w-2xl mx-auto">
          <Reveal>
            <p className="text-center text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#C0392B" }}>
              FAQ
            </p>
            <h2 className="text-center font-black text-4xl mb-12" style={{ fontFamily: "'Cinzel', serif" }}>
              Preguntas frecuentes
            </h2>
          </Reveal>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="rounded-2xl overflow-hidden border border-white/5 cursor-pointer"
                  style={{ background: "#111827" }}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <div className="flex items-center justify-between px-5 py-4 gap-3">
                    <p className="font-semibold text-sm">{faq.q}</p>
                    <ChevronDown size={16} className={`text-white/40 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                  </div>
                  {openFaq === i && (
                    <div className="px-5 pb-5 text-white/60 text-sm leading-relaxed border-t border-white/5">
                      <p className="pt-3">{faq.a}</p>
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────── CTA FINAL ──────────────────── */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(ellipse at center, #C0392B 0%, transparent 70%)" }} />
        </div>
        <Reveal>
          <div className="max-w-2xl mx-auto text-center relative">
            <div className="text-6xl mb-6">🥋</div>
            <h2 className="font-black text-4xl md:text-5xl mb-4" style={{ fontFamily: "'Cinzel', serif" }}>
              ¿Listo para modernizar tu dojo?
            </h2>
            <p className="text-white/60 text-lg mb-10">
              Únete a los dojos que ya crecen con Dojo Master.
              Empieza gratis hoy — sin tarjeta, sin complicaciones.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a href={WA} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg text-white transition-all hover:scale-105 shadow-lg"
                style={{ background: "#C0392B", boxShadow: "0 8px 32px #C0392B55" }}>
                <MessageCircle size={20} /> Empieza por WhatsApp
              </a>
              <Link href="/login"
                className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg border border-white/15 hover:border-white/30 transition-all">
                Ya tengo cuenta <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ──────────────────── FOOTER ──────────────────── */}
      <footer className="border-t border-white/5 py-10 px-4" style={{ background: "#080C14" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
                style={{ background: "#C0392B" }}>DM</div>
              <span className="font-black tracking-wide">Dojo Master</span>
            </div>
            <div className="flex gap-6 text-sm text-white/30">
              {[["Características","#caracteristicas"],["Precios","#precios"],["FAQ","#faq"],["Iniciar sesión","/login"]].map(([l,h]) => (
                <a key={l} href={h} className="hover:text-white/60 transition-colors">{l}</a>
              ))}
            </div>
            <p className="text-white/20 text-sm">© {new Date().getFullYear()} Dojo Master</p>
          </div>
        </div>
      </footer>

      {/* WhatsApp flotante */}
      <a href={WA} target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-40 transition-all hover:scale-110"
        style={{ background: "#25D366", boxShadow: "0 4px 24px #25D36670" }}>
        <MessageCircle size={26} className="text-white" fill="white" />
      </a>
    </div>
  );
}
