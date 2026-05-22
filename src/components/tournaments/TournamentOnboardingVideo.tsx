"use client";
import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Crown } from "lucide-react";

const LS_KEY = "dojomanager_tournament_onboarding_seen";

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
    icon:  "🏆",
    title: "Bienvenido al módulo Torneo Pro",
    desc:  "Gestiona torneos completos de karate con brackets, tatamis, jueces en vivo y transmisión a YouTube. Este tutorial te guía en 6 pasos.",
    sub:   "Puedes volver a ver este tutorial con el botón 'Ver tutorial' en la lista de torneos.",
  },
  {
    step:  2,
    icon:  "📋",
    title: "Paso 1 — Crea tu torneo",
    desc:  "Pulsa '+ Nuevo Torneo', define el nombre, fecha, lugar y organización. Para torneos abiertos (clubs externos), activa el tipo 'Abierto' en el tab Información.",
    sub:   "El torneo empieza en estado 'Borrador'. Cámbialo a 'Listo' cuando estés listo para empezar.",
  },
  {
    step:  3,
    icon:  "🥋",
    title: "Paso 2 — Crea las categorías (brackets)",
    desc:  "En el tab Atletas, usa el formulario WKF encadenado: Tipo → Género → Grupo de edad → Peso. El nombre se genera automáticamente: 'Kumite Cadete -63kg Masculino'.",
    sub:   "Para torneos por cinta (internos), selecciona 'Por cinta' en lugar del grupo de edad.",
  },
  {
    step:  4,
    icon:  "🎯",
    title: "Paso 3 — Agrega participantes",
    desc:  "Selecciona tus alumnos directamente desde el sistema. Para torneos abiertos, los coaches externos agregan sus atletas solos con el link de inscripción.",
    sub:   "Después de agregar atletas, genera el cuadro con el botón 'Generar Bracket'. El orden es aleatorio respetando los seeds.",
  },
  {
    step:  5,
    icon:  "📺",
    title: "Paso 4 — Transmisión en vivo con OBS",
    desc:  "En el tab En Vivo, copia la URL del Overlay OBS de cada tatami. En OBS: agrega una fuente 'Navegador', pega la URL, dimensiones 1920×1080, activa 'Fondo Transparente'.",
    sub:   "El overlay muestra puntajes, timer y nombres de competidores en tiempo real — se actualiza cada 3 segundos sin recargar OBS.",
  },
  {
    step:  6,
    icon:  "📱",
    title: "Paso 5 — App del Juez",
    desc:  "En el tab En Vivo, cada juez tiene su propio link (App juez). Los jueces abren el link en su celular, seleccionan su nombre y puntúan Ippon / Waza-ari / Yuko en tiempo real.",
    sub:   "El árbitro selecciona el combate activo en el dropdown '★ COMBATE ACTIVO'. Esto activa la pantalla TV, el overlay OBS y la app del juez simultáneamente.",
  },
  {
    step:  7,
    icon:  "✅",
    title: "¡Listo para tu primer torneo!",
    desc:  "Cambia el estado a 'Activo', activa los tatamis y empieza. El botón ? en la esquina inferior derecha tiene ayuda contextual en cada pantalla.",
    sub:   "¿Dudas? Usa el botón ? en cualquier pantalla del dashboard para ver la guía de esa sección.",
    cta:   "Crear mi primer torneo →",
  },
];

interface Props {
  onCreateTournament?: () => void;
}

export function TournamentOnboardingVideo({ onCreateTournament }: Props) {
  const [open,    setOpen]    = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    // Mostrar solo la primera vez
    if (!localStorage.getItem(LS_KEY)) {
      setOpen(true);
    }
  }, []);

  function close() {
    localStorage.setItem(LS_KEY, "1");
    setOpen(false);
    setCurrent(0);
  }

  function prev() { setCurrent(c => Math.max(0, c - 1)); }
  function next() {
    if (current < STEPS.length - 1) setCurrent(c => c + 1);
    else { close(); onCreateTournament?.(); }
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
        animation: "fadeInScale 0.2s ease",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, rgba(192,57,43,0.2) 0%, rgba(192,57,43,0.05) 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Crown size={18} style={{ color: "#FFD700" }} />
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 600 }}>
              Tutorial — Torneo Pro
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
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1);    }
        }
      `}</style>
    </div>
  );
}

/**
 * Botón para re-abrir el tutorial desde la lista de torneos.
 * Llama openOnboarding() para mostrar el modal de nuevo.
 */
export function OnboardingReopenButton() {
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
