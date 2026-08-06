"use client";
import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Rocket } from "lucide-react";

const LS_KEY = "dojomanager_dashboard_onboarding_seen";

interface Step {
  step:  number;
  icon:  string;
  title: string;
  desc:  string;
  sub?:  string;
  cta?:  string; // solo en el último paso
}

const STEPS: Step[] = [
  {
    step:  1,
    icon:  "🥋",
    title: "Bienvenido a Dojo Master",
    desc:  "Este tour te muestra el flujo completo para arrancar: alumnos, asistencia y pagos. Son 6 pasos, 2 minutos.",
    sub:   "Puedes volver a ver este tour cuando quieras con el botón 'Ver tutorial' en el panel de control.",
  },
  {
    step:  2,
    icon:  "👥",
    title: "Paso 1 — Crea tus alumnos",
    desc:  "Dos formas de hacerlo: manual desde Alumnos → Nuevo alumno, o compartiendo el link de autoregistro para que cada familia complete sus propios datos.",
    sub:   "El link de autoregistro se genera y comparte desde Registros.",
  },
  {
    step:  3,
    icon:  "📋",
    title: "Paso 2 — Aprueba las solicitudes",
    desc:  "Cuando alguien se autoregistra con el link, no se crea como alumno de inmediato — llega como solicitud pendiente en Registros. Tú la revisas y la apruebas (o rechazas) para que se convierta en un alumno real de tu dojo.",
    sub:   "Si el correo o la cédula ya existen, el sistema te avisa antes de aprobar para evitar duplicados.",
  },
  {
    step:  4,
    icon:  "📱",
    title: "Cada alumno ya tiene su QR",
    desc:  "Tanto si lo creaste manual como si aprobaste una solicitud, el alumno queda con su propio código QR único automáticamente — no hay que generar nada aparte. Ese QR es lo que se escanea en el Scanner para marcar asistencia.",
  },
  {
    step:  5,
    icon:  "🗓️",
    title: "Paso 3 — Crea los horarios",
    desc:  "Antes de poder marcar asistencia, necesitas al menos un horario de clase. Ve a Asistencia → Horarios, crea el horario, y asígnale los alumnos que corresponden a ese turno.",
    sub:   "Un alumno puede estar en más de un horario a la vez.",
  },
  {
    step:  6,
    icon:  "💳",
    title: "Paso 4 — Asigna los pagos",
    desc:  "Entra al perfil de cada alumno y define su mensualidad en la sección Inscripción. Una vez configurado, cada mes solo tienes que ir a Pagos y usar el botón 'Generar Mensualidades' para crear el cobro de todos los alumnos activos de una sola vez.",
    sub:   "El botón de recordatorio por correo aparece en cada pago pendiente, listo para enviar.",
  },
  {
    step:  7,
    icon:  "✅",
    title: "¡Listo para arrancar!",
    desc:  "Con alumnos, horarios y pagos configurados ya tienes lo esencial funcionando. El botón ? en la esquina inferior derecha tiene ayuda contextual en cada pantalla del sistema.",
    sub:   "¿Dudas más adelante? El botón ? te explica cada módulo específico donde estés parado.",
    cta:   "Ir a Alumnos →",
  },
];

interface Props {
  /** Solo se muestra automáticamente para admin — es quien hace toda la configuración inicial. */
  role?: string;
}

export function DashboardOnboardingTour({ role }: Props) {
  const [open,    setOpen]    = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (role !== "admin") return;
    // Mostrar solo la primera vez
    if (!localStorage.getItem(LS_KEY)) {
      setOpen(true);
    }
  }, [role]);

  function close() {
    localStorage.setItem(LS_KEY, "1");
    setOpen(false);
    setCurrent(0);
  }

  function prev() { setCurrent(c => Math.max(0, c - 1)); }
  function next() {
    if (current < STEPS.length - 1) setCurrent(c => c + 1);
    else {
      close();
      window.location.href = "/dashboard/students";
    }
  }

  if (!open) return null;

  const step = STEPS[current];
  const isLast = current === STEPS.length - 1;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
      onClick={e => { if (e.target === e.currentTarget) close(); }}
    >
      <div style={{
        background: "#0d1117",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "20px",
        width: "100%", maxWidth: "520px",
        overflow: "hidden",
        animation: "fadeInScaleOnboarding 0.2s ease",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, rgba(192,57,43,0.2) 0%, rgba(192,57,43,0.05) 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Rocket size={18} style={{ color: "#FFD700" }} />
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 600 }}>
              Primeros pasos — Dojo Master
            </span>
          </div>
          <button onClick={close} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: "4px" }}>
            <X size={18} />
          </button>
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: "6px", justifyContent: "center", padding: "16px 20px 0" }}>
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} style={{
              width: i === current ? "24px" : "8px",
              height: "8px", borderRadius: "4px",
              background: i === current ? "#C0392B" : i < current ? "rgba(192,57,43,0.4)" : "rgba(255,255,255,0.15)",
              border: "none", cursor: "pointer",
              transition: "all 0.25s ease",
              padding: 0,
            }} />
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "24px 28px" }}>
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{ fontSize: "52px", marginBottom: "12px", lineHeight: 1 }}>{step.icon}</div>
            <h2 style={{ color: "white", fontSize: "20px", fontWeight: 800, margin: "0 0 12px", lineHeight: 1.3 }}>
              {step.title}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px", lineHeight: 1.7, margin: 0 }}>
              {step.desc}
            </p>
            {step.sub && (
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", lineHeight: 1.6, marginTop: "10px" }}>
                {step.sub}
              </p>
            )}
          </div>

          {/* Step counter */}
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: "12px", marginBottom: "20px" }}>
            {current + 1} de {STEPS.length}
          </p>

          {/* Navigation */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={prev}
              disabled={current === 0}
              style={{
                flex: 1, padding: "12px", borderRadius: "10px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: current === 0 ? "rgba(255,255,255,0.2)" : "white",
                cursor: current === 0 ? "not-allowed" : "pointer",
                fontWeight: 600, fontSize: "14px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              }}
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <button
              onClick={next}
              style={{
                flex: 2, padding: "12px", borderRadius: "10px",
                background: "#C0392B", border: "none",
                color: "white", cursor: "pointer",
                fontWeight: 700, fontSize: "14px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              }}
            >
              {isLast ? (step.cta ?? "Comenzar →") : (<>Siguiente <ChevronRight size={16} /></>)}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInScaleOnboarding {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1);    }
        }
      `}</style>
    </div>
  );
}

/**
 * Botón para re-abrir el tour desde el panel de control.
 */
export function DashboardOnboardingReopenButton() {
  function reopen() {
    localStorage.removeItem(LS_KEY);
    window.location.reload(); // el useEffect del modal lo detectará
  }
  return (
    <button
      onClick={reopen}
      style={{
        background: "none", border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "8px", padding: "6px 14px",
        color: "rgba(255,255,255,0.5)", cursor: "pointer",
        fontSize: "12px", fontWeight: 600,
        display: "flex", alignItems: "center", gap: "6px",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.color = "white")}
      onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
    >
      ▶ Ver tutorial
    </button>
  );
}
