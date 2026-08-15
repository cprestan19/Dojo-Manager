/**
 * Handlers del webhook de WhatsApp — separados de app/api/webhooks/whatsapp/route.ts
 * (Next.js App Router solo permite exports reconocidos en un route.ts) para
 * poder testearlos de forma aislada.
 */
import prisma from "@/lib/prisma";
import { normalizePhoneE164 } from "@/lib/whatsapp/sendTemplate";

// Orden de progreso del ciclo de vida de un mensaje — un status tardío que
// llegue fuera de orden (ej. "sent" después de que ya se marcó "read") no
// debe regresar el estado. FAILED es la única excepción: siempre se aplica.
const STATUS_RANK: Record<string, number> = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3 };

// Frases de baja reconocidas para el opt-out automático del dueño de dojo
// (CRM de activación). Comparación por IGUALDAD del mensaje completo
// (normalizado, sin acentos/puntuación) — nunca "contains", para no disparar
// falsos positivos con frases como "no puedo cancelar mi pago hoy".
const OPT_OUT_PHRASES = new Set([
  "detener", "stop", "baja", "cancelar", "parar", "unsubscribe",
  "no mas mensajes", "ya no quiero mensajes", "no quiero mas mensajes",
]);

const DIACRITICS_RE = /[̀-ͯ]/g;

function normalizeForOptOut(text: string): string {
  return text
    .normalize("NFD").replace(DIACRITICS_RE, "") // quita acentos
    .toLowerCase()
    .replace(/[¡!¿?.,]/g, "")
    .trim();
}

function isOptOutText(text: string | undefined): boolean {
  if (!text) return false;
  return OPT_OUT_PHRASES.has(normalizeForOptOut(text));
}

export async function handleStatusUpdate(params: {
  metaMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipientPhone: string;
  errorDetail?: string;
  timestamp: string;
}) {
  const newStatus = params.status.toUpperCase() as "SENT" | "DELIVERED" | "READ" | "FAILED";

  // Un metaMessageId pertenece a UNA sola fuente — o es un WhatsAppNotification
  // (recordatorio/recibo a un alumno) o un DojoLifecycleMessage (CRM de
  // activación a un dojo), nunca ambos. Se busca en la primera y, si no
  // aparece, en la segunda.
  const existing = await prisma.whatsAppNotification.findUnique({
    where: { metaMessageId: params.metaMessageId },
    select: { id: true, status: true },
  });

  if (existing) {
    if (newStatus === "FAILED" || STATUS_RANK[newStatus] > (STATUS_RANK[existing.status] ?? 0)) {
      await prisma.whatsAppNotification.update({
        where: { id: existing.id },
        data: { status: newStatus, errorDetail: params.errorDetail ?? null },
      });
    }
    return;
  }

  const lifecycleMsg = await prisma.dojoLifecycleMessage.findUnique({
    where: { metaMessageId: params.metaMessageId },
    select: { id: true, status: true },
  });

  if (lifecycleMsg) {
    if (newStatus === "FAILED" || STATUS_RANK[newStatus] > (STATUS_RANK[lifecycleMsg.status] ?? 0)) {
      await prisma.dojoLifecycleMessage.update({
        where: { id: lifecycleMsg.id },
        data: { status: newStatus, errorDetail: params.errorDetail ?? null },
      });
    }
    return;
  }

  // metaMessageId desconocido en ambas tablas — no pertenece a ningún envío
  // nuestro registrado. No es un error fatal (puede ser un mensaje enviado
  // por otro canal de prueba), pero es señal de auditoría útil.
  console.warn("[whatsapp-webhook] status update para metaMessageId desconocido", params.metaMessageId);
}

export async function handleIncomingMessage(params: {
  fromPhone: string;
  messageId: string;
  type: string;
  text?: string;
  timestamp: string;
}) {
  const normalizedPhone = normalizePhoneE164(params.fromPhone) ?? params.fromPhone;

  // Match best-effort por teléfono — solo si hay EXACTAMENTE un alumno con
  // ese teléfono (entre mother/fatherPhone) se asocia. Si hay 0 o varios
  // (colisión posible entre dojos distintos), se deja sin asociar: nunca se
  // adivina a qué dojo pertenece un mensaje entrante ambiguo.
  const matches = await prisma.student.findMany({
    where: { OR: [{ motherPhone: normalizedPhone }, { fatherPhone: normalizedPhone }] },
    select: { id: true, dojoId: true },
  });
  const uniqueDojoIds = new Set(matches.map(m => m.dojoId));
  const singleMatch = matches.length > 0 && uniqueDojoIds.size === 1 ? matches[0] : null;

  // Sin match de alumno: puede ser el DUEÑO del dojo respondiendo a un mensaje
  // del CRM de activación (Dojo.phone), no un acudiente. Mismo criterio de
  // "solo si es inequívoco" — si el teléfono coincide con más de un dojo, se
  // deja sin asociar.
  let dojoOwnerMatchId: string | null = null;
  if (!singleMatch) {
    const dojoMatches = await prisma.dojo.findMany({
      where: { phone: normalizedPhone },
      select: { id: true },
    });
    dojoOwnerMatchId = dojoMatches.length === 1 ? dojoMatches[0]!.id : null;
  }

  // Baja automática: si el dueño del dojo responde una frase de opt-out,
  // se apaga whatsappOptIn — el cron de detección (computeCandidates) ya
  // filtra por este campo, así que deja de proponérsele cualquier disparador
  // sin que Cristhian tenga que hacerlo manual.
  if (dojoOwnerMatchId && isOptOutText(params.text)) {
    await prisma.dojo.update({
      where: { id: dojoOwnerMatchId },
      data: { whatsappOptIn: false, whatsappOptOutDate: new Date() },
    });
  }

  // upsert por metaMessageId — Meta puede reintentar la entrega del webhook
  // con el mismo evento, esto evita duplicar la fila.
  await prisma.whatsAppInboundMessage.upsert({
    where: { metaMessageId: params.messageId },
    create: {
      fromPhone: normalizedPhone,
      metaMessageId: params.messageId,
      type: params.type,
      text: params.text ?? null,
      receivedAt: new Date(Number(params.timestamp) * 1000),
      studentId: singleMatch?.id ?? null,
      dojoId: singleMatch?.dojoId ?? dojoOwnerMatchId,
    },
    update: {},
  });
}
