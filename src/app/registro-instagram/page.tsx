import type { Metadata } from "next";
import { QrCode, CreditCard, IdCard, Trophy, Bell, MessageCircle, ArrowRight, Award, Globe, Video } from "lucide-react";
import RegisterForm from "@/components/register/RegisterForm";
import FaqAccordion from "@/components/register/FaqAccordion";
import PlansCarousel from "@/components/register/PlansCarousel";

const PRIMARY = "#C0392B";

export const metadata: Metadata = {
  title: "Crea tu dojo gratis — Dojo Master",
  description: "Deja el Excel y el WhatsApp desordenado. Administra tu dojo de karate en un solo lugar — tu primer mes es gratis.",
  robots: { index: false, follow: false }, // página de campaña — no se indexa en buscadores
};

const BENEFITS = [
  { icon: QrCode,     title: "Asistencia QR",         desc: "Solo con el celular, sin hardware" },
  { icon: CreditCard, title: "Cobros automáticos",     desc: "Recordatorios de mora sin que muevas un dedo" },
  { icon: IdCard,     title: "Carnets digitales",      desc: "Tus alumnos siempre identificados" },
  { icon: Trophy,     title: "Gestión de torneos",     desc: "Inscripciones, tatamis y resultados en vivo" },
  { icon: Globe,      title: "Landing page de tu dojo", desc: "Sitio propio con logo, horarios y galería (plan Torneo)" },
];

// Automatizaciones reales del sistema (verificadas en código, no aspiracionales):
// recordatorios de pago (src/app/api/payments/remind), recibos por WhatsApp con
// PDF (src/lib/whatsapp/receiptPdf.ts), asistencia QR (/scanner), carnet digital
// y diplomas/certificados (auto-generados al ascender de cinta o aprobar examen).
const AUTOMATIONS = [
  { icon: Bell,          title: "Recordatorios automáticos de pago", desc: "El sistema identifica pagos pendientes y envía el aviso." },
  { icon: MessageCircle, title: "Recibos por WhatsApp",              desc: "Envía automáticamente la información del pago al alumno." },
  { icon: QrCode,        title: "Asistencia QR",                     desc: "El alumno escanea y queda registrada su asistencia." },
  { icon: IdCard,        title: "Carnet digital",                    desc: "Cada alumno tiene su identificación disponible desde el celular." },
  { icon: Award,         title: "Diplomas y certificados",           desc: "Se generan automáticamente al ascender de cinta o aprobar un examen." },
];

/**
 * Landing aislada para tráfico pagado de Instagram Ads.
 * Sin nav ni footer del sitio principal — un único objetivo: registro.
 * Reutiliza RegisterForm tal cual (misma validación, mismo endpoint
 * POST /api/public/register) para no duplicar lógica ni comportamiento.
 * El formulario va justo después de "Automatizaciones" (video tutoriales
 * de kata queda después del formulario) — el CTA de cierre al final de la
 * página apunta de vuelta a #registro.
 */
