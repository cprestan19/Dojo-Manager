"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Users, CreditCard, Award, Trophy, Globe,
  BarChart2, QrCode, Shield, Star, Check, ChevronDown,
  MessageCircle, ArrowRight, Zap, Clock, X, Menu,
  Smartphone, Bell, Video, Lock, Wifi, Calendar,
  ChevronRight, TrendingUp, Mail, IdCard,
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

// Visual config por nombre de plan — precios y features vienen de la BD
type PlanVisual = {
  emoji:    string;
  color:    string;
  highlight: boolean;
  badge:    string | null;
  missing:  string[];      // features que el plan NO tiene (se muestran tachados)
  cta:      string;
  ctaLink:  string;
};

const PLAN_VISUAL: Record<string, PlanVisual> = {
  "Bronce": {
    emoji:"🥉", color:"#78716C", highlight:false, badge:null,
    missing:[
      "Diseño de carnet digital para cada alumno",
      "Diplomas automáticos en cada ascenso de cinta",
      "Módulo de eventos y postulaciones a torneos",
      "Push de notificaciones a alumnos",
      "Página web profesional del dojo incluida",
      "Tienda en línea",
      "CRM de prospectos",
      "Reportes avanzados",
      "Módulo de Torneos Pro",
    ],
    cta:"Crear cuenta gratis", ctaLink:"/register",
  },
  "Silver": {
    emoji:"🥈", color:"#94A3B8", highlight:false, badge:null,
    missing:["Módulo de Torneos Pro con streaming"],
    cta:"Empezar con Silver", ctaLink:"/register",
  },
  "Gold": {
    emoji:"🥇", color:GOLD, highlight:true, badge:"Más completo",
    missing:[],
    cta:"Empezar con Gold", ctaLink:"/register",
  },
};

const PLAN_VISUAL_DEFAULT: PlanVisual = {
  emoji:"⭐", color:PRIMARY, highlight:false, badge:null,
  missing:[], cta:"Comenzar", ctaLink:"/register",
};

// Patrón estático tipo QR para el mockup del carnet digital (7×7, decorativo)
const QR_PATTERN = [
  1,1,1,0,1,1,1,
  1,0,1,0,0,0,1,
  1,1,1,0,1,1,1,
  0,0,0,1,0,0,1,
  1,1,0,1,1,0,1,
  1,0,1,0,1,1,0,
  1,1,1,0,1,0,1,
];

interface DbPlan {
  id: string; name: string; description: string | null;
  monthlyPrice: number; annualPrice: number;
  maxStudents: number | null; features: string;
}

