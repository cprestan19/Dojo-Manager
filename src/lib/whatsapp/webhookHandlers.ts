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

export async function handleStatusUpdate(params: {
  metaMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipientPhone: string;
  errorDetail?: string;
  timestamp: string;
}) {
  const newStatus = params.status.toUpperCase() as "SENT" | "DELIVERED" | "READ" | "FAILED";

  const existing = await prisma.whatsAppNotification.findUnique({
    where: { metaMessageId: params.metaMessageId },
    select: { id: true, status: true },
  });

  if (!existing) {
    // metaMessageId desconocido — no pertenece a ningún envío nuestro registrado.
    // No es un error fatal (puede ser un mensaje enviado por otro canal de prueba),
    // pero es señal de auditoría útil.
    console.warn("[whatsapp-webhook] status update para metaMessageId desconocido", params.metaMessageId);
    return;
  }

  if (newStatus !== "FAILED" && STATUS_RANK[newStatus] <= (STATUS_RANK[existing.status] ?? 0)) {
    return; // evento fuera de orden — no regresar el estado
  }

  await prisma.whatsAppNotification.update({
    where: { id: existing.id },
    data: { status: newStatus, errorDetail: params.errorDetail ?? null },
  });
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
      dojoId: singleMatch?.dojoId ?? null,
    },
    update: {},
  });
}