export default function RegistroInstagramPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080C14", fontFamily: "'Nunito', sans-serif" }}>

      {/* ── Hero ── */}
      <section className="px-4 pt-14 pb-10 text-center">
        <div className="max-w-xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: PRIMARY }}>
            Software para dojos de karate
          </p>
          <h1 className="font-black text-3xl sm:text-4xl text-white leading-tight mb-3" style={{ fontFamily: "'Cinzel', serif" }}>
            Deja el Excel y el WhatsApp desordenado atrás
          </h1>
          <p className="text-2xl sm:text-3xl font-black mb-4" style={{ color: PRIMARY }}>Hecho por senseis, para senseis.</p>
          <p className="text-white/55 text-base leading-relaxed mb-8">
            Alumnos, pagos, asistencia y cintas — todo en un solo lugar.
            Sin tarjeta de crédito, tu primer mes es gratis.
          </p>
          <a
            href="#registro"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black text-white text-base transition-all hover:opacity-90 hover:scale-[1.02]"
            style={{ background: PRIMARY, boxShadow: `0 4px 24px ${PRIMARY}50` }}
          >
            Crea tu dojo gratis
          </a>
        </div>
      </section>

      {/* ── Beneficios rápidos ── */}
      <section className="px-4 pb-12">
        <div className="max-w-xl mx-auto grid grid-cols-2 gap-x-6 gap-y-5">
          {BENEFITS.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className={`flex items-start gap-3 ${i === BENEFITS.length - 1 && BENEFITS.length % 2 === 1 ? "col-span-2" : ""}`}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${PRIMARY}22` }}>
                <Icon size={18} style={{ color: PRIMARY }} />
              </div>
              <div>
                <p className="font-bold text-sm text-white mb-0.5">{title}</p>
                <p className="text-xs text-white/45 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Automatizaciones ── */}
      <section className="px-4 pb-12">
        <div className="max-w-xl mx-auto">
          <h2 className="font-black text-xl sm:text-2xl text-white text-center leading-tight mb-6" style={{ fontFamily: "'Cinzel', serif" }}>
            Deja que Dojo Master haga el trabajo
          </h2>
          <div className="rounded-3xl p-5 border border-white/5 space-y-5" style={{ background: "#111827" }}>
            {AUTOMATIONS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${PRIMARY}22` }}>
                  <Icon size={19} style={{ color: PRIMARY }} />
                </div>
                <div>
                  <p className="font-bold text-sm text-white mb-0.5">{title}</p>
                  <p className="text-xs text-white/45 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Formulario ── */}
      <section id="registro" className="px-4 pb-16 scroll-mt-6">
        <div className="max-w-xl mx-auto">
          <RegisterForm />
        </div>
      </section>

      {/* ── Video tutoriales de kata ── */}
      <section className="px-4 pb-12">
        <div className="max-w-xl mx-auto rounded-3xl p-6 border border-white/5 text-center" style={{ background: "#111827" }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: `${PRIMARY}22` }}>
            <Video size={20} style={{ color: PRIMARY }} />
          </div>
          <h2 className="font-black text-lg text-white mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
            Tus alumnos practican también en casa
          </h2>
          <p className="text-sm text-white/50 leading-relaxed max-w-sm mx-auto">
            Sube el video tutorial de cada kata por cinta. Cada alumno lo ve en su portal — solo las cintas que ya obtuvo.
          </p>
          <p className="text-[11px] text-white/30 mt-3">Plan Academia y padres en adelante</p>
        </div>
      </section>

      {/* ── Preguntas frecuentes ── */}
      <section className="px-4 pb-16">
        <div className="max-w-xl mx-auto">
          <h2 className="font-black text-2xl text-white text-center mb-6" style={{ fontFamily: "'Cinzel', serif" }}>
            Preguntas frecuentes
          </h2>
          <FaqAccordion />
        </div>
      </section>

      {/* ── Planes — carrusel horizontal, mismo estilo que el home ── */}
      <section className="pb-16">
        <p className="text-center text-xs font-bold text-white/40 uppercase tracking-widest mb-4 px-4">
          Planes — 1er mes gratis
        </p>
        <PlansCarousel />
      </section>

      {/* ── CTA de cierre — vuelve a subir al formulario (#registro) ── */}
      <section className="px-4 pb-10">
        <div
          className="max-w-xl mx-auto rounded-3xl text-center px-6 py-12 border-2"
          style={{ background: `${PRIMARY}14`, borderColor: `${PRIMARY}40` }}
        >
          <h2 className="font-black text-2xl sm:text-3xl text-white leading-tight mb-3" style={{ fontFamily: "'Cinzel', serif" }}>
            ¿Listo para dejar el Excel atrás?
          </h2>
          <p className="text-white/60 text-base mb-1">Administra tu dojo desde un solo lugar.</p>
          <p className="text-white/60 text-base mb-8">
            <strong className="text-white">Primer mes GRATIS.</strong> Sin tarjeta de crédito.
          </p>
          <a
            href="#registro"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black text-white text-base transition-all hover:opacity-90 hover:scale-[1.02]"
            style={{ background: PRIMARY, boxShadow: `0 4px 24px ${PRIMARY}50` }}
          >
            Crea tu dojo gratis <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* ── Footer mínimo ── */}
      <footer className="mt-auto px-4 py-6 text-center border-t border-white/5">
        <p className="text-xs text-white/30">
          <a href="/terminos" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/50 transition-colors">
            Términos de Uso
          </a>
          {" · "}
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/50 transition-colors">
            Política de Privacidad
          </a>
        </p>
      </footer>
    </div>
  );
}
