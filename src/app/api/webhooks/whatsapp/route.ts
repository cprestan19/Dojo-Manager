// app/api/webhooks/whatsapp/route.ts
//
// Endpoint de webhook de WhatsApp Cloud API para DojoMaster Online.
// Maneja dos casos:
//  - GET  -> verificación inicial que hace Meta al configurar el webhook
//  - POST -> eventos reales: mensajes entrantes y actualizaciones de estado
//            (sent, delivered, read, failed) de los mensajes que enviamos.
//
// Variables de entorno requeridas:
//   WHATSAPP_WEBHOOK_VERIFY_TOKEN  -> el mismo string que pones en el
//                                     formulario de Meta como "Token de verificación"
//   WHATSAPP_APP_SECRET            -> App Secret de la app de Meta (Configuración básica),
//                                     usado para validar la firma X-Hub-Signature-256 de cada POST

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { handleStatusUpdate, handleIncomingMessage } from "@/lib/whatsapp/webhookHandlers";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";

// Firma HMAC-SHA256 que Meta manda en el header X-Hub-Signature-256 (formato
// "sha256=<hex>"), calculada sobre el body crudo con el App Secret como key.
// Se compara en tiempo constante para no filtrar el hash por timing attack.
function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    console.error("[whatsapp-webhook] WHATSAPP_APP_SECRET no configurado — rechazando petición");
    return false;
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const receivedHex = signatureHeader.slice("sha256=".length);
  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(receivedHex, "hex"), Buffer.from(expectedHex, "hex"));
  } catch {
    // Buffer.from con hex inválido o de largo distinto — timingSafeEqual tira si
    // los tamaños no calzan, lo tratamos como firma inválida.
    return false;
  }
}

// ---------------------------------------------------------------------------
// GET: verificación del webhook (Meta lo llama UNA vez al guardar la config)
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    // Meta espera el challenge devuelto tal cual, como texto plano.
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[whatsapp-webhook] Verificación fallida", { mode, tokenRecibido: token });
  return new NextResponse("Forbidden", { status: 403 });
}

// ---------------------------------------------------------------------------
// POST: eventos reales (mensajes entrantes y estados de entrega)
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // La firma se calcula sobre el string EXACTO que mandó Meta — hay que leer
  // el body como texto crudo antes de parsearlo, nunca sobre el objeto ya parseado.
  const rawBody = await req.text();

  if (!verifyWhatsAppSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    console.warn("[whatsapp-webhook] Firma inválida — petición rechazada");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    // Registro durable (no solo consola) — señal temprana de intento de ataque
    // al endpoint, consultable después vía audit log.
    await logAudit({
      action: "WHATSAPP_WEBHOOK_SIGNATURE_INVALID", module: AUDIT_MODULE.WHATSAPP,
      resourceType: "Webhook", ip, statusCode: 401,
    });
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: WhatsAppWebhookPayload;

  try {
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  try {
    if (body.object !== "whatsapp_business_account") {
      // No es un evento de WhatsApp, ignoramos pero respondemos 200
      // para que Meta no reintente innecesariamente.
      return NextResponse.json({ received: true });
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;

        // --- Actualizaciones de estado (sent / delivered / read / failed) ---
        if (value.statuses) {
          for (const status of value.statuses) {
            await handleStatusUpdate({
              metaMessageId: status.id,
              status: status.status, // "sent" | "delivered" | "read" | "failed"
              recipientPhone: status.recipient_id,
              errorDetail: status.errors?.[0]?.title,
              timestamp: status.timestamp,
            });
          }
        }

        // --- Mensajes entrantes ---
        // DojoMaster no responde por este canal, pero igual conviene
        // registrar que llegó algo, para poder redirigir al padre
        // manualmente si hace falta (ej: dashboard interno de "mensajes sin atender").
        if (value.messages) {
          for (const message of value.messages) {
            await handleIncomingMessage({
              fromPhone: message.from,
              messageId: message.id,
              type: message.type,
              text: message.text?.body,
              timestamp: message.timestamp,
            });
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[whatsapp-webhook] Error procesando payload", err);
    // Respondemos 200 igual: si devolvemos error, Meta reintenta el mismo
    // payload varias veces y puede duplicar el procesamiento.
    return NextResponse.json({ received: true });
  }
}

// ---------------------------------------------------------------------------
// Tipos mínimos del payload de Meta (recortados a lo que usamos)
// ---------------------------------------------------------------------------

interface WhatsAppWebhookPayload {
  object: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      value: {
        messaging_product: string;
        statuses?: Array<{
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id: string;
          errors?: Array<{ title: string }>;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }>;
      };
      field: string;
    }>;
  }>;
}
