"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Phone, Mail, Instagram, Clock, MapPin,
  Gift, Send, ChevronDown, CheckCircle, Star, X,
  Users, MessageCircle, ArrowRight, ShoppingBag,
  ChevronLeft, ChevronRight,
} from "lucide-react";

interface Schedule { id: string; name: string; days: string; startTime: string; endTime: string; description: string | null }
interface DojoPageData {
  published: boolean; heroTitle: string | null; heroSubtitle: string | null;
  heroImage: string | null; aboutText: string | null; aboutImage: string | null;
  primaryColor: string; showFreeTrial: boolean;
  showSchedules: boolean; showContact: boolean; showStore: boolean;
  address: string | null;
  galleryImages: unknown;
  stats:         unknown;
  testimonials:  unknown;
  sensei:        unknown;
}

interface Stat        { value: string; label: string }
interface Testimonial { name: string; role: string; quote: string; photo?: string }
interface Sensei      { name: string; rank: string; experience: string; bio: string; photo: string }
interface DojoData {
  id: string; name: string; slug: string; slogan: string | null;
  phone: string | null; email: string | null; instagramUrl: string | null;
  logo: string | null; schedules: Schedule[];
  organizations: DojoOrganization[];
  dojoPage: DojoPageData;
}

interface TrialForm {
  childName: string; childAge: string;
  parentName: string; parentPhone: string; parentEmail: string; message: string;
}

interface StoreProduct {
  id: string; name: string; description: string | null;
  price: number; currency: string; imageUrl: string | null; sizes: unknown;
}

interface DojoOrganization {
  id: string; name: string; logoUrl: string | null;
}

const EMPTY_FORM: TrialForm = { childName: "", childAge: "", parentName: "", parentPhone: "", parentEmail: "", message: "" };

function parseDays(raw: string): string {
  try {
    const days: string[] = JSON.parse(raw);
    const map: Record<string, string> = { lunes:"Lun", martes:"Mar", miercoles:"Mié", jueves:"Jue", viernes:"Vie", sabado:"Sáb", domingo:"Dom" };
    return days.map(d => map[d] ?? d).join(" · ");
  } catch { return raw; }
}

