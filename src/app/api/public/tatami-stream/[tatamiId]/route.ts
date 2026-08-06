/**
 * GET /api/public/tatami-stream/[tatamiId]?tournamentId=X
 *
 * Relay SSE (Server-Sent Events) hacia Ably — el navegador nunca habla
 * directo con Ably (su SDK de cliente no es compatible con el bundler de
 * Next.js en este proyecto, ver src/lib/ably-server.ts). Este servidor
 * mantiene la conexión real a Ably (Node SDK, sin problema) y reenvía un
 * ping nativo por EventSource cada vez que algo cambia en el tatami.
 *
 * Si ABLY_API_KEY no está configurada, responde 404 de inmediato — el
 * cliente debe consultar antes /api/public/realtime-status y ni siquiera
 * intentar conectarse.
 *
 * Las funciones serverless de Vercel tienen un tiempo máximo de ejecución;
 * el stream se cierra proactivamente antes de ese límite para forzar una
 * reconexión limpia (EventSource reconecta solo, con un breve parpadeo).
 */
import { NextRequest } from "next/server";
import Ably from "ably";
import prisma from "@/lib/prisma";
import { tatamiChannelName, isAblyEnabled } from "@/lib/ably-server";

export const dynamic  = "force-dynamic";
export const runtime  = "nodejs";
export const maxDuration = 60;

const PROACTIVE_CLOSE_MS = 50_000; // por debajo del límite típico de Vercel (60s)
const HEARTBEAT_MS       = 20_000; // evita que proxies intermedios corten por inactividad

type Params = { params: Promise<{ tatamiId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!isAblyEnabled()) {
    return new Response("Ably no configurado", { status: 404 });
  }

  const { tatamiId } = await params;
  const tournamentId = new URL(req.url).searchParams.get("tournamentId");
  if (!tournamentId) {
    return new Response("tournamentId requerido", { status: 400 });
  }

  const tatami = await prisma.tournamentTatami.findFirst({
    where:  { id: tatamiId, tournamentId },
    select: { id: true },
  });
  if (!tatami) return new Response("Tatami no encontrado", { status: 404 });

  const channelName = tatamiChannelName(tournamentId, tatamiId);
  const encoder = new TextEncoder();

  let ably: Ably.Realtime | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const cleanup = () => {
        if (heartbeat)  clearInterval(heartbeat);
        if (closeTimer) clearTimeout(closeTimer);
        try { ably?.close(); } catch { /* noop */ }
        try { controller.close(); } catch { /* ya cerrado */ }
      };

      try {
        ably = new Ably.Realtime({ key: process.env.ABLY_API_KEY });
        const channel = ably.channels.get(channelName);
        channel.subscribe("update", () => {
          try { controller.enqueue(encoder.encode(`event: update\ndata: 1\n\n`)); }
          catch { /* stream ya cerrado */ }
        });
      } catch (err) {
        console.error("[tatami-stream] Ably connect error:", err);
        cleanup();
        return;
      }

      heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(`: heartbeat\n\n`)); }
        catch { cleanup(); }
      }, HEARTBEAT_MS);

      closeTimer = setTimeout(cleanup, PROACTIVE_CLOSE_MS);
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
