"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Users, CreditCard, Award, Trophy, Globe,
  BarChart2, QrCode, Shield, Star, Check, ChevronDown,
  MessageCircle, ArrowRight, Zap, Clock, X, Menu,
  Smartphone, Bell, Video, Lock, Wifi, Calendar,
  ChevronRight, TrendingUp, Mail,
} from "lucide-react";
// FIX: eliminados imports no usados: Play, Gift, Sparkles, ClipboardList

/* ── Tokens ──────────────────────────────────────────────────── */
const PRIMARY = "#C0392B";
const GOLD    = "#F59E0B";
const BG      = "#080C14";
const BG2     = "#0D1117";
const CARD    = "#111827";
const BORDER  = "#1E293B";

const WA_NUMBER = "50762019999";
const WA = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("¡Hola! Quiero saber más sobre Dojo Master 🥋")}`;

/* ── Scroll reveal ──────────────────────────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.06 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className={className}
      style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(28px)", transition: `opacity .6s ease ${delay}ms, transform .6s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

/* ── Device wrapper (laptop frame around screenshot) ─────────── */
function LaptopFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div style={{ position: "relative" }}>
      <div style={{
        background: "#131922", borderRadius: "14px 14px 0 0",
        padding: "12px 12px 0", border: "1.5px solid rgba(255,255,255,0.1)",
        borderBottom: "none",
        boxShadow: "0 -4px 60px rgba(0,0,0,.6), 0 0 80px rgba(192,57,43,.12)",
      }}>
        <div style={{ display:"flex", gap:5, marginBottom:8 }}>
          {["#EF4444","#F59E0B","#10B981"].map(c=>(
            <div key={c} style={{width:9,height:9,borderRadius:"50%",background:c}}/>
          ))}
        </div>
        <div style={{ borderRadius:6, overflow:"hidden", lineHeight:0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* FIX: añadidas dimensiones para evitar CLS */}
          <img src={src} alt={alt} width={1200} height={700} style={{ width:"100%", display:"block" }} />
        </div>
      </div>
      <div style={{ background:"linear-gradient(#1e2533,#161c28)", height:16, borderRadius:"0 0 4px 4px", border:"1.5px solid rgba(255,255,255,.07)", borderTop:"none" }}/>
      <div style={{ background:"linear-gradient(to right,#161c28,#1e2533,#161c28)", height:12, borderRadius:"0 0 10px 10px", border:"1px solid rgba(255,255,255,.05)", borderTop:"none", margin:"0 -4px" }}/>
    </div>
  );
}

/* ── Phone frame ─────────────────────────────────────────────── */
function PhoneFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div style={{
      background:"#131922", borderRadius:28, padding:"10px 8px",
      border:"2px solid rgba(255,255,255,.13)",
      boxShadow:"0 24px 60px rgba(0,0,0,.8), 0 0 30px rgba(192,57,43,.15)",
      width:170,
    }}>
      <div style={{ width:44, height:7, background:"#060a12", borderRadius:"0 0 10px 10px", margin:"0 auto 6px" }}/>
      <div style={{ borderRadius:16, overflow:"hidden", lineHeight:0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* FIX: añadidas dimensiones */}
        <img src={src} alt={alt} width={340} height={680} style={{ width:"100%", display:"block" }}/>
      </div>
      <div style={{ width:38, height:4, background:"rgba(255,255,255,.18)", borderRadius:4, margin:"8px auto 0" }}/>
    </div>
  );
}