// ── Carrusel horizontal de galería ──────────────────────────────────────────
function GalleryCarousel({
  gallery, primary, onOpen,
}: {
  gallery: string[];
  primary: string;
  onOpen:  (url: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const SCROLL_AMOUNT = 300;

  function scroll(dir: "prev" | "next") {
    trackRef.current?.scrollBy({ left: dir === "next" ? SCROLL_AMOUNT : -SCROLL_AMOUNT, behavior: "smooth" });
  }

  return (
    <section id="atletas" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Encabezado */}
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: primary }}>
            Galería
          </p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Formación de <span style={{ color: primary }}>Atletas</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Cada entrenamiento forja carácter. Conoce a los atletas que dan vida a nuestro dojo.
          </p>
        </div>

        {/* Carrusel */}
        <div className="relative group/carousel">
          {/* Botón anterior */}
          <button
            onClick={() => scroll("prev")}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-200 shadow-lg"
            style={{ background: primary }}
            aria-label="Anterior"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>

          {/* Track de imágenes */}
          <div
            ref={trackRef}
            className="flex gap-3 overflow-x-auto pb-3 scroll-smooth"
            style={{
              scrollSnapType:    "x mandatory",
              scrollbarWidth:    "none",        // Firefox
              msOverflowStyle:   "none",        // IE
              WebkitOverflowScrolling: "touch", // iOS inertia
            }}
          >
            {gallery.map((url, i) => (
              <div
                key={i}
                className="shrink-0 rounded-xl overflow-hidden relative cursor-zoom-in group"
                style={{
                  width:       "220px",
                  height:      "165px",
                  scrollSnapAlign: "start",
                }}
                onClick={() => onOpen(url)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Atleta ${i + 1}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Overlay zoom */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,0.35)" }}
                >
                  <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Star size={15} className="text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Botón siguiente */}
          <button
            onClick={() => scroll("next")}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-200 shadow-lg"
            style={{ background: primary }}
            aria-label="Siguiente"
          >
            <ChevronRight size={20} className="text-white" />
          </button>

          {/* Ocultar scrollbar en WebKit */}
          <style>{`
            #atletas div::-webkit-scrollbar { display: none; }
          `}</style>
        </div>

        {/* Indicador desliza */}
        {gallery.length > 3 && (
          <p className="text-center text-white/30 text-xs mt-4 flex items-center justify-center gap-1.5">
            <ChevronLeft size={12} /> desliza para ver más <ChevronRight size={12} />
          </p>
        )}
      </div>
    </section>
  );
}

export function DojoPublicPage({ dojo }: { dojo: DojoData }) {
  const { dojoPage } = dojo;
  const primary  = dojoPage.primaryColor ?? "#C0392B";
  const whatsapp = dojo.phone?.replace(/\D/g, "");
  const gallery  = Array.isArray(dojoPage.galleryImages)
    ? (dojoPage.galleryImages as string[]).filter(Boolean)
    : [];

  const [form,        setForm]        = useState<TrialForm>(EMPTY_FORM);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [navOpen,     setNavOpen]     = useState(false);
  const [products,    setProducts]    = useState<StoreProduct[]>([]);
  const [selectedSize,setSelectedSize]= useState<Record<string,string>>({});
  const [lightbox,    setLightbox]    = useState<string|null>(null);

  // Cast JSON → typed arrays
  const stats:        Stat[]        = Array.isArray(dojoPage.stats)        ? (dojoPage.stats        as Stat[])        : [];
  const testimonials: Testimonial[] = Array.isArray(dojoPage.testimonials) ? (dojoPage.testimonials as Testimonial[]) : [];
  const sensei:       Sensei | null = dojoPage.sensei && typeof dojoPage.sensei === "object" && !Array.isArray(dojoPage.sensei)
    ? (dojoPage.sensei as Sensei)
    : null;

  // Cerrar lightbox con ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!dojoPage.showStore) return;
    fetch(`/api/public/store?slug=${dojo.slug}`)
      .then(r => r.ok ? r.json() : [])
      .then(setProducts)
      .catch(() => {});
  }, [dojo.slug, dojoPage.showStore]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setSubmitError("");
    try {
      const res = await fetch("/api/public/free-trial", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ slug: dojo.slug, ...form, childAge: Number(form.childAge) }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? "Error al enviar"); return; }
      setSubmitted(true);
      setForm(EMPTY_FORM);
    } catch { setSubmitError("Error de conexión. Inténtalo de nuevo."); }
    finally { setSubmitting(false); }
  }

  const heroTitle    = dojoPage.heroTitle    ?? dojo.name;
  const heroSubtitle = dojoPage.heroSubtitle ?? dojo.slogan ?? "Arte marcial · Disciplina · Vida";

  return (
    <div className="min-h-screen bg-[#0A0A14] text-white font-sans">

      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A14]/90 backdrop-blur-md border-b border-white/10">
        <div className="px-6 h-24 flex items-center">

          {/* ── Izquierda: logo + nombre ── */}
          <div className="flex items-center gap-3 shrink-0">
            {dojo.logo && (
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#C0392B] flex items-center justify-center shadow-lg">
                <Image src={dojo.logo} alt={dojo.name} width={48} height={48} className="object-contain" unoptimized />
              </div>
            )}
            <span className="font-bold text-xl tracking-wide">{dojo.name}</span>
          </div>

          {/* ── Centro: links de navegación ── */}
          <div className="hidden md:flex flex-1 items-center justify-center gap-8 text-sm text-white/70">
            {[["Inicio","inicio"],["Nosotros","nosotros"],
              ...(sensei               ? [["Sensei","sensei"]]         : []),
              ["Horarios","horarios"],
              ...(products.length > 0  ? [["Tienda","tienda"]]         : []),
              ...(gallery.length > 0   ? [["Atletas","atletas"]]       : []),
              ...(dojoPage.address     ? [["Ubicación","ubicacion"]]   : []),
              ["Contacto","contacto"]
            ].map(([label, href]) => (
              <a key={href} href={`#${href}`}
                className="hover:text-white transition-colors font-medium tracking-wide">{label}</a>
            ))}
          </div>

          {/* ── Derecha: botones de acción ── */}
          <div className="hidden md:flex items-center gap-3 shrink-0 ml-auto">
            <a href={`/dojo/${dojo.slug}/login`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
              Acceso de Estudiantes
            </a>
            {dojoPage.showFreeTrial && (
              <a href="#prueba" onClick={() => setNavOpen(false)}
                className="px-5 py-2.5 rounded-full text-white text-sm font-semibold transition-all hover:opacity-90 hover:scale-105"
                style={{ background: primary }}>
                Clase Gratuita
              </a>
            )}
          </div>

          {/* ── Mobile: hamburger ── */}
          <button onClick={() => setNavOpen(o => !o)} className="md:hidden p-2 text-white/70 ml-auto">
            <ChevronDown size={20} className={`transition-transform ${navOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        {navOpen && (
          <div className="md:hidden border-t border-white/10 px-4 py-3 space-y-2 bg-[#0A0A14]/95">
            {[["Inicio","inicio"],["Nosotros","nosotros"],
              ...(sensei               ? [["Sensei","sensei"]]       : []),
              ["Horarios","horarios"],
              ...(products.length > 0  ? [["Tienda","tienda"]]       : []),
              ...(gallery.length > 0   ? [["Atletas","atletas"]]     : []),
              ...(dojoPage.address     ? [["Ubicación","ubicacion"]] : []),
              ["Contacto","contacto"]
            ].map(([label, href]) => (
              <a key={href} href={`#${href}`} onClick={() => setNavOpen(false)}
                className="block py-2 text-white/70 hover:text-white">{label}</a>
            ))}
            <a href={`/dojo/${dojo.slug}/login`} onClick={() => setNavOpen(false)}
              className="block py-2 font-semibold text-white/70 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Acceso de Estudiantes
            </a>
            {dojoPage.showFreeTrial && (
              <a href="#prueba" onClick={() => setNavOpen(false)}
                className="block py-2 font-semibold" style={{ color: primary }}>
                🎁 Clase Gratuita
              </a>
            )}
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section id="inicio" className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Background: imagen si existe, si no gradiente */}
        {dojoPage.heroImage
          ? <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dojoPage.heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/65" />
            </>
          : <>
              <div className="absolute inset-0"
                style={{ background: `radial-gradient(ellipse at top, ${primary}22 0%, #0A0A14 60%)` }} />
              <div className="absolute inset-0 opacity-5"
                style={{ backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)", backgroundSize: "30px 30px" }} />
            </>
        }

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <h1 className="font-bold text-5xl md:text-7xl mb-4 tracking-tight leading-none">
            {heroTitle}
          </h1>
          <p className="text-xl md:text-2xl text-white/60 mb-8 max-w-2xl mx-auto leading-relaxed">
            {heroSubtitle}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            {dojoPage.showFreeTrial && (
              <a href="#prueba" onClick={() => setNavOpen(false)}
                className="flex items-center gap-2 px-8 py-4 rounded-full font-bold text-white text-lg transition-all hover:scale-105 shadow-lg"
                style={{ background: primary, boxShadow: `0 8px 32px ${primary}55` }}>
                <Gift size={20} /> Clase Gratuita
              </a>
            )}
            <a href="#horarios" onClick={() => setNavOpen(false)}
              className="flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg border border-white/20 hover:border-white/50 transition-all">
              Ver Horarios <ArrowRight size={18} />
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown size={24} className="text-white/30" />
        </div>
      </section>

      {/* ── Stats bar ── */}
      {stats.length > 0 && (
        <div className="py-10 px-6 border-y border-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-4xl md:text-5xl font-black mb-1" style={{ color: primary, fontFamily: "'Cinzel', serif" }}>
                  {s.value}
                </p>
                <p className="text-white/50 text-sm font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Organizaciones ── */}
      {dojo.organizations.length > 0 && (
        <div className="py-10 px-6 border-b border-white/5">
          <div className="max-w-4xl mx-auto">
            <p className="text-center text-xs font-bold uppercase tracking-widest text-white/30 mb-7">
              Avalado por
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
              {dojo.organizations.map(org => (
                <div key={org.id} className="flex flex-col items-center gap-2 group">
                  {org.logoUrl
                    ? // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={org.logoUrl} alt={org.name}
                        className="h-14 w-auto object-contain opacity-60 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0"
                      />
                    : <div
                        className="h-14 px-5 flex items-center justify-center rounded-xl text-sm font-bold text-white/40 group-hover:text-white/70 transition-colors border border-white/10"
                        style={{ background: "rgba(255,255,255,0.04)" }}>
                        {org.name}
                      </div>
                  }
                  {org.logoUrl && (
                    <span className="text-xs text-white/30 group-hover:text-white/50 transition-colors text-center">
                      {org.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── About ── */}
      {dojoPage.aboutText && (
        <section id="nosotros" className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className={`grid gap-12 items-center ${dojoPage.aboutImage ? "md:grid-cols-2" : ""}`}>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: primary }}>
                  Sobre nosotros
                </p>
                <h2 className="text-4xl font-bold mb-6 leading-tight">Conoce nuestro dojo</h2>
                <p className="text-white/60 text-lg leading-relaxed whitespace-pre-line">{dojoPage.aboutText}</p>

                <div className="mt-8 grid grid-cols-3 gap-4">
                  {[["🥋","Arte", "Marcial"],["🏆","Excelencia","Deportiva"],["❤️","Comunidad","Unida"]].map(([icon, t1, t2]) => (
                    <div key={t1} className="text-center p-4 rounded-2xl bg-white/5 border border-white/10">
                      <p className="text-2xl mb-1">{icon}</p>
                      <p className="text-xs font-semibold text-white/80">{t1}</p>
                      <p className="text-xs text-white/40">{t2}</p>
                    </div>
                  ))}
                </div>
              </div>
              {dojoPage.aboutImage && (
                <div className="rounded-3xl overflow-hidden aspect-square shadow-2xl">
                  <Image src={dojoPage.aboutImage} alt="Dojo" fill className="object-cover" />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Sensei ── */}
      {sensei && (
        <section id="sensei" className="py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: primary }}>
                Nuestro Sensei
              </p>
              <h2 className="text-4xl md:text-5xl font-bold">El maestro detrás del dojo</h2>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
              {/* Foto */}
              <div className="shrink-0">
                {sensei.photo
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img src={sensei.photo} alt={sensei.name}
                      className="w-52 h-52 md:w-64 md:h-64 rounded-full object-cover shadow-2xl"
                      style={{ border: `4px solid ${primary}60` }} />
                  : <div className="w-52 h-52 md:w-64 md:h-64 rounded-full flex items-center justify-center text-6xl font-black shadow-2xl"
                      style={{ background: primary+"22", border: `4px solid ${primary}60`, color: primary }}>
                      {sensei.name?.charAt(0) ?? "S"}
                    </div>
                }
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left space-y-5">
                {/* Nombre y rango */}
                <div>
                  <h3 className="text-3xl md:text-4xl font-black text-white mb-2"
                    style={{ fontFamily: "'Cinzel', serif" }}>
                    {sensei.name}
                  </h3>
                  <div className="flex items-center gap-2 justify-center md:justify-start">
                    <span className="px-4 py-1.5 rounded-full text-sm font-bold text-white"
                      style={{ background: primary }}>
                      {sensei.rank}
                    </span>
                    {sensei.experience && (
                      <span className="text-white/50 text-sm font-medium">
                        · {sensei.experience}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bio */}
                {sensei.bio && (
                  <p className="text-white/65 text-lg leading-relaxed">
                    {sensei.bio}
                  </p>
                )}

                {/* Stats del sensei si existen */}
                {stats.length > 0 && (
                  <div className="flex flex-wrap gap-6 justify-center md:justify-start pt-2">
                    {stats.map((s, i) => (
                      <div key={i}>
                        <p className="text-2xl font-black" style={{ color: primary }}>{s.value}</p>
                        <p className="text-white/40 text-xs">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Schedules ── */}
      {dojoPage.showSchedules !== false && dojo.schedules.length > 0 && (
        <section id="horarios" className="py-24 px-6 bg-white/[0.02]">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: primary }}>Horarios</p>
              <h2 className="text-4xl font-bold">Clases disponibles</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {dojo.schedules.map(s => (
                <div key={s.id}
                  className="p-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: primary + "25" }}>
                      <Clock size={18} style={{ color: primary }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-lg truncate">{s.name}</p>
                      <p className="text-white/50 text-sm font-mono">{s.startTime} – {s.endTime}</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold px-3 py-1 rounded-full w-fit"
                    style={{ background: primary + "20", color: primary }}>
                    {parseDays(s.days)}
                  </p>
                  {s.description && <p className="text-white/50 text-sm mt-2">{s.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Testimonios ── */}
      {testimonials.length > 0 && (
        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: primary }}>
                Testimonios
              </p>
              <h2 className="text-4xl md:text-5xl font-bold">Lo que dicen nuestros alumnos</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <div key={i} className="rounded-2xl p-6 flex flex-col gap-4"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {/* Estrellas */}
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} size={16} fill="#F59E0B" stroke="none" />
                    ))}
                  </div>
                  {/* Cita */}
                  <p className="text-white/75 text-sm leading-relaxed flex-1 italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  {/* Alumno */}
                  <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                    {t.photo
                      ? // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.photo} alt={t.name}
                          className="w-10 h-10 rounded-full object-cover shrink-0" />
                      : <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                          style={{ background: primary+"30", color: primary }}>
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                    }
                    <div>
                      <p className="font-semibold text-white text-sm">{t.name}</p>
                      <p className="text-white/40 text-xs">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Tienda ── */}
      {products.length > 0 && (
        <section id="tienda" className="py-24 px-6" style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center justify-center gap-2" style={{ color: primary }}>
                <ShoppingBag size={13}/> Tienda
              </p>
              <h2 className="text-4xl md:text-5xl font-bold mb-4">Nuestros Productos</h2>
              <p className="text-white/50 text-lg max-w-xl mx-auto">
                Selecciona tu talla y consúltanos por WhatsApp. Coordinamos pago y entrega directamente contigo.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(p => {
                const sizes   = Array.isArray(p.sizes) ? (p.sizes as string[]) : [];
                const chosen  = selectedSize[p.id] ?? "";
                const price   = new Intl.NumberFormat("es-PA", { style:"currency", currency: p.currency, minimumFractionDigits:2 }).format(p.price);
                const waMsg   = encodeURIComponent(
                  `Hola ${dojo.name}!\n\nEstoy interesado en:\n\n` +
                  `Producto: ${p.name}\n` +
                  (chosen ? `Talla: ${chosen}\n` : "") +
                  `Precio: ${price}\n\n` +
                  `Podrian informarme sobre disponibilidad, forma de pago y entrega?`
                );
                const waUrl = whatsapp ? `https://wa.me/${whatsapp}?text=${waMsg}` : "";

                return (
                  <div key={p.id} className="rounded-2xl overflow-hidden group"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    {/* Imagen */}
                    {p.imageUrl
                      ? // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt={p.name}
                          className="w-full h-56 object-cover block transition-transform duration-500 group-hover:scale-105" />
                      : <div className="w-full h-56 flex items-center justify-center"
                          style={{ background: primary+"15" }}>
                          <ShoppingBag size={40} style={{ color: primary, opacity:0.4 }} />
                        </div>
                    }

                    <div className="p-5 space-y-4">
                      {/* Nombre y precio */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-white text-lg leading-tight">{p.name}</p>
                          {p.description && (
                            <p className="text-white/50 text-sm mt-1 line-clamp-2">{p.description}</p>
                          )}
                        </div>
                        <p className="text-xl font-black shrink-0" style={{ color: primary }}>{price}</p>
                      </div>

                      {/* Selector de tallas */}
                      {sizes.length > 0 && (
                        <div>
                          <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Selecciona talla</p>
                          <div className="flex flex-wrap gap-2">
                            {sizes.map(s => (
                              <button key={s} onClick={() => setSelectedSize(ss => ({ ...ss, [p.id]: ss[p.id]===s ? "" : s }))}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                                style={{
                                  background: chosen===s ? primary : "transparent",
                                  borderColor: chosen===s ? primary : "rgba(255,255,255,0.15)",
                                  color: chosen===s ? "#fff" : "rgba(255,255,255,0.6)",
                                }}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Botón WhatsApp */}
                      {waUrl ? (
                        <a href={waUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                          style={{ background: "#25D366", boxShadow: "0 4px 16px #25D36640" }}>
                          <MessageCircle size={18} fill="white"/> Consultar por WhatsApp
                        </a>
                      ) : (
                        <p className="text-center text-white/30 text-sm py-2">
                          Contáctanos para más información
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Galería de atletas — carrusel horizontal ── */}
      {gallery.length > 0 && (
        <GalleryCarousel gallery={gallery} primary={primary} onOpen={setLightbox} />
      )}

      {/* ── Ubicación ── */}
      {dojoPage.address && (
        <section id="ubicacion" className="py-20 px-6" style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: primary }}>
              Ubicación
            </p>
            <h2 className="text-3xl md:text-4xl font-bold mb-8">¿Dónde encontrarnos?</h2>

            <div className="inline-flex items-start gap-3 px-6 py-4 rounded-2xl mb-8 text-left"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <MapPin size={20} className="shrink-0 mt-0.5" style={{ color: primary }} />
              <p className="text-white/70 text-lg leading-relaxed">{dojoPage.address}</p>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dojoPage.address)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-bold text-white transition-all hover:scale-105"
                style={{ background: primary, boxShadow: `0 4px 20px ${primary}55` }}>
                <MapPin size={18} /> Ver en Google Maps
              </a>
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}?text=Hola! Quisiera saber cómo llegar al dojo`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-bold text-white transition-all hover:scale-105"
                  style={{ background: "#25D366" }}>
                  <MessageCircle size={18} /> Preguntar por WhatsApp
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Free Trial Form ── */}
      {dojoPage.showFreeTrial && (
        <section id="prueba" className="py-24 px-6">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: primary + "25" }}>
                <Gift size={28} style={{ color: primary }} />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: primary }}>
                Beca deportiva
              </p>
              <h2 className="text-4xl font-bold mb-3">Solicita tu clase gratuita</h2>
              <p className="text-white/50 text-lg">
                Completa el formulario y nos pondremos en contacto contigo para agendar la clase de prueba.
              </p>
            </div>

            {submitted ? (
              <div className="text-center p-10 rounded-3xl border border-green-500/30 bg-green-500/10">
                <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-green-300 mb-2">¡Solicitud enviada!</h3>
                <p className="text-white/60">
                  Nos pondremos en contacto contigo muy pronto para coordinar tu clase de prueba.
                  {whatsapp && (
                    <> También puedes escribirnos directamente por{" "}
                      <a href={`https://wa.me/${whatsapp}?text=Hola! Solicité una clase gratuita en ${dojo.name}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-green-400 underline">WhatsApp</a>.
                    </>
                  )}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}
                className="space-y-4 p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm">

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-1.5">
                      Nombre del niño/a *
                    </label>
                    <input
                      value={form.childName}
                      onChange={e => setForm(p => ({ ...p, childName: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                      placeholder="Nombre completo" required style={{ fontSize: "16px" }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-1.5">
                      Edad del niño/a *
                    </label>
                    <input
                      type="number" min={3} max={18}
                      value={form.childAge}
                      onChange={e => setForm(p => ({ ...p, childAge: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                      placeholder="Ej. 8" required style={{ fontSize: "16px" }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-1.5">
                      Nombre del padre/madre *
                    </label>
                    <input
                      value={form.parentName}
                      onChange={e => setForm(p => ({ ...p, parentName: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                      placeholder="Tu nombre" required style={{ fontSize: "16px" }}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-1.5">
                      WhatsApp / Teléfono *
                    </label>
                    <input
                      type="tel"
                      value={form.parentPhone}
                      onChange={e => setForm(p => ({ ...p, parentPhone: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                      placeholder="+507 6000-0000" required style={{ fontSize: "16px" }}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-1.5">
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      value={form.parentEmail}
                      onChange={e => setForm(p => ({ ...p, parentEmail: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                      placeholder="opcional" style={{ fontSize: "16px" }}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-1.5">
                      ¿Alguna pregunta o comentario?
                    </label>
                    <textarea
                      value={form.message}
                      onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30 resize-none"
                      placeholder="Opcional..." style={{ fontSize: "16px" }}
                    />
                  </div>
                </div>

                {submitError && (
                  <p className="text-red-400 text-sm text-center">{submitError}</p>
                )}

                <button type="submit" disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-lg text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                  style={{ background: primary }}>
                  {submitting
                    ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</>
                    : <><Send size={20} /> Solicitar Clase Gratuita</>
                  }
                </button>
                <p className="text-xs text-white/30 text-center">
                  Al enviar aceptas que nos pongamos en contacto contigo para coordinar la clase.
                </p>
              </form>
            )}
          </div>
        </section>
      )}

      {/* ── Contact ── */}
      {dojoPage.showContact !== false && <section id="contacto" className="py-24 px-6 bg-white/[0.02] border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: primary }}>Contacto</p>
          <h2 className="text-4xl font-bold mb-4">¿Tienes alguna pregunta?</h2>
          <p className="text-white/50 text-lg mb-10">Estamos aquí para ayudarte. Contáctanos por WhatsApp, correo o visítanos.</p>

          <div className="flex flex-wrap justify-center gap-4">
            {whatsapp && (
              <a href={`https://wa.me/${whatsapp}?text=Hola ${dojo.name}, me gustaría obtener más información`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-6 py-3.5 rounded-2xl font-bold text-white transition-all hover:scale-105"
                style={{ background: "#25D366", boxShadow: "0 4px 20px #25D36655" }}>
                <MessageCircle size={20} /> WhatsApp
              </a>
            )}
            {dojo.email && (
              <a href={`mailto:${dojo.email}`}
                className="flex items-center gap-3 px-6 py-3.5 rounded-2xl font-bold text-white border border-white/20 hover:border-white/40 transition-all">
                <Mail size={20} /> {dojo.email}
              </a>
            )}
            {dojo.phone && (
              <a href={`tel:${dojo.phone}`}
                className="flex items-center gap-3 px-6 py-3.5 rounded-2xl font-bold text-white border border-white/20 hover:border-white/40 transition-all">
                <Phone size={20} /> {dojo.phone}
              </a>
            )}
            {dojo.instagramUrl && (
              <a href={dojo.instagramUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-6 py-3.5 rounded-2xl font-bold text-white transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)" }}>
                <Instagram size={20} /> Instagram
              </a>
            )}
          </div>
        </div>
      </section>}

      {/* ── Footer ── */}
      <footer className="py-8 px-6 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-white/30 text-sm">
          <p>© {new Date().getFullYear()} {dojo.name}. Todos los derechos reservados.</p>
          <a href="https://dojomasteronline.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-white/20 hover:text-white/40 transition-colors text-xs">
            <span>by</span>
            <span className="font-semibold text-white/30">dojomasteronline.com</span>
          </a>
        </div>
      </footer>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.95)" }}
          onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Foto ampliada"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <X size={22} />
          </button>
        </div>
      )}

      {/* ── Sticky CTA móvil ── */}
      {dojoPage.showFreeTrial && (
        <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden pointer-events-none">
          <div className="px-4 pb-4 pt-8" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.9) 60%, transparent)" }}>
            <a href="#prueba" onClick={() => setNavOpen(false)}
              className="pointer-events-auto flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl font-bold text-white text-base transition-all active:scale-[0.98]"
              style={{ background: primary, boxShadow: `0 4px 24px ${primary}70` }}>
              <Gift size={20} /> Solicitar Clase Gratuita — ¡Es Gratis!
            </a>
          </div>
        </div>
      )}

      {/* ── Fixed WhatsApp button ── */}
      {whatsapp && (
        <a href={`https://wa.me/${whatsapp}?text=Hola ${dojo.name}, me gustaría obtener más información`}
          target="_blank" rel="noopener noreferrer"
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-50 transition-all hover:scale-110"
          style={{ background: "#25D366", boxShadow: "0 4px 24px #25D36670" }}
          title="Contáctanos por WhatsApp">
          <MessageCircle size={26} className="text-white" fill="white" />
        </a>
      )}
    </div>
  );
}
