"use client";
import { useState } from "react";
import Image from "next/image";
import {
  Phone, Mail, Instagram, Clock, MapPin,
  Gift, Send, ChevronDown, CheckCircle, Star,
  Users, MessageCircle, ArrowRight,
} from "lucide-react";

interface Schedule { id: string; name: string; days: string; startTime: string; endTime: string; description: string | null }
interface DojoPageData {
  published: boolean; heroTitle: string | null; heroSubtitle: string | null;
  heroImage: string | null; aboutText: string | null; aboutImage: string | null;
  primaryColor: string; showFreeTrial: boolean;
  showSchedules: boolean; showContact: boolean;
}
interface DojoData {
  id: string; name: string; slug: string; slogan: string | null;
  phone: string | null; email: string | null; instagramUrl: string | null;
  logo: string | null; schedules: Schedule[];
  dojoPage: DojoPageData;
}

interface TrialForm {
  childName: string; childAge: string;
  parentName: string; parentPhone: string; parentEmail: string; message: string;
}

const EMPTY_FORM: TrialForm = { childName: "", childAge: "", parentName: "", parentPhone: "", parentEmail: "", message: "" };

function parseDays(raw: string): string {
  try {
    const days: string[] = JSON.parse(raw);
    const map: Record<string, string> = { lunes:"Lun", martes:"Mar", miercoles:"Mié", jueves:"Jue", viernes:"Vie", sabado:"Sáb", domingo:"Dom" };
    return days.map(d => map[d] ?? d).join(" · ");
  } catch { return raw; }
}

export function DojoPublicPage({ dojo }: { dojo: DojoData }) {
  const { dojoPage } = dojo;
  const primary  = dojoPage.primaryColor ?? "#C0392B";
  const whatsapp = dojo.phone?.replace(/\D/g, "");

  const [form,        setForm]        = useState<TrialForm>(EMPTY_FORM);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [navOpen,     setNavOpen]     = useState(false);

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
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {dojo.logo && (
              <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#C0392B] flex items-center justify-center">
                <Image src={dojo.logo} alt={dojo.name} width={36} height={36} className="object-contain" unoptimized />
              </div>
            )}
            <span className="font-bold text-lg tracking-wide">{dojo.name}</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6 text-sm text-white/70">
            {["Inicio","Nosotros","Horarios","Contacto"].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`}
                className="hover:text-white transition-colors">{item}</a>
            ))}
            {dojoPage.showFreeTrial && (
              <a href="#prueba"
                className="px-4 py-2 rounded-full text-white text-sm font-semibold transition-all hover:opacity-90"
                style={{ background: primary }}>
                Clase Gratuita
              </a>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button onClick={() => setNavOpen(o => !o)} className="md:hidden p-2 text-white/70">
            <ChevronDown size={20} className={`transition-transform ${navOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        {navOpen && (
          <div className="md:hidden border-t border-white/10 px-4 py-3 space-y-2 bg-[#0A0A14]/95">
            {["Inicio","Nosotros","Horarios","Contacto"].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setNavOpen(false)}
                className="block py-2 text-white/70 hover:text-white">{item}</a>
            ))}
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
          {dojo.logo && (
            <div className="w-24 h-24 rounded-3xl overflow-hidden mx-auto mb-8 shadow-2xl"
              style={{ border: `2px solid ${primary}60`, background: primary + "33" }}>
              <Image src={dojo.logo} alt={dojo.name} width={96} height={96} className="object-contain w-full h-full" unoptimized />
            </div>
          )}
          <h1 className="font-bold text-5xl md:text-7xl mb-4 tracking-tight leading-none">
            {heroTitle}
          </h1>
          <p className="text-xl md:text-2xl text-white/60 mb-8 max-w-2xl mx-auto leading-relaxed">
            {heroSubtitle}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            {dojoPage.showFreeTrial && (
              <a href="#prueba"
                className="flex items-center gap-2 px-8 py-4 rounded-full font-bold text-white text-lg transition-all hover:scale-105 shadow-lg"
                style={{ background: primary, boxShadow: `0 8px 32px ${primary}55` }}>
                <Gift size={20} /> Clase Gratuita
              </a>
            )}
            <a href="#horarios"
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
          <p>Gestionado con <span className="text-white/50 font-semibold">Dojo Master</span></p>
        </div>
      </footer>

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
