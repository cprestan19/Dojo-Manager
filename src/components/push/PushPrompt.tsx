"use client";
import { useState, useEffect } from "react";
import { Bell, BellOff, X, Smartphone } from "lucide-react";
import { usePushSubscription } from "@/lib/hooks/usePushSubscription";

const STORAGE_KEY = "push_prompt_dismissed_at";
const DISMISS_DAYS = 30; // no volver a mostrar durante 30 días

interface Props {
  dojoName?: string;
  compact?:  boolean; // si true → versión pequeña inline (para usar dentro del portal)
}

export default function PushPrompt({ dojoName, compact = false }: Props) {
  const { state, subscribe, isIOS, isInstalled } = usePushSubscription();
  const [visible,    setVisible]    = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);

  useEffect(() => {
    if (state === "loading" || state === "subscribed" || state === "denied") return;

    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      const daysAgo = (Date.now() - Number(dismissed)) / (1000 * 60 * 60 * 24);
      if (daysAgo < DISMISS_DAYS) return;
    }
    setVisible(true);
  }, [state]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  }

  async function handleSubscribe() {
    // iOS: si no está instalada como PWA, mostrar instrucciones primero
    if (isIOS && !isInstalled) {
      setShowIOSTip(true);
      return;
    }
    setLoading(true);
    await subscribe();
    setLoading(false);
    setVisible(false);
  }

  if (!visible) return null;
  if (state === "unsupported") return null;

  // ── Tip especial para iOS ─────────────────────────────────────────────────
  if (showIOSTip) {
    return (
      <div className="bg-dojo-card border border-dojo-gold/40 rounded-xl p-4 mx-4 my-2">
        <div className="flex items-start gap-3">
          <Smartphone size={20} className="text-dojo-gold shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-dojo-white leading-tight">
              Para recibir notificaciones en iPhone
            </p>
            <ol className="mt-2 space-y-1 text-xs text-dojo-muted list-decimal list-inside leading-relaxed">
              <li>Toca el ícono de compartir <span className="text-dojo-white">⬆️</span> en Safari</li>
              <li>Selecciona <strong className="text-dojo-white">&ldquo;Agregar a pantalla de inicio&rdquo;</strong></li>
              <li>Abre la app desde tu pantalla de inicio</li>
              <li>Activa las notificaciones desde ahí</li>
            </ol>
          </div>
          <button onClick={() => { setShowIOSTip(false); setVisible(false); }} className="p-1 text-dojo-muted hover:text-dojo-white">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ── Banner compacto (para portal/page.tsx) ────────────────────────────────
  if (compact) {
    return (
      <div className="bg-dojo-card border border-dojo-border rounded-xl p-3 flex items-center gap-3">
        <Bell size={18} className="text-dojo-gold shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-dojo-white leading-tight">Activa las notificaciones</p>
          <p className="text-xs text-dojo-muted leading-tight">
            Recibe alertas de asistencia, pagos y más
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="text-xs bg-dojo-red text-white px-3 py-1.5 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Activar"}
          </button>
          <button onClick={dismiss} className="p-1 text-dojo-muted hover:text-dojo-white">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ── Banner completo ───────────────────────────────────────────────────────
  return (
    <div className="bg-gradient-to-r from-dojo-dark to-dojo-card border border-dojo-gold/30 rounded-xl p-4 mx-4 my-2 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-dojo-gold/10 rounded-full flex items-center justify-center shrink-0 border border-dojo-gold/30">
          <Bell size={17} className="text-dojo-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-dojo-white leading-tight">
            Recibe alertas en tu celular
          </p>
          <p className="text-xs text-dojo-muted mt-0.5 leading-relaxed">
            Asistencia, pagos, exámenes y más — incluso con {dojoName ?? "la app"} cerrada.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="btn-primary text-xs py-1.5 px-4 disabled:opacity-50"
            >
              {loading ? "Activando..." : "Activar notificaciones"}
            </button>
            <button onClick={dismiss} className="btn-ghost text-xs py-1.5 px-3">
              Ahora no
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="p-1 text-dojo-muted hover:text-dojo-white shrink-0">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Botón inline para el perfil del portal ─────────────────────────────────
export function PushToggleButton() {
  const { state, subscribe, unsubscribe } = usePushSubscription();
  const [loading, setLoading] = useState(false);

  if (state === "loading" || state === "unsupported") return null;

  const isSubscribed = state === "subscribed";

  async function toggle() {
    setLoading(true);
    if (isSubscribed) await unsubscribe();
    else await subscribe();
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading || state === "denied"}
      className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
        isSubscribed
          ? "border-green-700/50 bg-green-900/20 text-green-400 hover:bg-red-900/20 hover:text-red-400 hover:border-red-700/50"
          : "border-dojo-border text-dojo-muted hover:border-dojo-gold/50 hover:text-dojo-gold"
      }`}
      title={state === "denied" ? "Permisos bloqueados en el navegador" : undefined}
    >
      {isSubscribed
        ? <><BellOff size={14} /> {loading ? "..." : "Desactivar alertas"}</>
        : <><Bell    size={14} /> {loading ? "..." : "Activar alertas push"}</>
      }
    </button>
  );
}