/* ── Floating badge card ─────────────────────────────────────── */
function FloatCard({ icon, title, sub, accent }: { icon: string; title: string; sub: string; accent: string }) {
  return (
    <div style={{
      background:"rgba(13,17,23,.95)", backdropFilter:"blur(16px)",
      border:`1px solid ${accent}40`, borderRadius:12,
      padding:"12px 16px", display:"flex", alignItems:"center", gap:12,
      boxShadow:`0 8px 32px rgba(0,0,0,.5), 0 0 20px ${accent}20`,
    }}>
      <div style={{ width:40, height:40, borderRadius:10, background:`${accent}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize:13, fontWeight:700, color:"#e8edf5", marginBottom:2 }}>{title}</div>
        <div style={{ fontSize:11, color:"#6b7890" }}>{sub}</div>
      </div>
    </div>
  );
}

/* ── Pricing plans ───────────────────────────────────────────── */
const PLANS = [
  {
    name:"Bronce", emoji:"🥉", price:"$0", period:"gratis para siempre",
    color:"#78716C", highlight:false, badge:null, limit:"Hasta 15 alumnos",
    features:["15 alumnos activos","Fichas completas de alumnos","Asistencia QR desde tu celular","Gestión de pagos y mensualidades","Recordatorios automáticos de mora","Portal del alumno (pagos + videos)","Historial de cintas y rangos","1 administrador"],
    missing:["Página web del dojo","Módulo de torneos Pro","CRM de prospectos","Reportes avanzados"],
    cta:"Crear cuenta gratis", ctaLink:"/register",
  },
  {
    name:"Silver", emoji:"🥈", price:"$29", period:"/mes",
    color:"#94A3B8", highlight:false, badge:null, limit:"Hasta 40 alumnos",
    features:["40 alumnos activos","Todo lo del plan Bronce","🌐 Página web gratis para tu dojo","Torneos Kumite y Kata básicos","Brackets automáticos","CRM de prospectos","Reportes y estadísticas","3 administradores","Soporte prioritario"],
    missing:["Torneo Pro con streaming"],
    cta:"Empezar con Silver", ctaLink:"/register",
  },
  {
    name:"Gold", emoji:"🥇", price:"$59", period:"/mes",
    color:GOLD, highlight:true, badge:"Más completo", limit:"Alumnos ilimitados",
    features:["Alumnos ilimitados","Todo lo del plan Silver","🏆 Torneos Profesionales","Streaming en vivo YouTube/OBS","Tatamis, jueces y árbitros","Inscripciones federativas online","Overlay profesional para transmisión","Programa y cronograma del evento","Admins ilimitados","Soporte 24/7"],
    missing:[],
    cta:"Empezar con Gold", ctaLink:"/register",
  },
];

const FAQS = [
  { q:"¿Necesito equipo especial para el control de asistencia?", a:"No. El scanner QR funciona desde la cámara de cualquier smartphone. El alumno muestra su código desde su portal y en menos de 1 segundo queda registrado. Sin lectores, sin tablets adicionales, sin costo extra." },
  { q:"¿Cómo reciben los alumnos sus recordatorios de pago?", a:"Automáticamente por correo electrónico. El sistema detecta pagos en mora según la tolerancia que configures y envía el recordatorio sin que hagas nada. También puedes enviarlo manualmente con un clic." },
  { q:"¿Qué puede ver el alumno en su portal?", a:"Cada alumno ve su historial completo de pagos, registro de asistencia, cintas obtenidas y los videos de las katas de cada cinta que ya logró. Tú subes y organizas los videos desde el panel del Sensei." },
  { q:"¿La página web del dojo tiene costo adicional?", a:"No. En Silver y Gold la página de tu dojo está incluida: logo, horarios, galería, perfil del Sensei, formulario de clase gratuita y tienda. La configuras en menos de 30 minutos." },
  { q:"¿Qué incluye el módulo de Torneos Pro (Gold)?", a:"Torneos con streaming en vivo por YouTube u OBS, múltiples tatamis simultáneos, asignación de jueces y árbitros, inscripciones federativas online, programa del evento y overlay profesional para transmisión." },
  { q:"¿Mis datos están seguros?", a:"Sí. Cada dojo tiene sus datos completamente aislados. Las imágenes van a Cloudinary (CDN global). Base de datos PostgreSQL con cifrado. Puedes exportar todo en CSV cuando quieras." },
  { q:"¿Cuánto tiempo toma configurarlo?", a:"La configuración básica (logo, nombre, primeros alumnos, primer QR) toma menos de 15 minutos. El primer día ya puedes pasar lista y controlar pagos. La web del dojo en menos de 30 minutos." },
];

const TESTIMONIALS = [
  { name:"Sensei Carlos Molina", role:"Dojo Bushido · Panamá 🇵🇦", quote:"Antes perdía 2 horas cada mes buscando quién me debía. Ahora los recordatorios van solos y mis alumnos pagan puntual.", avatar:"CM" },
  { name:"Sensei Diana Torres",  role:"Karate Club Tigre · Colombia 🇨🇴", quote:"La asistencia con QR cambió todo. Mis alumnos llegan, se escanean solos y yo no tengo que hacer nada. Simple y efectivo.", avatar:"DT" },
  { name:"Sensei Roberto Arias", role:"Dojo Dragón · Costa Rica 🇨🇷", quote:"Organicé mi primer torneo de 60 participantes con los brackets automáticos. Lo que antes me tomaba días, lo hice en una hora.", avatar:"RA" },
];

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [navOpen,   setNavOpen]   = useState(false);
  const [openFaq,   setOpenFaq]   = useState<number | null>(null);
  const [dojoCount, setDojoCount] = useState(0);
  const [lang,      setLang]      = useState<"es"|"en">("es");

  // FIX: useRef evita que el contador reinicie en re-renders
  const countedRef = useRef(false);
  useEffect(() => {
    if (countedRef.current) return;
    countedRef.current = true;
    const target = 120; let c = 0;
    const t = setInterval(() => { c++; setDojoCount(c); if (c >= target) clearInterval(t); }, 18);
    return () => clearInterval(t);
  }, []);

  const es = lang === "es";

  return (
    <div className="min-h-screen text-white overflow-x-hidden"
      style={{ background: BG, fontFamily:"'Nunito',sans-serif" }}>

      {/* ══ GLOBAL STYLES ══════════════════════════════════════
          FIX: @import eliminado — las fonts ya cargan en layout.tsx
      */}
      <style>{`
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 6px; background: #0d1117; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }

        /* FIX: grids responsivos en mobile */
        .feat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: center;
          margin-bottom: 96px;
        }
        @media (max-width: 768px) {
          .feat-grid { grid-template-columns: 1fr; gap: 40px; margin-bottom: 64px; }
          .feat-float-hide { display: none !important; }
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>

      {/* ══ NAV ════════════════════════════════════════════════ */}
      <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:50,
        background:"rgba(8,12,20,.92)", backdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(255,255,255,.05)", height:64,
        display:"flex", alignItems:"center" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 24px", width:"100%",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>

          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Dojo Master" width={36} height={36} style={{ objectFit:"contain", borderRadius:8 }}/>
            <span style={{ fontWeight:900, fontSize:18, letterSpacing:".02em" }}>Dojo Master</span>
          </div>

          <div style={{ display:"flex", gap:36, fontSize:14 }} className="hidden md:flex">
            {(es
              ? [["Funciones","#funciones"],["Planes","#planes"],["Preguntas","#faq"]]
              : [["Features","#funciones"],["Pricing","#planes"],["FAQ","#faq"]]
            ).map(([l,h]) => (
              <a key={l} href={h} style={{ color:"rgba(255,255,255,.55)", fontWeight:600, transition:"color .2s" }}
                onMouseEnter={e=>(e.currentTarget.style.color="#fff")}
                onMouseLeave={e=>(e.currentTarget.style.color="rgba(255,255,255,.55)")}>{l}</a>
            ))}
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:12 }} className="hidden md:flex">
            <button onClick={()=>setLang(l=>l==="es"?"en":"es")}
              style={{ padding:"6px 14px", borderRadius:100, border:"1px solid rgba(255,255,255,.1)",
                fontSize:12, fontWeight:700, color:"rgba(255,255,255,.5)", cursor:"pointer",
                background:"transparent", transition:"all .2s" }}>
              {lang==="es"?"🇺🇸 EN":"🇪🇸 ES"}
            </button>
            <Link href="/login" style={{ fontSize:14, color:"rgba(255,255,255,.5)", fontWeight:600 }}>
              {es?"Iniciar sesión":"Sign in"}
            </Link>
            <Link href="/register" style={{
              display:"flex", alignItems:"center", gap:6, padding:"9px 22px",
              borderRadius:100, background:PRIMARY, color:"#fff", fontSize:14, fontWeight:700,
              transition:"all .2s",
            }}>
              {es?"Empieza gratis":"Start free"} <ArrowRight size={13}/>
            </Link>
          </div>

          <button onClick={()=>setNavOpen(o=>!o)} style={{ padding:8, background:"transparent", border:"none", color:"rgba(255,255,255,.7)", cursor:"pointer" }} className="md:hidden">
            {navOpen ? <X size={20}/> : <Menu size={20}/>}
          </button>
        </div>

        {navOpen && (
          <div style={{ position:"absolute", top:64, left:0, right:0, background:BG,
            borderBottom:"1px solid rgba(255,255,255,.08)", padding:"16px 24px 24px" }}>
            {[["Funciones","#funciones"],["Planes","#planes"],["Preguntas","#faq"]].map(([l,h])=>(
              <a key={l} href={h} onClick={()=>setNavOpen(false)}
                style={{ display:"block", padding:"10px 0", color:"rgba(255,255,255,.65)", fontSize:15, fontWeight:600 }}>{l}</a>
            ))}
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:12 }}>
              <Link href="/login" style={{ textAlign:"center", padding:"11px", borderRadius:12,
                border:"1px solid rgba(255,255,255,.1)", fontSize:14, color:"rgba(255,255,255,.6)", fontWeight:600 }}>
                {es?"Iniciar sesión":"Sign in"}
              </Link>
              <Link href="/register" style={{ textAlign:"center", padding:"11px", borderRadius:12,
                background:PRIMARY, fontSize:14, color:"#fff", fontWeight:700 }}>
                {es?"Empieza gratis":"Start free"}
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ══ HERO ═══════════════════════════════════════════════ */}
      <section style={{ position:"relative", paddingTop:64, paddingBottom:0, overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)",
          width:1000, height:600, borderRadius:"50%", opacity:.12, pointerEvents:"none",
          background:`radial-gradient(ellipse, ${PRIMARY} 0%, transparent 65%)`, filter:"blur(1px)" }}/>

        <div style={{ maxWidth:1280, margin:"0 auto", padding:"80px 32px 0" }}>

          <div style={{ display:"flex", justifyContent:"center", marginBottom:32 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 20px",
              borderRadius:100, border:`1px solid ${PRIMARY}50`, background:`${PRIMARY}12`,
              fontSize:14, fontWeight:600 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:PRIMARY, animation:"pulse 2s infinite", display:"inline-block" }}/>
              <span style={{ color:"rgba(255,255,255,.65)" }}>
                <span style={{ color:PRIMARY, fontWeight:900 }}>{dojoCount}+</span>
                {" "}dojos en 🇵🇦 🇨🇷 🇲🇽 🇨🇴 y más
              </span>
            </div>
          </div>

          <h1 style={{
            textAlign:"center", fontFamily:"'Cinzel',serif", fontWeight:900, lineHeight:1.05,
            fontSize:"clamp(2.6rem,7vw,5.5rem)", marginBottom:20,
          }}>
            {es ? <>El software que tu<br/><span style={{color:PRIMARY}}>dojo necesitaba.</span></>
                : <>The software your<br/><span style={{color:PRIMARY}}>dojo needed.</span></>}
          </h1>

          <p style={{ textAlign:"center", color:"rgba(255,255,255,.52)", maxWidth:680, margin:"0 auto 12px",
            fontSize:"clamp(.95rem,2.4vw,1.18rem)", lineHeight:1.7, fontWeight:400 }}>
            {es ? "Alumnos, pagos, asistencia QR, torneos profesionales y tu propia página web — todo en un solo lugar, desde tu celular."
                : "Students, payments, QR attendance, professional tournaments and your own website — all in one place, from your phone."}
          </p>
          <p style={{ textAlign:"center", fontSize:13, color:"rgba(255,255,255,.28)", marginBottom:36 }}>
            {es ? "Sin hardware extra · Sin contratos · Sin complicaciones"
                : "No extra hardware · No contracts · No complexity"}
          </p>

          <div style={{ display:"flex", justifyContent:"center", gap:14, flexWrap:"wrap", marginBottom:16 }}>
            <Link href="/register" style={{
              display:"flex", alignItems:"center", gap:8, padding:"16px 40px",
              borderRadius:14, background:PRIMARY, color:"#fff", fontWeight:700, fontSize:17,
              boxShadow:`0 8px 40px ${PRIMARY}50`, transition:"transform .2s,box-shadow .2s",
            }}>
              {es?"Empieza gratis — sin tarjeta":"Start free — no card"} <ArrowRight size={18}/>
            </Link>
            <a href="#planes" style={{
              display:"flex", alignItems:"center", gap:8, padding:"16px 36px",
              borderRadius:14, border:"1px solid rgba(255,255,255,.15)", color:"rgba(255,255,255,.8)",
              fontWeight:700, fontSize:17, transition:"border-color .2s",
            }}>
              {es?"Ver planes":"See plans"} <ChevronDown size={18}/>
            </a>
          </div>

          {/* FIX: precio visible debajo de los CTAs */}
          <p style={{ textAlign:"center", fontSize:13, color:"rgba(255,255,255,.32)", marginBottom:56 }}>
            ✓ {es ? "Plan gratuito para hasta 15 alumnos · Sin tarjeta de crédito requerida"
                   : "Free plan for up to 15 students · No credit card required"}
          </p>

          <Reveal>
            <div style={{ position:"relative", maxWidth:1140, margin:"0 auto" }}>

              <div style={{ position:"relative", zIndex:2 }}>
                <LaptopFrame src="https://res.cloudinary.com/dkkoivmt6/image/upload/q_auto,f_auto/dojomasteronline/hero/dashboard" alt="Dojo Master Dashboard" />
              </div>

              {/* FIX: phone y FloatCards ocultos en mobile via .feat-float-hide */}
              <div className="feat-float-hide" style={{
                position:"absolute", bottom:-10, right:-20, zIndex:10,
                filter:"drop-shadow(0 24px 60px rgba(0,0,0,.9)) drop-shadow(0 0 30px rgba(192,57,43,.2))",
              }}>
                <PhoneFrame src="https://res.cloudinary.com/dkkoivmt6/image/upload/q_auto,f_auto/dojomasteronline/hero/mobile" alt="Dojo Master Móvil" />
              </div>

              <div className="feat-float-hide" style={{ position:"absolute", top:30, left:-20, zIndex:10 }}>
                <FloatCard icon="📱" title="Asistencia QR" sub="Solo tu celular · Sin equipo extra" accent={PRIMARY}/>
              </div>
              <div className="feat-float-hide" style={{ position:"absolute", top:130, left:-20, zIndex:10 }}>
                <FloatCard icon="🎌" title="Portal del Alumno" sub="Videos de katas + historial" accent={GOLD}/>
              </div>
              <div className="feat-float-hide" style={{ position:"absolute", bottom:60, left:-20, zIndex:10 }}>
                <FloatCard icon="🌐" title="Página Web Incluida" sub="Silver y Gold — lista en 30 min" accent="#10B981"/>
              </div>

              <div style={{ position:"absolute", bottom:-24, left:"5%", right:"5%", height:1,
                background:`linear-gradient(to right,transparent,${PRIMARY}60,transparent)` }}/>
              <div style={{ position:"absolute", bottom:-24, left:"50%", transform:"translateX(-50%)",
                width:"50%", height:40, background:`radial-gradient(ellipse,${PRIMARY}18 0%,transparent 70%)` }}/>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ PAÍSES BAR ═════════════════════════════════════════ */}
      <div style={{ borderTop:"1px solid rgba(255,255,255,.05)", borderBottom:"1px solid rgba(255,255,255,.05)",
        padding:"20px 24px", background:BG2, marginTop:48 }}>
        <p style={{ textAlign:"center", fontSize:11, fontWeight:700, letterSpacing:".14em", textTransform:"uppercase",
          color:"rgba(255,255,255,.18)", marginBottom:14 }}>
          {es?"Presente en":"Present in"}
        </p>
        <div style={{ display:"flex", justifyContent:"center", flexWrap:"wrap", gap:"8px 40px",
          color:"rgba(255,255,255,.28)", fontSize:14, fontWeight:600 }}>
          {["🇵🇦 Panamá","🇨🇷 Costa Rica","🇲🇽 México","🇨🇴 Colombia","🇻🇪 Venezuela","🇩🇴 Rep. Dominicana","🇸🇻 El Salvador","🇧🇴 Bolivia"]
            .map(c=><span key={c}>{c}</span>)}
        </div>
      </div>

      {/* ══ PROBLEMA / SOLUCIÓN ════════════════════════════════ */}
      <section style={{ padding:"96px 32px" }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <Reveal>
            <p style={{ textAlign:"center", fontSize:11, fontWeight:700, letterSpacing:".2em",
              textTransform:"uppercase", color:PRIMARY, marginBottom:12 }}>
              {es?"¿Te identificas?":"Sound familiar?"}
            </p>
            <h2 style={{ textAlign:"center", fontFamily:"'Cinzel',serif", fontWeight:900,
              fontSize:"clamp(2rem,5vw,3.2rem)", marginBottom:60, color:"#eef0f8" }}>
              {es?"Del desorden al control total":"From chaos to full control"}
            </h2>
          </Reveal>
          {/* FIX: auto-fit para que sea responsivo sin breakpoint manual */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:20 }}>
            <Reveal delay={100}>
              <div style={{ borderRadius:24, padding:28, background:BG2, border:"1px solid rgba(239,68,68,.18)", height:"100%" }}>
                <p style={{ fontWeight:900, color:"#f87171", fontSize:13, letterSpacing:".1em", textTransform:"uppercase",
                  display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
                  <X size={14}/> {es?"Sin Dojo Master":"Without Dojo Master"}
                </p>
                {(es
                  ? ["Lista de alumnos en cuaderno sin actualizar","No sabes quién te debe hasta semanas después","Asistencia en papel que se pierde","Sin página web, pierdes prospectos","Torneos con hojas y WhatsApp = caos","Tus alumnos no saben cuándo ni cuánto deben","3 apps distintas que nunca sincronizan"]
                  : ["Student list in a notebook no one updates","Don't know who owes you until weeks pass","Paper attendance that gets lost","No website, losing leads","Tournaments with paper = chaos","Students don't know what they owe","3 apps that never sync"]
                ).map(p=>(
                  <div key={p} style={{ display:"flex", alignItems:"flex-start", gap:10, fontSize:14, color:"rgba(255,255,255,.45)", marginBottom:10 }}>
                    <X size={13} color="#f87171" style={{ flexShrink:0, marginTop:2 }}/>{p}
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={180}>
              <div style={{ borderRadius:24, padding:28, background:BG2, border:"1px solid rgba(16,185,129,.2)", height:"100%" }}>
                <p style={{ fontWeight:900, color:"#34d399", fontSize:13, letterSpacing:".1em", textTransform:"uppercase",
                  display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
                  <Check size={14}/> {es?"Con Dojo Master":"With Dojo Master"}
                </p>
                {(es
                  ? ["Ficha completa: foto, cintas, pagos, asistencia en tiempo real","Recordatorios de mora van solos por correo electrónico","QR desde la cámara de tu celular — 1 segundo por alumno","Página web de tu dojo lista en 30 minutos, incluida","Brackets automáticos de Kumite y Kata en segundos","Tus alumnos ven su historial y videos de katas en su portal","Todo en un solo lugar, sin apps adicionales"]
                  : ["Full profile: photo, belts, payments, attendance in real time","Late payment reminders send themselves by email","QR from your phone camera — 1 second per student","Your dojo website ready in 30 min, included","Auto Kumite and Kata brackets in seconds","Students see their history and kata videos in their portal","Everything in one place"]
                ).map(s=>(
                  <div key={s} style={{ display:"flex", alignItems:"flex-start", gap:10, fontSize:14, color:"rgba(255,255,255,.78)", marginBottom:10 }}>
                    <Check size={13} color="#34d399" style={{ flexShrink:0, marginTop:2 }}/>{s}
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══ FUNCIONES ══════════════════════════════════════════ */}
      <section id="funciones" style={{ padding:"96px 32px", background:BG2 }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <Reveal>
            <p style={{ textAlign:"center", fontSize:11, fontWeight:700, letterSpacing:".2em",
              textTransform:"uppercase", color:PRIMARY, marginBottom:12 }}>
              {es?"Funcionalidades":"Features"}
            </p>
            <h2 style={{ textAlign:"center", fontFamily:"'Cinzel',serif", fontWeight:900,
              fontSize:"clamp(1.8rem,4.5vw,3rem)", marginBottom:12, color:"#eef0f8" }}>
              {es?"Construido para artes marciales":"Built for martial arts"}
            </h2>
            <p style={{ textAlign:"center", color:"rgba(255,255,255,.42)", fontSize:17, maxWidth:540, margin:"0 auto 80px" }}>
              {es?"No es un software genérico de gimnasio. Cada función existe por un motivo.":"Not a generic gym app. Every feature has a purpose."}
            </p>
          </Reveal>

          {/* ── F1: QR Attendance ── */}
          <Reveal>
            {/* FIX: .feat-grid maneja responsividad via CSS */}
            <div className="feat-grid">
              <div>
                <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px",
                  borderRadius:100, fontSize:12, fontWeight:700, background:"rgba(139,92,246,.18)", color:"#a78bfa",
                  marginBottom:20 }}>
                  <QrCode size={13}/> {es?"Sin equipo extra":"No extra hardware"}
                </div>
                <h3 style={{ fontFamily:"'Cinzel',serif", fontWeight:900, fontSize:"clamp(1.5rem,3vw,2.2rem)",
                  lineHeight:1.15, marginBottom:16, color:"#eef0f8" }}>
                  {es?"Asistencia con QR\ndesde tu celular":"QR Attendance\nfrom your phone"}
                </h3>
                <p style={{ color:"rgba(255,255,255,.52)", fontSize:16, lineHeight:1.75, marginBottom:24 }}>
                  {es
                    ? "Cada alumno tiene un código QR único. El scanner funciona desde la cámara de cualquier smartphone — sin lector, sin tablet, sin costo extra. 1 segundo por alumno."
                    : "Each student has a unique QR code. The scanner works from any smartphone camera — no reader, no tablet, no extra cost. 1 second per student."}
                </p>
                {(es
                  ? ["Registro en menos de 1 segundo","El alumno lo muestra desde su portal móvil","Historial de asistencia en tiempo real","Funciona desde cualquier celular sin instalar nada"]
                  : ["Registration in under 1 second","Student shows it from their mobile portal","Real-time attendance history","Works from any phone, nothing to install"]
                ).map(i=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:14, color:"rgba(255,255,255,.6)", marginBottom:8 }}>
                    <Check size={13} color="#a78bfa" style={{flexShrink:0}}/>{i}
                  </div>
                ))}
              </div>
              <Reveal delay={150}>
                <div style={{ display:"flex", justifyContent:"center" }}>
                  <div style={{ filter:"drop-shadow(0 32px 64px rgba(0,0,0,.8)) drop-shadow(0 0 40px rgba(139,92,246,.2))" }}>
                    <PhoneFrame src="https://res.cloudinary.com/dkkoivmt6/image/upload/q_auto,f_auto/dojomasteronline/hero/mobile" alt="Asistencia QR Dojo Master"/>
                  </div>
                </div>
              </Reveal>
            </div>
          </Reveal>

          {/* ── F2: Pagos y recordatorios (REINTEGRADO) ── */}
          <Reveal>
            <div className="feat-grid">
              <Reveal delay={150}>
                <div style={{ borderRadius:16, overflow:"hidden", border:"1.5px solid rgba(16,185,129,.25)",
                  boxShadow:"0 32px 80px rgba(0,0,0,.6), 0 0 40px rgba(16,185,129,.1)", background:BG }}>
                  <div style={{ padding:20, background:BG }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                      <p style={{ fontSize:14, fontWeight:700, color:"#eef0f8" }}>Mensualidades — Mayo 2025</p>
                      <div style={{ padding:"3px 10px", borderRadius:100, fontSize:11, fontWeight:700, background:"rgba(16,185,129,.2)", color:"#10B981" }}>92% cobrado</div>
                    </div>
                    {[
                      { name:"Ana Moreno",  status:"Al día",    color:"#10B981", amount:"$45" },
                      { name:"Juan Reyes",  status:"Pendiente", color:"#F59E0B", amount:"$45" },
                      { name:"Luis Castro", status:"En mora",   color:"#EF4444", amount:"$45" },
                      { name:"María Salas", status:"Al día",    color:"#10B981", amount:"$45" },
                    ].map(row=>(
                      <div key={row.name} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px",
                        borderRadius:10, marginBottom:6, background:CARD }}>
                        <div style={{ width:28, height:28, borderRadius:"50%", background:PRIMARY,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:10, fontWeight:900, color:"#fff", flexShrink:0 }}>
                          {row.name.split(" ").map(w=>w[0]).join("").slice(0,2)}
                        </div>
                        <span style={{ flex:1, fontSize:13, color:"rgba(255,255,255,.7)", fontWeight:600 }}>{row.name}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:row.color }}>{row.status}</span>
                        <span style={{ fontSize:13, fontWeight:900, color:"#eef0f8" }}>{row.amount}</span>
                      </div>
                    ))}
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px",
                      borderRadius:10, marginTop:8, background:"rgba(245,158,11,.08)", border:"1px solid rgba(245,158,11,.25)" }}>
                      <Bell size={14} color={GOLD}/>
                      <p style={{ fontSize:12, color:"rgba(255,255,255,.55)" }}>
                        Recordatorio enviado automáticamente a <strong style={{color:"rgba(255,255,255,.8)"}}>Juan</strong> y <strong style={{color:"rgba(255,255,255,.8)"}}>Luis</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
              <div>
                <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px",
                  borderRadius:100, fontSize:12, fontWeight:700, background:"rgba(16,185,129,.18)", color:"#34d399",
                  marginBottom:20 }}>
                  <Bell size={13}/> {es?"Automático":"Automatic"}
                </div>
                <h3 style={{ fontFamily:"'Cinzel',serif", fontWeight:900, fontSize:"clamp(1.5rem,3vw,2.2rem)",
                  lineHeight:1.15, marginBottom:16, color:"#eef0f8" }}>
                  {es?"Pagos y recordatorios\nsin perseguir a nadie":"Payments and reminders\nwithout chasing anyone"}
                </h3>
                <p style={{ color:"rgba(255,255,255,.52)", fontSize:16, lineHeight:1.75, marginBottom:24 }}>
                  {es
                    ? "Genera mensualidades con un clic para todos tus alumnos. Los recordatorios de mora se envían solos por correo — configura la tolerancia de días y el sistema trabaja por ti."
                    : "Generate monthly payments in one click for all students. Late payment reminders send themselves by email — set the tolerance days and the system works for you."}
                </p>
                {(es
                  ? ["Generación masiva de mensualidades en 1 clic","Recordatorios automáticos por correo electrónico","Recibos de pago enviados al marcar como pagado","Vista de qué debe cada alumno, en tiempo real"]
                  : ["Mass payment generation in 1 click","Automatic reminders by email","Payment receipts sent when marked as paid","See what each student owes, in real time"]
                ).map(i=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:14, color:"rgba(255,255,255,.6)", marginBottom:8 }}>
                    <Check size={13} color="#34d399" style={{flexShrink:0}}/>{i}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* ── F3: Student portal ── */}
          <Reveal>
            <div className="feat-grid">
              <Reveal delay={150}>
                <div style={{ borderRadius:14, overflow:"hidden", border:"1.5px solid rgba(255,255,255,.09)",
                  boxShadow:"0 32px 80px rgba(0,0,0,.6), 0 0 40px rgba(59,130,246,.1)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="https://res.cloudinary.com/dkkoivmt6/image/upload/q_auto,f_auto/dojomasteronline/hero/alumnos" alt="Control de Alumnos Dojo Master" width={800} height={500} style={{ width:"100%", display:"block" }}/>
                </div>
              </Reveal>
              <div>
                <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px",
                  borderRadius:100, fontSize:12, fontWeight:700, background:"rgba(59,130,246,.18)", color:"#60a5fa",
                  marginBottom:20 }}>
                  <Smartphone size={13}/> {es?"Portal exclusivo para alumnos":"Exclusive student portal"}
                </div>
                <h3 style={{ fontFamily:"'Cinzel',serif", fontWeight:900, fontSize:"clamp(1.5rem,3vw,2.2rem)",
                  lineHeight:1.15, marginBottom:16, color:"#eef0f8" }}>
                  {es?"Tus alumnos,\ninformados y motivados":"Your students,\ninformed and motivated"}
                </h3>
                <p style={{ color:"rgba(255,255,255,.52)", fontSize:16, lineHeight:1.75, marginBottom:24 }}>
                  {es
                    ? "Cada alumno accede a su portal: historial de pagos, asistencia, cintas obtenidas y los videos de las katas de cada cinta que ya logró. Tú subes los videos, ellos aprenden en casa."
                    : "Each student accesses their portal: payment history, attendance, belts earned and kata videos for each belt they've already achieved. You upload the videos, they learn at home."}
                </p>
                {(es
                  ? ["Historial completo de pagos y recibos","Videos de katas desbloqueados por cinta","El Sensei sube y organiza los videos","Historial de asistencia propio","Horarios de clase asignados","Acceso desde cualquier celular o PC"]
                  : ["Complete payment history and receipts","Kata videos unlocked per belt","Sensei uploads and organizes videos","Own attendance history","Assigned class schedules","Access from any phone or PC"]
                ).map(i=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:14, color:"rgba(255,255,255,.6)", marginBottom:8 }}>
                    <Check size={13} color="#60a5fa" style={{flexShrink:0}}/>{i}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* ── F4: Tournament Pro ── */}
          <Reveal>
            <div className="feat-grid">
              <div>
                <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px",
                  borderRadius:100, fontSize:12, fontWeight:700, background:`${GOLD}22`, color:GOLD,
                  marginBottom:20 }}>
                  <Trophy size={13}/> {es?"Exclusivo Plan Gold":"Gold Plan Exclusive"}
                </div>
                <h3 style={{ fontFamily:"'Cinzel',serif", fontWeight:900, fontSize:"clamp(1.5rem,3vw,2.2rem)",
                  lineHeight:1.15, marginBottom:16, color:"#eef0f8" }}>
                  {es?"Torneos profesionales\ncon streaming en vivo":"Professional tournaments\nwith live streaming"}
                </h3>
                <p style={{ color:"rgba(255,255,255,.52)", fontSize:16, lineHeight:1.75, marginBottom:24 }}>
                  {es
                    ? "Brackets automáticos de Kumite y Kata, múltiples tatamis, jueces en vivo y transmisión directa a YouTube. Organiza torneos de nivel federativo desde tu panel."
                    : "Auto Kumite and Kata brackets, multiple mats, live judges and direct streaming to YouTube. Run federation-level tournaments from your dashboard."}
                </p>
                {(es
                  ? ["Brackets Kumite y Kata automáticos","Múltiples tatamis y jueces simultáneos","Streaming en vivo a YouTube / OBS","Overlay profesional para transmisión","Inscripciones federativas online","Programa y cronograma del evento"]
                  : ["Auto Kumite and Kata brackets","Multiple simultaneous mats and judges","Live streaming to YouTube / OBS","Professional broadcast overlay","Online federation registration","Event program and schedule"]
                ).map(i=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:14, color:"rgba(255,255,255,.6)", marginBottom:8 }}>
                    <Check size={13} color={GOLD} style={{flexShrink:0}}/>{i}
                  </div>
                ))}
              </div>
              <Reveal delay={150}>
                <div style={{ borderRadius:14, overflow:"hidden", border:`1.5px solid ${GOLD}25`,
                  boxShadow:`0 32px 80px rgba(0,0,0,.6), 0 0 40px ${GOLD}15` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="https://res.cloudinary.com/dkkoivmt6/image/upload/q_auto,f_auto/dojomasteronline/hero/torneo" alt="Módulo Torneo Pro Dojo Master" width={800} height={500} style={{ width:"100%", display:"block" }}/>
                </div>
              </Reveal>
            </div>
          </Reveal>

          {/* ── F5: Own website ── */}
          <Reveal>
            <div className="feat-grid" style={{ marginBottom:0 }}>
              <Reveal delay={150}>
                <div style={{ borderRadius:20, overflow:"hidden", border:"1.5px solid rgba(16,185,129,.25)",
                  background:`linear-gradient(135deg, rgba(16,185,129,.08), ${BG2})`,
                  boxShadow:"0 32px 80px rgba(0,0,0,.5), 0 0 40px rgba(16,185,129,.1)", padding:0 }}>
                  <div style={{ background:"#131d2b", padding:"10px 14px", borderBottom:"1px solid rgba(255,255,255,.06)",
                    display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ display:"flex", gap:5 }}>
                      {["#EF4444","#F59E0B","#10B981"].map(c=><div key={c} style={{width:9,height:9,borderRadius:"50%",background:c}}/>)}
                    </div>
                    <div style={{ flex:1, background:"rgba(0,0,0,.3)", borderRadius:5, padding:"4px 10px",
                      fontSize:10, color:"rgba(255,255,255,.25)" }}>
                      dojomasteronline.com/dojo/mi-dojo
                    </div>
                  </div>
                  <div style={{ padding:24, background:"#070b12" }}>
                    <div style={{ borderRadius:12, padding:"20px 16px", textAlign:"center", marginBottom:16,
                      background:`linear-gradient(135deg,${PRIMARY}25,rgba(0,0,0,.3))`,
                      border:`1px solid ${PRIMARY}30` }}>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,.35)", marginBottom:4 }}>Tu dojo en internet</div>
                      <div style={{ fontFamily:"'Cinzel',serif", fontWeight:700, fontSize:16, color:"#eef0f8", marginBottom:4 }}>Dojo Bushido</div>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,.35)", marginBottom:10 }}>Arte marcial · Disciplina · Comunidad</div>
                      <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 14px",
                        borderRadius:100, background:PRIMARY, fontSize:10, fontWeight:700, color:"#fff" }}>
                        🎁 Clase Gratuita
                      </div>
                    </div>
                    {[["Infantil","Lun · Mié · Vie","4:00 PM"],["Adultos","Mar · Jue","7:00 PM"]].map(([n,d,h])=>(
                      <div key={n} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                        padding:"10px 14px", borderRadius:10, marginBottom:8, background:"rgba(255,255,255,.04)" }}>
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color:"#eef0f8" }}>{n}</div>
                          <div style={{ fontSize:10, color:"rgba(255,255,255,.35)" }}>{d}</div>
                        </div>
                        <div style={{ fontSize:12, fontWeight:700, color:PRIMARY }}>{h}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
              <div>
                <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px",
                  borderRadius:100, fontSize:12, fontWeight:700, background:"rgba(16,185,129,.18)", color:"#34d399",
                  marginBottom:20 }}>
                  <Globe size={13}/> {es?"Incluida en Silver y Gold":"Included in Silver & Gold"}
                </div>
                <h3 style={{ fontFamily:"'Cinzel',serif", fontWeight:900, fontSize:"clamp(1.5rem,3vw,2.2rem)",
                  lineHeight:1.15, marginBottom:16, color:"#eef0f8" }}>
                  {es?"Tu dojo en internet,\ngratis con tu plan":"Your dojo online,\nfree with your plan"}
                </h3>
                <p style={{ color:"rgba(255,255,255,.52)", fontSize:16, lineHeight:1.75, marginBottom:24 }}>
                  {es
                    ? "Una página web profesional de tu dojo, incluida sin costo adicional. Con logo, horarios, galería, perfil del Sensei, tienda y formulario de clase gratuita para captar nuevos alumnos."
                    : "A professional website for your dojo, included at no extra cost. Logo, schedules, gallery, Sensei profile, store and free class form to attract new students."}
                </p>
                {(es
                  ? ["Lista en menos de 30 minutos","Formulario de prueba gratuita (captura leads)","Galería de atletas, sensei y testimonios","Tienda online con contacto por WhatsApp","URL con el nombre de tu dojo"]
                  : ["Ready in under 30 minutes","Free trial form (captures leads)","Athlete, sensei and testimonial gallery","Online store with WhatsApp contact","URL with your dojo name"]
                ).map(i=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:14, color:"rgba(255,255,255,.6)", marginBottom:8 }}>
                    <Check size={13} color="#34d399" style={{flexShrink:0}}/>{i}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ MÓDULOS GRID ═══════════════════════════════════════ */}
      <section style={{ padding:"80px 32px" }}>
        <div style={{ maxWidth:1000, margin:"0 auto" }}>
          <Reveal>
            <p style={{ textAlign:"center", fontSize:11, fontWeight:700, letterSpacing:".2em",
              textTransform:"uppercase", color:PRIMARY, marginBottom:12 }}>
              {es?"Módulos completos":"Full modules"}
            </p>
            <h2 style={{ textAlign:"center", fontFamily:"'Cinzel',serif", fontWeight:900,
              fontSize:"clamp(1.6rem,4vw,2.6rem)", marginBottom:48, color:"#eef0f8" }}>
              {es?"Todo lo que un dojo necesita":"Everything a dojo needs"}
            </h2>
          </Reveal>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12 }}>
            {[
              { icon:Users,      label:es?"Gestión de alumnos":"Student management",  color:"#3B82F6" },
              { icon:CreditCard, label:es?"Cobros y pagos":"Payments",                color:"#10B981" },
              { icon:Bell,       label:es?"Recordatorios auto.":"Auto reminders",      color:GOLD      },
              { icon:QrCode,     label:es?"Asistencia QR":"QR Attendance",            color:"#8B5CF6" },
              { icon:Award,      label:es?"Historial de cintas":"Belt history",        color:"#EC4899" },
              { icon:Video,      label:es?"Videos de katas":"Kata videos",            color:"#3B82F6" },
              { icon:Smartphone, label:es?"Portal del alumno":"Student portal",       color:"#10B981" },
              { icon:Globe,      label:es?"Página web del dojo":"Dojo website",       color:PRIMARY   },
              { icon:Trophy,     label:es?"Torneos y brackets":"Tournaments",         color:GOLD      },
              { icon:BarChart2,  label:es?"Reportes avanzados":"Advanced reports",    color:"#06B6D4" },
              { icon:Users,      label:es?"CRM de prospectos":"Prospects CRM",        color:"#84CC16" },
              { icon:Calendar,   label:es?"Eventos del dojo":"Dojo events",           color:"#F97316" },
              { icon:Shield,     label:es?"Roles y permisos":"Roles & permissions",   color:"#94A3B8" },
              { icon:Star,       label:es?"Temas visuales":"Visual themes",           color:"#A78BFA" },
              { icon:Wifi,       label:es?"Streaming en vivo":"Live streaming",       color:"#EF4444" },
              { icon:Lock,       label:es?"Datos seguros":"Secure data",              color:"#64748B" },
            ].map((m,i) => {
              const Icon = m.icon;
              return (
                <Reveal key={m.label} delay={i*25}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px",
                    borderRadius:14, background:BG2, border:"1px solid rgba(255,255,255,.05)",
                    transition:"border-color .2s,transform .2s", cursor:"default" }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor="rgba(255,255,255,.12)"; e.currentTarget.style.transform="scale(1.02)"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor="rgba(255,255,255,.05)"; e.currentTarget.style.transform="scale(1)"; }}>
                    <div style={{ width:34, height:34, borderRadius:10, background:`${m.color}20`,
                      display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <Icon size={15} color={m.color}/>
                    </div>
                    <span style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,.62)" }}>{m.label}</span>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ CÓMO FUNCIONA ══════════════════════════════════════ */}
      <section style={{ padding:"96px 32px", background:BG2 }}>
        <div style={{ maxWidth:1000, margin:"0 auto" }}>
          <Reveal>
            <p style={{ textAlign:"center", fontSize:11, fontWeight:700, letterSpacing:".2em",
              textTransform:"uppercase", color:PRIMARY, marginBottom:12 }}>
              {es?"Simple de empezar":"Easy to start"}
            </p>
            <h2 style={{ textAlign:"center", fontFamily:"'Cinzel',serif", fontWeight:900,
              fontSize:"clamp(1.6rem,4vw,2.6rem)", marginBottom:64, color:"#eef0f8" }}>
              {es?"En marcha en menos de un día":"Up and running in less than a day"}
            </h2>
          </Reveal>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:20 }}>
            {(es
              ? [
                  { n:"01", icon:Zap,        title:"Crea tu cuenta gratis",    desc:"Sin tarjeta de crédito. En 2 minutos tienes tu dojo configurado con nombre, logo y tu primer administrador." },
                  { n:"02", icon:TrendingUp, title:"Agrega tus alumnos",       desc:"Carga las fichas, genera los QR y activa tu página web. Todo desde el panel, sin instalaciones." },
                  { n:"03", icon:Clock,      title:"Opera desde el primer día", desc:"Pasa lista con QR desde tu celular, controla pagos, envía recordatorios y comparte el link de tu dojo." },
                ]
              : [
                  { n:"01", icon:Zap,        title:"Create your free account", desc:"No credit card. In 2 minutes your dojo is set up with name, logo and your first admin." },
                  { n:"02", icon:TrendingUp, title:"Add your students",        desc:"Load profiles, generate QR codes and activate your website. From the panel, no installation needed." },
                  { n:"03", icon:Clock,      title:"Operate from day one",     desc:"Take attendance with QR from your phone, track payments, send reminders and share your dojo link." },
                ]
            ).map((s,i) => {
              const Icon = s.icon;
              return (
                <Reveal key={s.n} delay={i*140}>
                  <div style={{ textAlign:"center", padding:36, borderRadius:24,
                    background:CARD, border:"1px solid rgba(255,255,255,.05)" }}>
                    <div style={{ width:64, height:64, borderRadius:18, margin:"0 auto 20px",
                      display:"flex", alignItems:"center", justifyContent:"center", background:`${PRIMARY}22` }}>
                      <Icon size={26} color={PRIMARY}/>
                    </div>
                    <div style={{ fontSize:11, fontWeight:900, color:"rgba(255,255,255,.18)", marginBottom:8, letterSpacing:".14em" }}>{s.n}</div>
                    <h3 style={{ fontWeight:800, fontSize:18, marginBottom:12, color:"#eef0f8" }}>{s.title}</h3>
                    <p style={{ color:"rgba(255,255,255,.42)", fontSize:14, lineHeight:1.7 }}>{s.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIOS ════════════════════════════════════════ */}
      <section style={{ padding:"96px 32px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <Reveal>
            <p style={{ textAlign:"center", fontSize:11, fontWeight:700, letterSpacing:".2em",
              textTransform:"uppercase", color:PRIMARY, marginBottom:12 }}>
              {es?"Testimonios":"Testimonials"}
            </p>
            <h2 style={{ textAlign:"center", fontFamily:"'Cinzel',serif", fontWeight:900,
              fontSize:"clamp(1.6rem,4vw,2.6rem)", marginBottom:56, color:"#eef0f8" }}>
              {es?"Lo que dicen los Senseis":"What Senseis say"}
            </h2>
          </Reveal>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:20 }}>
            {TESTIMONIALS.map((t,i) => (
              <Reveal key={t.name} delay={i*110}>
                <div style={{ borderRadius:24, padding:28, background:BG2,
                  border:"1px solid rgba(255,255,255,.06)", display:"flex", flexDirection:"column", height:"100%",
                  transition:"border-color .2s,transform .2s" }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor="rgba(255,255,255,.12)"; e.currentTarget.style.transform="translateY(-3px)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor="rgba(255,255,255,.06)"; e.currentTarget.style.transform="none"; }}>
                  <div style={{ display:"flex", gap:3, marginBottom:16 }}>
                    {[1,2,3,4,5].map(s=><Star key={s} size={13} fill={GOLD} color={GOLD}/>)}
                  </div>
                  <p style={{ color:"rgba(255,255,255,.68)", fontSize:14, lineHeight:1.75, flex:1, marginBottom:20, fontStyle:"italic" }}>
                    "{t.quote}"
                  </p>
                  <div style={{ display:"flex", alignItems:"center", gap:12,
                    borderTop:"1px solid rgba(255,255,255,.06)", paddingTop:16 }}>
                    <div style={{ width:42, height:42, borderRadius:"50%", background:PRIMARY,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontWeight:900, fontSize:13, color:"#fff", flexShrink:0 }}>
                      {t.avatar}
                    </div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, color:"#eef0f8" }}>{t.name}</div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.35)", marginTop:2 }}>{t.role}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PLANES ═════════════════════════════════════════════ */}
      <section id="planes" style={{ padding:"96px 32px", background:BG2 }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <Reveal>
            <p style={{ textAlign:"center", fontSize:11, fontWeight:700, letterSpacing:".2em",
              textTransform:"uppercase", color:PRIMARY, marginBottom:12 }}>
              {es?"Planes":"Pricing"}
            </p>
            <h2 style={{ textAlign:"center", fontFamily:"'Cinzel',serif", fontWeight:900,
              fontSize:"clamp(1.8rem,5vw,3.2rem)", marginBottom:12, color:"#eef0f8" }}>
              {es?"Transparente y sin sorpresas":"Simple and transparent"}
            </h2>
            <p style={{ textAlign:"center", color:"rgba(255,255,255,.42)", fontSize:17, marginBottom:64 }}>
              {es?"Empieza gratis. Crece cuando necesites. Cancela cuando quieras.":"Start free. Scale when you need. Cancel anytime."}
            </p>
          </Reveal>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:20, alignItems:"stretch" }}>
            {PLANS.map((plan,i) => (
              <Reveal key={plan.name} delay={i*100}>
                <div style={{
                  borderRadius:24, padding:28, display:"flex", flexDirection:"column", height:"100%",
                  position:"relative", background: plan.highlight ? CARD : BG,
                  border:`2px solid ${plan.highlight ? plan.color : BORDER}`,
                  boxShadow: plan.highlight ? `0 0 60px ${plan.color}30` : "none",
                }}>
                  {plan.badge && (
                    <div style={{ position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)",
                      padding:"4px 18px", borderRadius:100, background:plan.color,
                      fontSize:11, fontWeight:900, color:"#fff", whiteSpace:"nowrap" }}>
                      {plan.badge}
                    </div>
                  )}
                  <div style={{ marginBottom:20 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                      <span style={{ fontSize:24 }}>{plan.emoji}</span>
                      <span style={{ fontWeight:900, fontSize:18, color:plan.color }}>{plan.name}</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"flex-end", gap:4, marginBottom:4 }}>
                      <span style={{ fontSize:44, fontWeight:900, color: plan.highlight ? plan.color : "#eef0f8", lineHeight:1 }}>{plan.price}</span>
                      <span style={{ color:"rgba(255,255,255,.35)", fontSize:14, marginBottom:6 }}>{plan.period}</span>
                    </div>
                    <p style={{ fontSize:12, color:"rgba(255,255,255,.28)", fontWeight:600 }}>{plan.limit}</p>
                  </div>
                  <ul style={{ flex:1, marginBottom:24, listStyle:"none" }}>
                    {plan.features.map(f=>(
                      <li key={f} style={{ display:"flex", alignItems:"flex-start", gap:10, fontSize:13,
                        color:"rgba(255,255,255,.72)", marginBottom:10 }}>
                        <Check size={13} color={plan.color} style={{flexShrink:0,marginTop:2}}/>{f}
                      </li>
                    ))}
                    {plan.missing.map(f=>(
                      <li key={f} style={{ display:"flex", alignItems:"flex-start", gap:10, fontSize:13,
                        color:"rgba(255,255,255,.2)", marginBottom:10, textDecoration:"line-through" }}>
                        <X size={13} color="rgba(255,255,255,.15)" style={{flexShrink:0,marginTop:2}}/>{f}
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.ctaLink} style={{
                    display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                    padding:"14px", borderRadius:14, fontWeight:700, fontSize:14,
                    color: plan.highlight ? "#fff" : plan.color,
                    background: plan.highlight ? plan.color : "transparent",
                    border: plan.highlight ? "none" : `1.5px solid ${plan.color}60`,
                    transition:"all .2s",
                  }}>
                    {plan.cta} <ArrowRight size={14}/>
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={300}>
            <div style={{ marginTop:36, padding:24, borderRadius:16,
              border:"1px solid rgba(255,255,255,.06)", textAlign:"center", background:BG }}>
              <p style={{ fontSize:14, color:"rgba(255,255,255,.42)" }}>
                {es?"¿No sabes cuál elegir?":"Not sure which to choose?"}{" "}
                <a href={WA} target="_blank" rel="noopener noreferrer"
                  style={{ color:PRIMARY, fontWeight:700 }}>
                  {es?"Escríbenos por WhatsApp":"Chat with us on WhatsApp"}
                </a>
              </p>
              <p style={{ fontSize:11, color:"rgba(255,255,255,.2)", marginTop:8 }}>
                {es?"Todos los planes incluyen soporte técnico. Precios en USD. Consulta disponibilidad por país."
                  :"All plans include technical support. USD pricing. Check availability in your country."}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ FAQ ════════════════════════════════════════════════ */}
      <section id="faq" style={{ padding:"96px 32px" }}>
        <div style={{ maxWidth:740, margin:"0 auto" }}>
          <Reveal>
            <p style={{ textAlign:"center", fontSize:11, fontWeight:700, letterSpacing:".2em",
              textTransform:"uppercase", color:PRIMARY, marginBottom:12 }}>
              {es?"Preguntas frecuentes":"FAQ"}
            </p>
            <h2 style={{ textAlign:"center", fontFamily:"'Cinzel',serif", fontWeight:900,
              fontSize:"clamp(1.6rem,4vw,2.6rem)", marginBottom:52, color:"#eef0f8" }}>
              {es?"Resolvemos tus dudas":"We answer your questions"}
            </h2>
          </Reveal>
          {FAQS.map((faq,i) => (
            <Reveal key={i} delay={i*40}>
              <div style={{ borderRadius:16, overflow:"hidden", border:"1px solid rgba(255,255,255,.06)",
                marginBottom:10, background:CARD, cursor:"pointer", transition:"border-color .2s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(255,255,255,.12)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,.06)"}
                onClick={()=>setOpenFaq(openFaq===i?null:i)}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"18px 22px", gap:16 }}>
                  <p style={{ fontWeight:600, fontSize:14, color:"rgba(255,255,255,.85)" }}>{faq.q}</p>
                  <ChevronDown size={15} color="rgba(255,255,255,.35)"
                    style={{ flexShrink:0, transform: openFaq===i ? "rotate(180deg)" : "none", transition:"transform .35s" }}/>
                </div>
                {/* FIX: animación suave con maxHeight en lugar de condicional abrupto */}
                <div style={{
                  maxHeight: openFaq===i ? 320 : 0,
                  overflow:"hidden",
                  transition:"max-height .35s ease",
                }}>
                  <div style={{ padding:"0 22px 20px", borderTop:"1px solid rgba(255,255,255,.05)" }}>
                    <p style={{ paddingTop:14, fontSize:14, color:"rgba(255,255,255,.52)", lineHeight:1.75 }}>{faq.a}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══ CTA FINAL ══════════════════════════════════════════ */}
      <section style={{ padding:"120px 32px", background:BG2, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, pointerEvents:"none",
          background:`radial-gradient(ellipse at center,${PRIMARY}0A 0%,transparent 65%)` }}/>
        <Reveal>
          <div style={{ maxWidth:740, margin:"0 auto", textAlign:"center", position:"relative" }}>
            <div style={{ width:72, height:72, borderRadius:20, margin:"0 auto 28px",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:40, background:`${PRIMARY}22` }}>🥋</div>
            <h2 style={{ fontFamily:"'Cinzel',serif", fontWeight:900,
              fontSize:"clamp(2rem,6vw,4rem)", lineHeight:1.05, marginBottom:16, color:"#eef0f8" }}>
              {es ? <>Tu dojo merece<br/><span style={{color:PRIMARY}}>la mejor herramienta.</span></>
                  : <>Your dojo deserves<br/><span style={{color:PRIMARY}}>the best tool.</span></>}
            </h2>
            <p style={{ color:"rgba(255,255,255,.48)", fontSize:17, maxWidth:540, margin:"0 auto 40px", lineHeight:1.7 }}>
              {es ? "Únete a los dojos que ya dejaron el Excel y los cuadernos atrás. Empieza gratis hoy — sin tarjeta, sin instalaciones."
                  : "Join the dojos that already left Excel and notebooks behind. Start free today — no card, no setup."}
            </p>
            {/* FIX: CTA final con 2 botones — foco en conversión */}
            <div style={{ display:"flex", justifyContent:"center", gap:14, flexWrap:"wrap", marginBottom:20 }}>
              <Link href="/register" style={{
                display:"flex", alignItems:"center", gap:8, padding:"18px 48px",
                borderRadius:16, background:PRIMARY, color:"#fff", fontWeight:700, fontSize:17,
                boxShadow:`0 8px 40px ${PRIMARY}55`, transition:"transform .2s,box-shadow .2s",
              }}>
                {es?"Crear cuenta gratis":"Create free account"} <ArrowRight size={18}/>
              </Link>
              <a href={WA} target="_blank" rel="noopener noreferrer" style={{
                display:"flex", alignItems:"center", gap:8, padding:"18px 36px",
                borderRadius:16, border:"1px solid rgba(255,255,255,.14)", color:"rgba(255,255,255,.8)",
                fontWeight:700, fontSize:17, transition:"border-color .2s",
              }}>
                <MessageCircle size={18}/> {es?"WhatsApp":"WhatsApp"}
              </a>
            </div>
            <p style={{ fontSize:13, color:"rgba(255,255,255,.2)" }}>
              {es?"Sin contrato · Cancela cuando quieras · Soporte incluido"
                :"No contract · Cancel anytime · Support included"}
            </p>
          </div>
        </Reveal>
      </section>

      {/* ══ FOOTER ═════════════════════════════════════════════ */}
      <footer style={{ borderTop:"1px solid rgba(255,255,255,.06)", padding:"52px 32px", background:BG }}>
        <div style={{ maxWidth:1200, margin:"0 auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:32, marginBottom:40 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Dojo Master" width={32} height={32} style={{ borderRadius:8, objectFit:"contain" }}/>
                <span style={{ fontWeight:900, fontSize:16 }}>Dojo Master</span>
              </div>
              <p style={{ color:"rgba(255,255,255,.28)", fontSize:13, lineHeight:1.65, maxWidth:220 }}>
                El software completo para gestionar tu dojo de karate y artes marciales.
              </p>
              <a href={WA} target="_blank" rel="noopener noreferrer" style={{
                display:"inline-flex", alignItems:"center", gap:8, marginTop:16, padding:"9px 18px",
                borderRadius:10, background:"#25D366", fontSize:13, fontWeight:700, color:"#fff",
              }}>
                <MessageCircle size={14}/> WhatsApp
              </a>
            </div>
            {[
              { title:"Producto",  links:[["Funciones","#funciones"],["Planes","#planes"],["Preguntas","#faq"]] },
              { title:"Módulos",   links:[["Alumnos","#"],["Pagos","#"],["Asistencia QR","#"],["Torneos","#"],["Página web","#"],["Portal alumno","#"]] },
            ].map(col=>(
              <div key={col.title}>
                <p style={{ fontWeight:700, fontSize:11, letterSpacing:".12em", textTransform:"uppercase",
                  color:"rgba(255,255,255,.5)", marginBottom:14 }}>{col.title}</p>
                {col.links.map(([l,h])=>(
                  <a key={l} href={h} style={{ display:"block", fontSize:13, color:"rgba(255,255,255,.32)",
                    marginBottom:8, transition:"color .2s" }}
                    onMouseEnter={e=>e.currentTarget.style.color="rgba(255,255,255,.65)"}
                    onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,.32)"}>{l}</a>
                ))}
              </div>
            ))}
            <div>
              <p style={{ fontWeight:700, fontSize:11, letterSpacing:".12em", textTransform:"uppercase",
                color:"rgba(255,255,255,.5)", marginBottom:14 }}>Contacto</p>
              <a href={WA} target="_blank" rel="noopener noreferrer"
                style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"rgba(255,255,255,.32)", marginBottom:10 }}>
                <MessageCircle size={13}/> WhatsApp soporte
              </a>
              <a href="mailto:admin@dojomasteronline.com"
                style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"rgba(255,255,255,.32)", marginBottom:20 }}>
                <Mail size={13}/> admin@dojomasteronline.com
              </a>
              <p style={{ fontWeight:700, fontSize:11, letterSpacing:".12em", textTransform:"uppercase",
                color:"rgba(255,255,255,.5)", marginBottom:10 }}>Acceso</p>
              <Link href="/login" style={{ fontSize:13, color:"rgba(255,255,255,.32)" }}>
                Iniciar sesión →
              </Link>
            </div>
          </div>
          <div style={{ borderTop:"1px solid rgba(255,255,255,.06)", paddingTop:24,
            display:"flex", flexWrap:"wrap", justifyContent:"space-between", gap:12 }}>
            <p style={{ fontSize:13, color:"rgba(255,255,255,.2)" }}>
              © {new Date().getFullYear()} Dojo Master · Todos los derechos reservados
            </p>
            <p style={{ fontSize:12, color:"rgba(255,255,255,.14)" }}>
              Hecho con 🥋 para Senseis del mundo entero
            </p>
          </div>
        </div>
      </footer>

      {/* ══ WhatsApp flotante ══ */}
      <a href={WA} target="_blank" rel="noopener noreferrer" style={{
        position:"fixed", bottom:24, right:24, width:56, height:56,
        borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
        background:"#25D366", zIndex:40, boxShadow:"0 4px 24px rgba(37,211,102,.5)",
        transition:"transform .2s,box-shadow .2s",
      }}
        onMouseEnter={e=>{ e.currentTarget.style.transform="scale(1.12)"; }}
        onMouseLeave={e=>{ e.currentTarget.style.transform="scale(1)"; }}>
        <MessageCircle size={26} color="#fff" fill="#fff"/>
      </a>

    </div>
  );
}
