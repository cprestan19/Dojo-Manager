"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const PRIMARY = "#C0392B";

// Mismo texto (verbatim) que las FAQs del home (src/app/page.tsx) — subset
// relevante para alguien a punto de registrarse, no se inventa copy nuevo.
const FAQS = [
  { q: "¿Necesito equipo especial para el control de asistencia?", a: "No. El scanner QR funciona desde la cámara de cualquier smartphone. El alumno muestra su código desde su portal y en menos de 1 segundo queda registrado. Sin lectores, sin tablets adicionales, sin costo extra." },
  { q: "¿Cómo reciben los alumnos sus recordatorios de pago?", a: "Automáticamente por correo electrónico. El sistema detecta pagos en mora según la tolerancia que configures y envía el recordatorio sin que hagas nada. También puedes enviarlo manualmente con un clic." },
  { q: "¿Necesito instalar alguna aplicación?", a: "No. Dojo Master es 100% en la nube. El Sensei gestiona todo desde el navegador de cualquier celular, tablet o computadora con internet. Los alumnos también acceden a su portal desde el navegador, sin descargar ninguna app. Funciona en iOS, Android, Windows y Mac." },
  { q: "¿Mis datos están seguros?", a: "Sí. Cada dojo tiene sus datos completamente aislados. Las imágenes van a Cloudinary (CDN global). Base de datos PostgreSQL con cifrado. Puedes exportar todo en CSV cuando quieras." },
  { q: "¿Cuánto tiempo toma configurarlo?", a: "La configuración básica (logo, nombre, primeros alumnos, primer QR) toma menos de 15 minutos. El primer día ya puedes pasar lista y controlar pagos. La web del dojo en menos de 30 minutos." },
];

export default function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-2.5">
      {FAQS.map((faq, i) => (
        <div
          key={faq.q}
          className="rounded-2xl border border-white/5 overflow-hidden cursor-pointer transition-colors hover:border-white/15"
          style={{ background: "#111827" }}
          onClick={() => setOpen(open === i ? null : i)}
        >
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <p className="font-semibold text-sm text-white/85">{faq.q}</p>
            <ChevronDown
              size={16}
              className="shrink-0 text-white/35 transition-transform duration-300"
              style={{ transform: open === i ? "rotate(180deg)" : "none" }}
            />
          </div>
          <div
            className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
            style={{ maxHeight: open === i ? 320 : 0 }}
          >
            <div className="px-5 pb-5 pt-0 border-t border-white/5">
              <p className="text-sm text-white/60 leading-relaxed pt-3.5">{faq.a}</p>
            </div>
          </div>
        </div>
      ))}
      <p className="text-center text-xs text-white/30 pt-1">
        ¿Otra pregunta?{" "}
        <a href="https://wa.me/50766261768" target="_blank" rel="noopener noreferrer"
          className="underline hover:text-white/50 transition-colors" style={{ color: PRIMARY }}>
          Escríbenos por WhatsApp
        </a>
      </p>
    </div>
  );
}
