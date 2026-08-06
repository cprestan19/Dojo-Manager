"use client";
import { useEffect, useState } from "react";

/**
 * Señal en tiempo real para un tatami — vía EventSource nativo del
 * navegador contra el relay SSE propio (src/app/api/public/tatami-stream),
 * que a su vez mantiene la conexión real a Ably del lado del servidor.
 *
 * No se usa el SDK de Ably en el navegador (su bundle no es compatible con
 * el build de este proyecto — ver src/lib/ably-server.ts). `signal`
 * incrementa cada vez que algo cambió; el componente que lo usa debe
 * volver a pedir /api/public/tatami-display (la fuente de verdad sigue
 * siendo REST).
 *
 * Si Ably no está configurado en el servidor, `/api/public/realtime-status`
 * responde `enabled:false` y este hook nunca abre el EventSource —
 * `connected` se queda en `false` y el componente sigue con su polling
 * normal, sin ningún cambio de comportamiento.
 */
export function useTatamiRealtime(tournamentId: string | null, tatamiId: string | null) {
  const [connected, setConnected] = useState(false);
  const [signal, setSignal] = useState(0);

  useEffect(() => {
    if (!tournamentId || !tatamiId) return;
    let cancelled = false;
    let es: EventSource | null = null;

    async function connect() {
      const status = await fetch("/api/public/realtime-status").then(r => r.ok ? r.json() : null).catch(() => null);
      if (cancelled || !status?.enabled) return;

      es = new EventSource(`/api/public/tatami-stream/${tatamiId}?tournamentId=${tournamentId}`);
      es.addEventListener("open", () => { if (!cancelled) setConnected(true); });
      es.addEventListener("error", () => { if (!cancelled) setConnected(false); }); // EventSource reintenta solo
      es.addEventListener("update", () => { if (!cancelled) setSignal(s => s + 1); });
    }

    connect();
    return () => {
      cancelled = true;
      es?.close();
      setConnected(false);
    };
  }, [tournamentId, tatamiId]);

  return { connected, signal };
}