const FAQS = [
  { q:"¿Necesito equipo especial para el control de asistencia?", a:"No. El scanner QR funciona desde la cámara de cualquier smartphone. El alumno muestra su código desde su portal y en menos de 1 segundo queda registrado. Sin lectores, sin tablets adicionales, sin costo extra." },
  { q:"¿Cómo reciben los alumnos sus recordatorios de pago?", a:"Automáticamente por correo electrónico. El sistema detecta pagos en mora según la tolerancia que configures y envía el recordatorio sin que hagas nada. También puedes enviarlo manualmente con un clic." },
  { q:"¿Qué puede ver el alumno en su portal?", a:"Cada alumno accede a su historial completo de pagos, asistencia, cintas obtenidas, videos de katas, carnet digital, diplomas de cada ascenso, medallas y logros ganados en torneos. También puede explorar su trayectoria y crecimiento como atleta a lo largo del tiempo." },
  { q:"¿Cómo funcionan los diplomas y carnets digitales de cinta?", a:"Cada vez que registras un cambio de cinta en el panel, el sistema genera automáticamente el diploma y actualiza el carnet digital del alumno. El alumno lo ve al instante en su portal y puede descargarlo. Sin impresoras, sin formularios, sin demoras — todo automatizado." },
  { q:"¿Cómo funciona el módulo de eventos para torneos?", a:"Creas el evento, seleccionas los alumnos que participarán y el sistema genera la lista de confirmados. El día del torneo pasas lista con un toque y calificas medallas y posiciones al instante. Todo queda registrado en el expediente permanente del atleta — el alumno puede ver sus logros, las katas con las que ganó medallas y explorar su crecimiento desde su portal." },
  { q:"¿Necesito instalar alguna aplicación?", a:"No. Dojo Master es 100% en la nube. El Sensei gestiona todo desde el navegador de cualquier celular, tablet o computadora con internet. Los alumnos también acceden a su portal desde el navegador, sin descargar ninguna app. Funciona en iOS, Android, Windows y Mac." },
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
  const [dojoCount, setDojoCount] = useState(120);
  const [lang,      setLang]      = useState<"es"|"en">("es");
  const [dbPlans,   setDbPlans]   = useState<DbPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // FIX: useRef evita que el contador reinicie en re-renders
  const countedRef = useRef(false);
  useEffect(() => {
    if (countedRef.current) return;
    countedRef.current = true;
    const target = 120; let c = 0;
    const t = setInterval(() => { c++; setDojoCount(c); if (c >= target) clearInterval(t); }, 18);
    return () => clearInterval(t);
  }, []);

  // Fetch planes desde la BD — se cachean en CDN 5 min
  useEffect(() => {
    fetch("/api/public/plans")
      .then(r => r.ok ? r.json() : [])
      .then((data: DbPlan[]) => { if (Array.isArray(data) && data.length) setDbPlans(data); })
      .catch(() => {})
      .finally(() => setPlansLoading(false));
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

          <div style={{ gap:36, fontSize:14 }} className="hidden md:flex">
            {(es
              ? [["Funciones","#funciones"],["Planes","#planes"],["Preguntas","#faq"]]
              : [["Features","#funciones"],["Pricing","#planes"],["FAQ","#faq"]]
            ).map(([l,h]) => (
              <a key={l} href={h} style={{ color:"rgba(255,255,255,.55)", fontWeight:600, transition:"color .2s" }}
                onMouseEnter={e=>(e.currentTarget.style.color="#fff")}
                onMouseLeave={e=>(e.currentTarget.style.color="rgba(255,255,255,.55)")}>{l}</a>
            ))}
          </div>

          <div style={{ alignItems:"center", gap:12 }} className="hidden md:flex">
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

          {/* Mobile: login visible + hamburger */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }} className="md:hidden">
            <Link href="/login" style={{
              fontSize:13, fontWeight:700, color:"rgba(255,255,255,.75)",
              padding:"7px 14px", borderRadius:100,
              border:"1px solid rgba(255,255,255,.15)",
              whiteSpace:"nowrap",
            }}>
              {es?"Entrar":"Login"}
            </Link>
            <button onClick={()=>setNavOpen(o=>!o)} style={{ padding:8, background:"transparent", border:"none", color:"rgba(255,255,255,.7)", cursor:"pointer" }}>
              {navOpen ? <X size={20}/> : <Menu size={20}/>}
            </button>
          </div>
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

          <p style={{ textAlign:"center", color:"rgba(255,255,255,.68)", maxWidth:680, margin:"0 auto 12px",
            fontSize:"clamp(.95rem,2.4vw,1.18rem)", lineHeight:1.7, fontWeight:400 }}>
            {es ? "Alumnos, pagos, asistencia QR, torneos profesionales y tu propia página web — todo en un solo lugar, desde tu celular."
                : "Students, payments, QR attendance, professional tournaments and your own website — all in one place, from your phone."}
          </p>
          <p style={{ textAlign:"center", fontSize:13, color:"rgba(255,255,255,.45)", marginBottom:36 }}>
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
          <p style={{ textAlign:"center", fontSize:13, color:"rgba(255,255,255,.58)", marginBottom:56 }}>
            ✓ {es ? "Plan gratuito para hasta 20 alumnos · Sin tarjeta de crédito requerida"
                   : "Free plan for up to 20 students · No credit card required"}
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
          color:"rgba(255,255,255,.32)", marginBottom:14 }}>
          {es?"Presente en":"Present in"}
        </p>
        <div style={{ display:"flex", justifyContent:"center", flexWrap:"wrap", gap:"8px 40px",
          color:"rgba(255,255,255,.42)", fontSize:14, fontWeight:600 }}>
          {["🇵🇦 Panamá","🇨🇷 Costa Rica","🇲🇽 México","🇨🇴 Colombia","🇻🇪 Venezuela","🇩🇴 Rep. Dominicana","🇸🇻 El Salvador","🇧🇴 Bolivia"]
            .map(c=><span key={c}>{c}</span>)}
        </div>
      </div>

      {/* ══ SIN INSTALACIÓN ════════════════════════════════════ */}
      <div style={{ borderBottom:"1px solid rgba(255,255,255,.05)", padding:"22px 32px",
        background:"linear-gradient(90deg,rgba(59,130,246,.06),rgba(99,102,241,.06),rgba(59,130,246,.06))" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", flexWrap:"wrap",
          justifyContent:"center", gap:"14px 52px" }}>
          {(es
            ? [
                { icon:Wifi,       text:"100% en la nube — sin instalar nada" },
                { icon:Smartphone, text:"Funciona en cualquier celular, tablet o PC" },
                { icon:Globe,      text:"Gestiona tu dojo desde cualquier lugar del mundo" },
                { icon:Clock,      text:"Disponible las 24 horas, los 7 días" },
              ]
            : [
                { icon:Wifi,       text:"100% cloud — nothing to install" },
                { icon:Smartphone, text:"Works on any phone, tablet or PC" },
                { icon:Globe,      text:"Manage your dojo from anywhere in the world" },
                { icon:Clock,      text:"Available 24 hours, 7 days a week" },
              ]
          ).map(({ icon: Icon, text }) => (
            <div key={text} style={{ display:"flex", alignItems:"center", gap:9,
              color:"rgba(255,255,255,.65)", fontSize:13, fontWeight:600 }}>
              <div style={{ width:28, height:28, borderRadius:8, background:"rgba(59,130,246,.18)",
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Icon size={14} color="#60a5fa"/>
              </div>
              {text}
            </div>
          ))}
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
                  <div key={p} style={{ display:"flex", alignItems:"flex-start", gap:10, fontSize:14, color:"rgba(255,255,255,.6)", marginBottom:10 }}>
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
                  ? ["Ficha completa: foto, cintas, pagos, asistencia en tiempo real","Recordatorios de mora van solos por correo electrónico","QR desde la cámara de tu celular — 1 segundo por alumno","Carnet digital y diploma automático con cada cambio de cinta","Página web de tu dojo lista en 30 minutos, incluida","Brackets automáticos de Kumite y Kata en segundos","Tus alumnos ven historial, logros, medallas y trayectoria en su portal","Sin instalar nada — gestiona desde cualquier celular, tablet o PC"]
                  : ["Full profile: photo, belts, payments, attendance in real time","Late payment reminders send themselves by email","QR from your phone camera — 1 second per student","Digital ID and diploma auto-generated with each belt promotion","Your dojo website ready in 30 min, included","Auto Kumite and Kata brackets in seconds","Students see history, achievements, medals and growth in their portal","Nothing to install — manage from any phone, tablet or PC"]
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
            <p style={{ textAlign:"center", color:"rgba(255,255,255,.6)", fontSize:17, maxWidth:540, margin:"0 auto 80px" }}>
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
                <p style={{ color:"rgba(255,255,255,.68)", fontSize:16, lineHeight:1.75, marginBottom:24 }}>
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
                      <p style={{ fontSize:12, color:"rgba(255,255,255,.65)" }}>
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
                <p style={{ color:"rgba(255,255,255,.68)", fontSize:16, lineHeight:1.75, marginBottom:24 }}>
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
                <p style={{ color:"rgba(255,255,255,.68)", fontSize:16, lineHeight:1.75, marginBottom:24 }}>
                  {es
                    ? "Cada alumno accede a su portal: historial de pagos, asistencia, cintas obtenidas y los videos de las katas de cada cinta que ya logró. Tú subes los videos, ellos aprenden en casa."
                    : "Each student accesses their portal: payment history, attendance, belts earned and kata videos for each belt they've already achieved. You upload the videos, they learn at home."}
                </p>
                {(es
                  ? ["Historial completo de pagos y recibos","Videos de katas desbloqueados por cinta","El Sensei sube y organiza los videos","Historial de asistencia propio","Horarios de clase asignados","Carnet y diploma digital de cada cinta obtenida","Medallas y logros de torneos registrados en su expediente","Explora tu trayectoria y crecimiento como atleta y karateka","Acceso desde cualquier celular o PC, sin instalar nada"]
                  : ["Complete payment history and receipts","Kata videos unlocked per belt","Sensei uploads and organizes videos","Own attendance history","Assigned class schedules","Digital ID card and diploma for each belt earned","Tournament medals and achievements in their record","Explore your trajectory and growth as an athlete","Access from any phone or PC, nothing to install"]
                ).map(i=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:14, color:"rgba(255,255,255,.6)", marginBottom:8 }}>
                    <Check size={13} color="#60a5fa" style={{flexShrink:0}}/>{i}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* ── F3.5: Diplomas y Carnet de Cinta ── */}
          <Reveal>
            <div className="feat-grid">
              <Reveal delay={150}>
                <div style={{ display:"flex", justifyContent:"center", alignItems:"center" }}>
                  {/* Diploma — landscape, formato certificado */}
                  <div style={{
                    width:"100%", maxWidth:420,
                    background:"linear-gradient(160deg,#fffdf5 0%,#fdf8ec 60%,#faf3e0 100%)",
                    borderRadius:12,
                    boxShadow:`0 32px 80px rgba(0,0,0,.7), 0 0 40px ${GOLD}25`,
                    padding:3,
                    border:`2px solid ${GOLD}`,
                  }}>
                    {/* Borde decorativo interior */}
                    <div style={{
                      border:`1px solid ${GOLD}70`,
                      borderRadius:9,
                      padding:"20px 24px",
                      background:"linear-gradient(160deg,#fffdf5,#faf3e0)",
                      position:"relative",
                      overflow:"hidden",
                    }}>
                      {/* Ornamentos en las esquinas */}
                      {[
                        { top:6,  left:6,  borderTop:`2px solid ${GOLD}`, borderLeft:`2px solid ${GOLD}` },
                        { top:6,  right:6, borderTop:`2px solid ${GOLD}`, borderRight:`2px solid ${GOLD}` },
                        { bottom:6, left:6,  borderBottom:`2px solid ${GOLD}`, borderLeft:`2px solid ${GOLD}` },
                        { bottom:6, right:6, borderBottom:`2px solid ${GOLD}`, borderRight:`2px solid ${GOLD}` },
                      ].map((s,i)=>(
                        <div key={i} style={{ position:"absolute", width:16, height:16, ...s }}/>
                      ))}

                      {/* Marca de agua decorativa */}
                      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center",
                        justifyContent:"center", pointerEvents:"none", opacity:.04, fontSize:110 }}>🥋</div>

                      {/* Header */}
                      <div style={{ textAlign:"center", marginBottom:14, position:"relative" }}>
                        <div style={{ fontSize:8, fontWeight:700, color:"#b8860b", letterSpacing:".4em",
                          textTransform:"uppercase", marginBottom:6 }}>Dojo Master Online</div>
                        <div style={{ fontFamily:"'Cinzel',serif", fontSize:26, fontWeight:900,
                          color:"#7f1d1d", letterSpacing:".12em", lineHeight:1 }}>DIPLOMA</div>
                        <div style={{ fontSize:9, color:"#a0845c", letterSpacing:".25em",
                          textTransform:"uppercase", marginTop:4 }}>de Ascenso de Grado</div>
                      </div>

                      {/* Línea divisoria dorada */}
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                        <div style={{ flex:1, height:1, background:`linear-gradient(to right,transparent,${GOLD})` }}/>
                        <div style={{ fontSize:14, color:GOLD }}>✦</div>
                        <div style={{ flex:1, height:1, background:`linear-gradient(to left,transparent,${GOLD})` }}/>
                      </div>

                      {/* Cuerpo */}
                      <div style={{ textAlign:"center", marginBottom:14 }}>
                        <div style={{ fontSize:9, color:"#888", marginBottom:4, fontStyle:"italic" }}>
                          Se certifica que el alumno
                        </div>
                        <div style={{ fontFamily:"'Cinzel',serif", fontSize:18, fontWeight:900,
                          color:"#1a0a00", marginBottom:4, letterSpacing:".05em" }}>
                          Carlos Molina
                        </div>
                        <div style={{ fontSize:9, color:"#888", marginBottom:8, fontStyle:"italic" }}>
                          ha completado satisfactoriamente los requisitos y alcanzado el grado de
                        </div>
                        <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 20px",
                          borderRadius:4, background:"rgba(120,53,15,.08)",
                          border:`1px solid rgba(120,53,15,.2)`,
                          fontSize:13, fontWeight:800, color:"#78350f" }}>
                          🟤 &nbsp;Cinta Café
                        </div>
                      </div>

                      {/* Línea divisoria */}
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                        <div style={{ flex:1, height:1, background:`linear-gradient(to right,transparent,${GOLD}60)` }}/>
                        <div style={{ fontSize:10, color:`${GOLD}90` }}>✦</div>
                        <div style={{ flex:1, height:1, background:`linear-gradient(to left,transparent,${GOLD}60)` }}/>
                      </div>

                      {/* Pie — firmas */}
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
                        {[["Jul 2026","Fecha de otorgamiento"],["Roberto Arias","Sensei — Dojo Bushido"]].map(([v,k])=>(
                          <div key={k} style={{ textAlign:"center", flex:1 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:"#333",
                              borderBottom:`1px solid #c8a96e`, paddingBottom:3, marginBottom:4,
                              fontFamily:"'Cinzel',serif" }}>{v}</div>
                            <div style={{ fontSize:8, color:"#999", letterSpacing:".05em" }}>{k}</div>
                          </div>
                        ))}
                        <div style={{ textAlign:"center", flex:1 }}>
                          <div style={{ width:36, height:36, borderRadius:"50%",
                            border:`2px solid ${GOLD}`, margin:"0 auto 4px",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:16, background:`${GOLD}15` }}>🥋</div>
                          <div style={{ fontSize:8, color:"#999" }}>Sello oficial</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
              <div>
                <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px",
                  borderRadius:100, fontSize:12, fontWeight:700, background:`${GOLD}22`, color:GOLD,
                  marginBottom:20 }}>
                  <Award size={13}/> {es?"Automático en cada ascenso":"Auto-generated on each promotion"}
                </div>
                <h3 style={{ fontFamily:"'Cinzel',serif", fontWeight:900, fontSize:"clamp(1.5rem,3vw,2.2rem)",
                  lineHeight:1.15, marginBottom:16, color:"#eef0f8" }}>
                  {es?"Diploma y carnet digital\nsin papelería ni trámites":"Digital diploma and ID card\nno paperwork needed"}
                </h3>
                <p style={{ color:"rgba(255,255,255,.68)", fontSize:16, lineHeight:1.75, marginBottom:24 }}>
                  {es
                    ? "Cada vez que un alumno asciende de cinta, el sistema genera automáticamente su diploma y actualiza su carnet digital. El alumno lo ve al instante en su portal — sin que el Sensei llene formularios ni gestione impresiones."
                    : "Every time a student is promoted, the system auto-generates their diploma and updates their digital ID. The student sees it instantly in their portal — no forms to fill, no printing to manage."}
                </p>
                {(es
                  ? ["Diploma generado al registrar el cambio de cinta","Carnet digital actualizado automáticamente con la nueva cinta","El alumno descarga su diploma desde su portal sin pedirlo","Historial completo de todos sus ascensos con fecha y Sensei firmante","Sin impresoras, sin formularios, sin demoras — 100% automatizado"]
                  : ["Diploma generated when belt change is recorded","Digital ID auto-updated with the new belt","Student downloads their diploma from the portal without asking","Full history of all promotions with date and signing Sensei","No printers, no forms, no delays — 100% automated"]
                ).map(i=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:14, color:"rgba(255,255,255,.6)", marginBottom:8 }}>
                    <Check size={13} color={GOLD} style={{flexShrink:0}}/>{i}
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
                <p style={{ color:"rgba(255,255,255,.68)", fontSize:16, lineHeight:1.75, marginBottom:24 }}>
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

          {/* ── F4.5: Eventos y Logros del Atleta ── */}
          <Reveal>
            <div className="feat-grid">
              <div>
                <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px",
                  borderRadius:100, fontSize:12, fontWeight:700, background:"rgba(249,115,22,.18)", color:"#fb923c",
                  marginBottom:20 }}>
                  <Calendar size={13}/> {es?"Registro instantáneo":"Instant record"}
                </div>
                <h3 style={{ fontFamily:"'Cinzel',serif", fontWeight:900, fontSize:"clamp(1.5rem,3vw,2.2rem)",
                  lineHeight:1.15, marginBottom:16, color:"#eef0f8" }}>
                  {es?"Eventos, torneos y logros\nen el expediente del atleta":"Events, tournaments and achievements\nin the athlete's record"}
                </h3>
                <p style={{ color:"rgba(255,255,255,.68)", fontSize:16, lineHeight:1.75, marginBottom:24 }}>
                  {es
                    ? "Crea el evento, define qué alumnos participan y pasa lista el día del torneo con un toque. Califica medallas y posiciones al instante — todo queda grabado en el expediente permanente del atleta. El alumno puede explorar su historial de logros, las katas con las que ganó medallas y su crecimiento como karateka a lo largo del tiempo."
                    : "Create the event, pick participating students and take attendance on tournament day with one tap. Record medals and rankings instantly — everything stays in the athlete's permanent record. Students can explore their achievement history, the katas they won medals with and their growth as a karateka over time."}
                </p>
                {(es
                  ? ["Crea eventos con lista de participantes confirmados","Pasa lista el día del torneo en segundos","Califica medallas (oro, plata, bronce) y posiciones al instante","Los logros quedan en el expediente permanente del atleta","El alumno ve sus katas ganadoras y trayectoria en su portal","Explora el crecimiento de cada karateka a lo largo del tiempo"]
                  : ["Create events with confirmed participant list","Take attendance on tournament day in seconds","Record gold, silver, bronze medals and rankings instantly","Achievements stay in the athlete's permanent record","Student sees winning katas and trajectory in their portal","Explore each karateka's growth over time"]
                ).map(i=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:14, color:"rgba(255,255,255,.6)", marginBottom:8 }}>
                    <Check size={13} color="#fb923c" style={{flexShrink:0}}/>{i}
                  </div>
                ))}
              </div>
              <Reveal delay={150}>
                <div style={{ borderRadius:16, overflow:"hidden", background:BG,
                  border:"1.5px solid rgba(249,115,22,.25)",
                  boxShadow:"0 32px 80px rgba(0,0,0,.6), 0 0 40px rgba(249,115,22,.1)" }}>
                  <div style={{ padding:20 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:"#eef0f8" }}>Campeonato Nacional 2026</div>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,.4)", marginTop:2 }}>15 participantes · 4 katas</div>
                      </div>
                      <div style={{ padding:"3px 10px", borderRadius:100, fontSize:11, fontWeight:700,
                        background:"rgba(249,115,22,.2)", color:"#fb923c", flexShrink:0 }}>En curso</div>
                    </div>
                    {[
                      { name:"Ana Moreno",  kata:"Heian Shodan", medal:"🥇", medalColor:"#F59E0B" },
                      { name:"Luis Castro", kata:"Bassai Dai",   medal:"🥈", medalColor:"#94A3B8" },
                      { name:"María Salas", kata:"Kanku Dai",    medal:"🥉", medalColor:"#78716C" },
                      { name:"Juan Reyes",  kata:"Jion",         medal:"—",  medalColor:"rgba(255,255,255,.2)" },
                    ].map(row=>(
                      <div key={row.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                        borderRadius:10, marginBottom:6, background:CARD }}>
                        <div style={{ width:28, height:28, borderRadius:"50%", background:PRIMARY,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:10, fontWeight:900, color:"#fff", flexShrink:0 }}>
                          {row.name.split(" ").map((w:string)=>w[0]).join("").slice(0,2)}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:"#eef0f8" }}>{row.name}</div>
                          <div style={{ fontSize:10, color:"rgba(255,255,255,.4)" }}>{row.kata}</div>
                        </div>
                        <div style={{ fontSize:18, flexShrink:0 }}>{row.medal}</div>
                      </div>
                    ))}
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px",
                      borderRadius:10, marginTop:6, background:"rgba(16,185,129,.08)", border:"1px solid rgba(16,185,129,.2)" }}>
                      <Check size={13} color="#10B981" style={{flexShrink:0}}/>
                      <p style={{ fontSize:11, color:"rgba(255,255,255,.65)" }}>
                        {es?"Logros guardados en el expediente de cada atleta automáticamente":"Achievements saved to each athlete's record automatically"}
                      </p>
                    </div>
                  </div>
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
                <p style={{ color:"rgba(255,255,255,.68)", fontSize:16, lineHeight:1.75, marginBottom:24 }}>
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

          {/* ── F6: Carnet Digital QR ── */}
          <Reveal>
            <div className="feat-grid" style={{ marginBottom:0, marginTop:96 }}>
              <div>
                <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px",
                  borderRadius:100, fontSize:12, fontWeight:700, background:`${GOLD}22`, color:GOLD,
                  marginBottom:20 }}>
                  <IdCard size={13}/> {es?"Incluido en Silver y Gold":"Included in Silver & Gold"}
                </div>
                <h3 style={{ fontFamily:"'Cinzel',serif", fontWeight:900, fontSize:"clamp(1.5rem,3vw,2.2rem)",
                  lineHeight:1.15, marginBottom:16, color:"#eef0f8" }}>
                  {es?"Carnet digital con QR\npara cada alumno":"Digital ID card with QR\nfor every student"}
                </h3>
                <p style={{ color:"rgba(255,255,255,.68)", fontSize:16, lineHeight:1.75, marginBottom:24 }}>
                  {es
                    ? "Genera un carnet profesional con foto, nombre, equipo y un código QR único — listo para imprimir o compartir digitalmente. El alumno lo presenta para marcar su asistencia en segundos."
                    : "Generate a professional ID card with photo, name, team and a unique QR code — ready to print or share digitally. Students show it to check in within seconds."}
                </p>
                {(es
                  ? ["Diseño con los colores y logo de tu dojo","Listo para imprimir en formato tarjeta CR80","QR para marcar asistencia desde el scanner","Acceso público mediante link único y seguro","Datos del acudiente incluidos en el carnet"]
                  : ["Designed with your dojo's colors and logo","Ready to print in CR80 card format","QR for attendance check-in from the scanner","Secure public access via unique link","Guardian contact info included on the card"]
                ).map(i=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:14, color:"rgba(255,255,255,.6)", marginBottom:8 }}>
                    <Check size={13} color={GOLD} style={{flexShrink:0}}/>{i}
                  </div>
                ))}
              </div>
              <Reveal delay={150}>
                <div style={{ display:"flex", justifyContent:"center" }}>
                  <div style={{ width:240, borderRadius:16, overflow:"hidden", background:"#F5F5F5",
                    boxShadow:`0 32px 80px rgba(0,0,0,.6), 0 0 40px ${GOLD}15`,
                    border:`1.5px solid ${GOLD}30`, position:"relative" }}>
                    <div style={{ position:"absolute", top:0, left:0, width:60, height:60, background:PRIMARY, clipPath:"polygon(0 0, 0 100%, 100% 0)" }}/>
                    <div style={{ position:"absolute", top:0, right:0, width:60, height:60, background:PRIMARY, clipPath:"polygon(100% 0, 100% 100%, 0 0)" }}/>
                    <div style={{ padding:"32px 20px 16px", textAlign:"center", position:"relative", zIndex:1 }}>
                      <div style={{ width:88, height:88, borderRadius:"50%", background:"#ddd", margin:"0 auto 12px",
                        border:`4px solid ${PRIMARY}`, display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:28, fontWeight:900, color:"#888" }}>
                        AM
                      </div>
                      <div style={{ fontSize:15, fontWeight:800, color:"#111", textTransform:"uppercase", marginBottom:6 }}>
                        Ana Moreno
                      </div>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:16 }}>
                        <div style={{ flex:1, height:1.5, background:PRIMARY, maxWidth:30 }}/>
                        <span style={{ fontSize:9, fontWeight:700, color:PRIMARY, letterSpacing:".3em" }}>TEAM DOJO</span>
                        <div style={{ flex:1, height:1.5, background:PRIMARY, maxWidth:30 }}/>
                      </div>
                      <div style={{ width:104, height:104, margin:"0 auto", background:"#fff", borderRadius:8,
                        border:`2px solid ${PRIMARY}`, padding:8, display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
                        {QR_PATTERN.map((on, idx) => (
                          <div key={idx} style={{ background: on ? "#0A0A0A" : "transparent", borderRadius:1 }}/>
                        ))}
                      </div>
                    </div>
                    <div style={{ background:"#0A0A0A", padding:"10px 16px", textAlign:"center" }}>
                      <div style={{ fontSize:9, fontWeight:700, color:"#fff", letterSpacing:".15em", textTransform:"uppercase" }}>
                        {es?"Disciplina · Respeto · Constancia":"Discipline · Respect · Consistency"}
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
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
                    <p style={{ color:"rgba(255,255,255,.6)", fontSize:14, lineHeight:1.7 }}>{s.desc}</p>
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
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.48)", marginTop:2 }}>{t.role}</div>
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
            <p style={{ textAlign:"center", color:"rgba(255,255,255,.6)", fontSize:17, marginBottom:64 }}>
              {es?"Empieza gratis. Crece cuando necesites. Cancela cuando quieras.":"Start free. Scale when you need. Cancel anytime."}
            </p>
          </Reveal>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:20, alignItems:"stretch" }}>
            {plansLoading && dbPlans.length === 0 && [0,1,2].map(i => (
              <div key={i} style={{
                borderRadius:24, padding:28, height:380,
                background:BG, border:`2px solid ${BORDER}`,
                animation:"pulse 1.6s infinite",
              }}>
                <div style={{ width:"60%", height:18, borderRadius:6, background:BORDER, marginBottom:20 }}/>
                <div style={{ width:"40%", height:38, borderRadius:6, background:BORDER, marginBottom:24 }}/>
                {[0,1,2,3,4].map(j => (
                  <div key={j} style={{ width:`${85 - j*8}%`, height:12, borderRadius:6, background:BORDER, marginBottom:14 }}/>
                ))}
              </div>
            ))}
            {dbPlans.map((plan, i) => {
              const visual   = PLAN_VISUAL[plan.name] ?? PLAN_VISUAL_DEFAULT;
              const isFree   = plan.monthlyPrice === 0;
              const price    = isFree ? "$0" : `$${plan.monthlyPrice}`;
              const period   = isFree ? "gratis para siempre" : "/mes";
              const limit    = plan.maxStudents ? `Hasta ${plan.maxStudents} alumnos` : "Alumnos ilimitados";
              let features: string[] = [];
              try { features = JSON.parse(plan.features) as string[]; } catch { /* ignore */ }

              return (
                <Reveal key={plan.id} delay={i * 100}>
                  <div style={{
                    borderRadius:24, padding:28, display:"flex", flexDirection:"column", height:"100%",
                    position:"relative", background: visual.highlight ? CARD : BG,
                    border:`2px solid ${visual.highlight ? visual.color : BORDER}`,
                    boxShadow: visual.highlight ? `0 0 60px ${visual.color}30` : "none",
                  }}>
                    {visual.badge && (
                      <div style={{ position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)",
                        padding:"4px 18px", borderRadius:100, background:visual.color,
                        fontSize:11, fontWeight:900, color:"#fff", whiteSpace:"nowrap" }}>
                        {visual.badge}
                      </div>
                    )}
                    <div style={{ marginBottom:20 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                        <span style={{ fontSize:24 }}>{visual.emoji}</span>
                        <span style={{ fontWeight:900, fontSize:18, color:visual.color }}>{plan.name}</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"flex-end", gap:4, marginBottom:4 }}>
                        <span style={{ fontSize:44, fontWeight:900, color: visual.highlight ? visual.color : "#eef0f8", lineHeight:1 }}>{price}</span>
                        <span style={{ color:"rgba(255,255,255,.35)", fontSize:14, marginBottom:6 }}>{period}</span>
                      </div>
                      <p style={{ fontSize:12, color:"rgba(255,255,255,.45)", fontWeight:600 }}>{limit}</p>
                    </div>
                    <ul style={{ flex:1, marginBottom:24, listStyle:"none" }}>
                      {features.map(f => (
                        <li key={f} style={{ display:"flex", alignItems:"flex-start", gap:10, fontSize:13,
                          color:"rgba(255,255,255,.72)", marginBottom:10 }}>
                          <Check size={13} color={visual.color} style={{flexShrink:0,marginTop:2}}/>{f}
                        </li>
                      ))}
                      {visual.missing.map(f => (
                        <li key={f} style={{ display:"flex", alignItems:"flex-start", gap:10, fontSize:13,
                          color:"rgba(255,255,255,.32)", marginBottom:10, textDecoration:"line-through" }}>
                          <X size={13} color="rgba(255,255,255,.15)" style={{flexShrink:0,marginTop:2}}/>{f}
                        </li>
                      ))}
                    </ul>
                    <Link href={visual.ctaLink} style={{
                      display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                      padding:"14px", borderRadius:14, fontWeight:700, fontSize:14,
                      color: visual.highlight ? "#fff" : visual.color,
                      background: visual.highlight ? visual.color : "transparent",
                      border: visual.highlight ? "none" : `1.5px solid ${visual.color}60`,
                      transition:"all .2s",
                    }}>
                      {visual.cta} <ArrowRight size={14}/>
                    </Link>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={300}>
            <div style={{ marginTop:36, padding:24, borderRadius:16,
              border:"1px solid rgba(255,255,255,.06)", textAlign:"center", background:BG }}>
              <p style={{ fontSize:14, color:"rgba(255,255,255,.6)" }}>
                {es?"¿No sabes cuál elegir?":"Not sure which to choose?"}{" "}
                <a href={WA} target="_blank" rel="noopener noreferrer"
                  style={{ color:PRIMARY, fontWeight:700 }}>
                  {es?"Escríbenos por WhatsApp":"Chat with us on WhatsApp"}
                </a>
              </p>
              <p style={{ fontSize:11, color:"rgba(255,255,255,.38)", marginTop:8 }}>
                {es?"Todos los planes incluyen soporte técnico. Precios en USD. Consulta disponibilidad por país."
                  :"All plans include technical support. USD pricing. Check availability in your country."}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ ¿POR QUÉ ES GRATIS? ═════════════════════════════════ */}
      <section style={{ padding:"96px 32px" }}>
        <div style={{ maxWidth:1000, margin:"0 auto" }}>
          <Reveal>
            <p style={{ textAlign:"center", fontSize:11, fontWeight:700, letterSpacing:".2em",
              textTransform:"uppercase", color:PRIMARY, marginBottom:12 }}>
              {es?"Sin letra pequeña":"No fine print"}
            </p>
            <h2 style={{ textAlign:"center", fontFamily:"'Cinzel',serif", fontWeight:900,
              fontSize:"clamp(1.6rem,4vw,2.6rem)", marginBottom:16, color:"#eef0f8" }}>
              {es?"¿Por qué el Plan Bronce es gratis?":"Why is the Bronze Plan free?"}
            </h2>
            <p style={{ textAlign:"center", color:"rgba(255,255,255,.6)", fontSize:17, maxWidth:560, margin:"0 auto 64px" }}>
              {es?"No es una prueba de 14 días ni un anzuelo. Así es como funciona:":"It's not a 14-day trial or a bait. Here's how it works:"}
            </p>
          </Reveal>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:20 }}>
            {(es
              ? [
                  { icon:Shield,     title:"Gratis para siempre",        desc:"Hasta 20 alumnos, sin tarjeta de crédito y sin límite de tiempo. No es una prueba: es un plan real que podés usar indefinidamente." },
                  { icon:TrendingUp, title:"Así financiamos el desarrollo", desc:"Los dojos que crecen y necesitan más (carnets, diplomas, eventos, push de notificaciones, página web, postulaciones, Torneos Pro o alumnos ilimitados) pasan a Silver o Gold. Eso paga el desarrollo continuo de la plataforma para todos." },
                  { icon:Lock,       title:"Tus datos son tuyos",         desc:"Sin contratos de permanencia. Podés exportar la información de tus alumnos cuando quieras, te quedes con nosotros o no." },
                ]
              : [
                  { icon:Shield,     title:"Free forever",       desc:"Up to 20 students, no credit card, no time limit. It's not a trial — it's a real plan you can use indefinitely." },
                  { icon:TrendingUp, title:"How we fund development", desc:"Dojos that grow and need more (digital ID cards, diplomas, events, push notifications, website, exam applications, Tournament Pro or unlimited students) move to Silver or Gold. That funds ongoing development for everyone." },
                  { icon:Lock,       title:"Your data is yours", desc:"No long-term contracts. Export your students' information anytime, whether you stay with us or not." },
                ]
            ).map((item,i) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.title} delay={i*120}>
                  <div style={{ textAlign:"center", padding:36, borderRadius:24,
                    background:CARD, border:"1px solid rgba(255,255,255,.05)" }}>
                    <div style={{ width:64, height:64, borderRadius:18, margin:"0 auto 20px",
                      display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(16,185,129,.15)" }}>
                      <Icon size={26} color="#34d399"/>
                    </div>
                    <h3 style={{ fontWeight:800, fontSize:18, marginBottom:12, color:"#eef0f8" }}>{item.title}</h3>
                    <p style={{ color:"rgba(255,255,255,.6)", fontSize:14, lineHeight:1.7 }}>{item.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
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
                    <p style={{ paddingTop:14, fontSize:14, color:"rgba(255,255,255,.65)", lineHeight:1.75 }}>{faq.a}</p>
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
            <p style={{ color:"rgba(255,255,255,.65)", fontSize:17, maxWidth:540, margin:"0 auto 40px", lineHeight:1.7 }}>
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
            <p style={{ fontSize:13, color:"rgba(255,255,255,.38)" }}>
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
              <p style={{ color:"rgba(255,255,255,.45)", fontSize:13, lineHeight:1.65, maxWidth:220 }}>
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
              { title:"Módulos",   links:[["Alumnos","#funciones"],["Pagos","#funciones"],["Asistencia QR","#funciones"],["Torneos","#funciones"],["Página web","#funciones"],["Portal alumno","#funciones"]] },
            ].map(col=>(
              <div key={col.title}>
                <p style={{ fontWeight:700, fontSize:11, letterSpacing:".12em", textTransform:"uppercase",
                  color:"rgba(255,255,255,.5)", marginBottom:14 }}>{col.title}</p>
                {col.links.map(([l,h])=>(
                  <a key={l} href={h} style={{ display:"block", fontSize:13, color:"rgba(255,255,255,.45)",
                    marginBottom:8, transition:"color .2s" }}
                    onMouseEnter={e=>e.currentTarget.style.color="rgba(255,255,255,.8)"}
                    onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,.45)"}>{l}</a>
                ))}
              </div>
            ))}
            <div>
              <p style={{ fontWeight:700, fontSize:11, letterSpacing:".12em", textTransform:"uppercase",
                color:"rgba(255,255,255,.5)", marginBottom:14 }}>Contacto</p>
              <a href={WA} target="_blank" rel="noopener noreferrer"
                style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"rgba(255,255,255,.45)", marginBottom:10 }}>
                <MessageCircle size={13}/> WhatsApp soporte
              </a>
              <a href="mailto:admin@dojomasteronline.com"
                style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"rgba(255,255,255,.45)", marginBottom:20 }}>
                <Mail size={13}/> admin@dojomasteronline.com
              </a>
              <p style={{ fontWeight:700, fontSize:11, letterSpacing:".12em", textTransform:"uppercase",
                color:"rgba(255,255,255,.5)", marginBottom:10 }}>Acceso</p>
              <Link href="/login" style={{ fontSize:13, color:"rgba(255,255,255,.45)" }}>
                Iniciar sesión →
              </Link>
            </div>
          </div>
          <div style={{ borderTop:"1px solid rgba(255,255,255,.06)", paddingTop:24,
            display:"flex", flexWrap:"wrap", justifyContent:"space-between", gap:12 }}>
            <p style={{ fontSize:13, color:"rgba(255,255,255,.35)" }}>
              © {new Date().getFullYear()} Dojo Master · Todos los derechos reservados
            </p>
            <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
              <Link href="/legal#terminos" style={{ fontSize:12, color:"rgba(255,255,255,.4)" }}>
                Términos y Condiciones
              </Link>
              <Link href="/legal#devoluciones" style={{ fontSize:12, color:"rgba(255,255,255,.4)" }}>
                Política de Devoluciones
              </Link>
            </div>
            <p style={{ fontSize:12, color:"rgba(255,255,255,.3)" }}>
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
