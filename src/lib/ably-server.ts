/**
 * Publicación en tiempo real (Ably) para el marcador de torneos.
 *
 * Diseño: REST/Postgres sigue siendo la única fuente de verdad. Esto es
 * solo una "campanita" — cuando algo cambia en un combate, se publica un
 * evento mínimo (sin payload real) al canal del tatami; los clientes que
 * lo reciben simplemente vuelven a pedir /api/public/tatami-display, igual
 * que ya hacían por polling. Si ABLY_API_KEY no está configurada, todas
 * las funciones son no-op — el sistema sigue funcionando exactamente igual
 * que antes (polling normal), sin romper nada.
 */
import Ably from "ably";

let client: Ably.Rest | null | undefined;

function getClient(): Ably.Rest | null {
  if (client !== undefined) return client;
  const key = process.env.ABLY_API_KEY;
  client = key ? new Ably.Rest({ key }) : null;
  return client;
}

export function tatamiChannelName(tournamentId: string, tatamiId: string): string {
  return `tournament-${tournamentId}-tatami-${tatamiId}`;
}

/**
 * Notifica que algo cambió en el combate activo de un tatami (marcador,
 * timer, estado de display, hantei). Fire-and-forget: nunca debe hacer
 * fallar la petición que la dispara — solo loguea si algo sale mal.
 */
export async function publishTatamiUpdate(tournamentId: string, tatamiId: string, event: string): Promise<void> {
  const c = getClient();
  if (!c) return; // Ably no configurado — el polling normal sigue cubriendo esto
  try {
    await c.channels.get(tatamiChannelName(tournamentId, tatamiId)).publish("update", { event, at: Date.now() });
  } catch (err) {
    console.error("[ably] publish error:", err);
  }
}

export function isAblyEnabled(): boolean {
  return !!process.env.ABLY_API_KEY;
}
