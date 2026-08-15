/**
 * Handlers del webhook de WhatsApp — separados de app/api/webhooks/whatsapp/route.ts
 * (Next.js App Router solo permite exports reconocidos en un route.ts) para
 * poder testearlos de forma aislada.
 */
import prisma from "@/lib/prisma";
import { normalizePhoneE164, sendFreeformText, sendInteractiveList } from "@/lib/whatsapp/sendTemplate";
import {
  triggersMenu, triggersSupportEscalation, isAlreadyOk, findTopic,
  SUPPORT_MENU_ROWS, SUPPORT_MENU_BODY, SUPPORT_MENU_BUTTON, SUPPORT_ROW_ID, SUPPORT_PHONE,
} from "@/lib/whatsapp/supportBot";

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

export interface IncomingInteractive { kind: "button_reply" | "list_reply"; id: string; title: string }

export async function handleIncomingMessage(params: {
  fromPhone: string;
  messageId: string;
  type: string;
  text?: string;
  interactive?: IncomingInteractive;
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
  let dojoOwnerName: string | null = null;
  if (!singleMatch) {
    const dojoMatches = await prisma.dojo.findMany({
      where: { phone: normalizedPhone },
      select: { id: true, name: true },
    });
    if (dojoMatches.length === 1) {
      dojoOwnerMatchId = dojoMatches[0]!.id;
      dojoOwnerName    = dojoMatches[0]!.name;
    }
  }

  // Baja automática: si el dueño del dojo responde una frase de opt-out,
  // se apaga whatsappOptIn — el cron de detección (computeCandidates) ya
  // filtra por este campo, así que deja de proponérsele cualquier disparador
  // sin que soporte tenga que hacerlo manual.
  const isOptOut = isOptOutText(params.text);
  if (dojoOwnerMatchId && isOptOut) {
    await prisma.dojo.update({
      where: { id: dojoOwnerMatchId },
      data: { whatsappOptIn: false, whatsappOptOutDate: new Date() },
    });
  }

  // Chatbot de soporte — solo si sabemos a qué dojo pertenece, el interruptor
  // está prendido (CrmSettings.supportBotEnabled, apagado por default), y
  // NO fue una baja — alguien que acaba de pedir "detener" no debe recibir
  // el catch-all del bot de vuelta.
  if (dojoOwnerMatchId && dojoOwnerName && !isOptOut) {
    await runSupportBot({
      dojoName: dojoOwnerName,
      dojoPhone: normalizedPhone,
      text: params.text,
      interactive: params.interactive,
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

/**
 * Bot de soporte basado en reglas (no IA) — reacciona al botón "Sí, ayúdame"
 * del template ayuda_primer_alumno, a palabras clave libres, o a la
 * selección de una fila del menú que el propio bot mandó antes.
 */
async function runSupportBot(ctx: {
  dojoName: string; dojoPhone: string; text?: string; interactive?: IncomingInteractive;
}) {
  const settings = await prisma.crmSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.supportBotEnabled) return;

  // 1) Ya está viendo el menú y eligió una fila.
  if (ctx.interactive?.kind === "list_reply") {
    if (ctx.interactive.id === SUPPORT_ROW_ID) {
      await escalateToSupport(ctx);
      return;
    }
    const topic = findTopic(ctx.interactive.id);
    if (topic) {
      await sendFreeformText(
        ctx.dojoPhone,
        `${topic.body}\n\n¿Necesitás otra cosa? Escribí "menú" para ver las opciones, o "soporte" para que te contacte una persona directo.`,
      );
    }
    return;
  }

  // 2) Pidió soporte humano directo, en texto libre (sin pasar por el menú).
  if (triggersSupportEscalation(ctx.text)) {
    await escalateToSupport(ctx);
    return;
  }

  // 3) Disparador del menú: botón "Sí, ayúdame" del template, o texto libre
  //    tipo "ayuda"/"menú".
  if (triggersMenu(ctx.text)) {
    await sendInteractiveList(ctx.dojoPhone, SUPPORT_MENU_BODY, SUPPORT_MENU_BUTTON, SUPPORT_MENU_ROWS);
    return;
  }

  // 4) "Ya lo tengo controlado" (el otro botón del template) — respuesta
  //    válida, no es que no se entendió el mensaje.
  if (isAlreadyOk(ctx.text)) {
    await sendFreeformText(ctx.dojoPhone, "¡Genial! 👍 Cualquier cosa, escribí \"ayuda\" y te muestro las opciones.");
    return;
  }

  // 5) Catch-all: no coincide con nada reconocido — nunca se queda en
  //    silencio total, aunque no pueda resolver el pedido puntual.
  await sendFreeformText(
    ctx.dojoPhone,
    "No entendí bien tu mensaje 🙏 Escribí \"ayuda\" para ver el menú de opciones, o \"soporte\" para que te contacte una persona directo.",
  );
}

async function escalateToSupport(ctx: { dojoName: string; dojoPhone: string; text?: string }) {
  await sendFreeformText(ctx.dojoPhone, "Ya le avisé a soporte que necesitás ayuda — te escriben pronto 🙌");
  await sendFreeformText(
    SUPPORT_PHONE,
    `🆘 ${ctx.dojoName} (${ctx.dojoPhone}) pidió soporte real por WhatsApp.\nÚltimo mensaje: "${ctx.text ?? "(sin texto)"}"`,
  );
}
