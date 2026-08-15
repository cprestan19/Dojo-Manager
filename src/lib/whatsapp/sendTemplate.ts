/**
 * Módulo: Envío de notificaciones por WhatsApp (Meta Cloud API)
 *
 * Convención de credenciales igual a src/lib/cloudinary.ts: se leen de
 * process.env sin throw eager — si faltan, la llamada a Meta falla en
 * tiempo de ejecución con un error claro, no en el import del módulo.
 */
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";
import type { WhatsAppNotificationType } from "@prisma/client";
import { hasFeature } from "@/lib/billing/featureGate";
import { NAV_KEYS } from "@/lib/permissions";

const GRAPH_API_VERSION = "v21.0";

function graphUrl(): string {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
}

/**
 * Devuelve el payToken de un pago, generándolo si todavía no existe —
 * usado por el botón "Pagar ahora" del aviso de atraso (/pagar/[token]).
 * Mismo patrón de entropía que RegistrationLink.token.
 */
export async function ensurePayToken(paymentId: string, existingToken: string | null): Promise<string> {
  if (existingToken) return existingToken;
  const token = randomUUID();
  await prisma.payment.update({ where: { id: paymentId }, data: { payToken: token } });
  return token;
}

/**
 * Normaliza un teléfono a E.164. Sin código de país explícito, se asume
 * el formato local de los mercados activos hoy: Panamá (8 dígitos) o
 * Venezuela (11 dígitos, formato local "04XX-XXXXXXX" — el 0 inicial se
 * descarta y se antepone +58). Devuelve null si el formato no es
 * reconocible (falla controlada, no se envía) — nunca lanza excepción.
 */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 8) return `+507${digits}`;           // Panamá local sin código de país
  if (digits.length === 11 && digits.startsWith("507")) return `+${digits}`; // Panamá ya con 507
  if (digits.length === 11 && digits.startsWith("0")) return `+58${digits.slice(1)}`; // Venezuela local "04XX-XXXXXXX"
  return null;
}

interface GuardianContactStudent {
  primaryGuardian: string | null;
  motherName:  string | null;
  motherPhone: string | null;
  fatherName:  string | null;
  fatherPhone: string | null;
}

/**
 * Resuelve nombre + teléfono del acudiente principal (titular) como un par —
 * un solo destinatario, nunca los dos. Requiere que primaryGuardian esté
 * marcado EXPLÍCITAMENTE en el perfil del alumno y que ese acudiente tenga
 * teléfono cargado; si no, no se envía a nadie — nunca se adivina a cuál de
 * los dos escribirle. Usado tanto por sendWhatsAppTemplate (aislado) como
 * por los callers para armar el saludo del template.
 */
export function resolveGuardianContact(student: GuardianContactStudent): { name: string | null; phone: string | null } {
  if (student.primaryGuardian === "father" && student.fatherPhone) {
    return { name: student.fatherName, phone: student.fatherPhone };
  }
  if (student.primaryGuardian === "mother" && student.motherPhone) {
    return { name: student.motherName, phone: student.motherPhone };
  }
  return { name: null, phone: null };
}

export interface SendWhatsAppTemplateParams {
  dojoId:         string;
  studentId:      string;
  paymentId?:     string | null;
  type:           WhatsAppNotificationType;
  templateName:   string;
  /** Valores en orden {{1}}, {{2}}, ... del HEADER del template, si tiene uno de tipo texto. */
  headerParams?:  string[];
  /** HEADER de tipo documento (PDF) — mutuamente excluyente con headerParams. */
  headerDocument?: { link: string; filename: string; publicId?: string };
  /** Valores en orden {{1}}, {{2}}, ... del BODY del template — ya formateados como texto. */
  bodyParams:     string[];
}

export interface SendWhatsAppTemplateResult {
  sent:    boolean;
  skipped: boolean;
  reason?: string;
}

interface MetaSendResponse {
  messages?: Array<{ id: string }>;
  error?: { message?: string; code?: number };
}

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/** Subconjunto de SendWhatsAppTemplateParams que necesita la llamada cruda a Meta — sin dojoId/studentId/type, para poder reusarse fuera del flujo de notificaciones ligadas a un alumno (ver src/lib/whatsapp/sendLifecycleTemplate.ts). */
export interface MetaTemplateCallParams {
  templateName:    string;
  /** Código de idioma EXACTO con el que Meta aprobó ese template (confirmado vía GET .../message_templates — no todos quedan en es_PA, ej. ayuda_primer_alumno quedó en es_ES). Default "es_PA" por compatibilidad con los templates de pagos, ya todos en ese idioma. */
  language?:       string;
  headerParams?:   string[];
  headerDocument?: { link: string; filename: string };
  bodyParams:      string[];
}

interface MetaSendResult {
  ok: boolean;
  retryable: boolean;
  metaMessageId?: string;
  errorMessage?: string;
}

/**
 * POST crudo a Meta — compartido por el envío de templates y el envío libre
 * (texto/interactivo del chatbot de soporte, ver sendFreeformText/
 * sendInteractiveList más abajo). El `body` ya viene armado por el caller
 * (distinto shape según type: "template" | "text" | "interactive").
 */
async function postWhatsAppMessage(body: Record<string, unknown>): Promise<MetaSendResult> {
  let res: Response;
  try {
    res = await fetch(graphUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Error de red — transitorio, se puede reintentar.
    return { ok: false, retryable: true, errorMessage: err instanceof Error ? err.message : "Error de red" };
  }

  const json = (await res.json().catch(() => ({}))) as MetaSendResponse;

  if (res.ok && json.messages?.[0]?.id) {
    return { ok: true, retryable: false, metaMessageId: json.messages[0].id };
  }

  // 5xx / 429 = transitorio, reintentable. 4xx (número inválido, template
  // rechazado, opt-out, fuera de ventana de 24h) = permanente, no se reintenta.
  const retryable = res.status >= 500 || res.status === 429;
  return { ok: false, retryable, errorMessage: json.error?.message ?? `HTTP ${res.status}` };
}

export async function callMetaGraphApi(phone: string, params: MetaTemplateCallParams): Promise<MetaSendResult> {
  const components: Record<string, unknown>[] = [];
  if (params.headerDocument) {
    components.push({
      type: "header",
      parameters: [{
        type: "document",
        document: { link: params.headerDocument.link, filename: params.headerDocument.filename },
      }],
    });
  } else if (params.headerParams?.length) {
    components.push({
      type: "header",
      parameters: params.headerParams.map(text => ({ type: "text", text })),
    });
  }
  // Si el body del template no tiene variables, Meta no espera el
  // componente — mandarlo con parameters:[] en templates sin {{n}} (ej.
  // bienvenida_dojomaster, que solo tiene variable en el header) puede
  // ser rechazado por Meta.
  if (params.bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: params.bodyParams.map(text => ({ type: "text", text })),
    });
  }

  return postWhatsAppMessage({
    messaging_product: "whatsapp",
    to: phone.replace("+", ""),
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.language ?? "es_PA" },
      components,
    },
  });
}

/**
 * Mensaje de texto LIBRE (no template) — solo funciona dentro de la ventana
 * de 24h desde el último mensaje que ESE número le mandó al negocio (regla
 * de Meta). Usado por el chatbot de soporte para responder dentro de esa
 * ventana, sin necesitar un template aprobado para cada respuesta.
 */
export async function sendFreeformText(phone: string, text: string): Promise<MetaSendResult> {
  return postWhatsAppMessage({
    messaging_product: "whatsapp",
    to: phone.replace("+", ""),
    type: "text",
    text: { body: text },
  });
}

export interface InteractiveListRow { id: string; title: string; description?: string }

/**
 * Menú tipo lista (hasta 10 opciones) — igual que sendFreeformText, requiere
 * estar dentro de la ventana de 24h. Meta limita el título de cada fila a
 * 24 caracteres y la descripción a 72 — recortar antes de llamar si hace falta.
 */
export async function sendInteractiveList(
  phone: string, bodyText: string, buttonLabel: string, rows: InteractiveListRow[],
): Promise<MetaSendResult> {
  return postWhatsAppMessage({
    messaging_product: "whatsapp",
    to: phone.replace("+", ""),
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: bodyText },
      action: {
        button: buttonLabel,
        sections: [{ title: "Opciones", rows }],
      },
    },
  });
}

/**
 * Crea o actualiza la fila de WhatsAppNotification para este pago+tipo.
 * Con paymentId: upsert sobre la unique(paymentId, type) — un reintento
 * después de un FAILED actualiza la MISMA fila en vez de chocar contra el
 * constraint único al intentar un segundo create(). Sin paymentId (tipos
 * futuros sin pago asociado, ej. TOURNAMENT_QR): create simple, no hay
 * idempotencia posible sin una clave de referencia.
 */
async function upsertNotification(
  params: SendWhatsAppTemplateParams,
  data: { recipientPhone: string; status: "PENDING" | "FAILED"; errorDetail?: string },
) {
  const payload = {
    dojoId: params.dojoId,
    studentId: params.studentId,
    paymentId: params.paymentId ?? null,
    recipientPhone: data.recipientPhone,
    type: params.type,
    templateName: params.templateName,
    templateVars: {
      header: params.headerParams ?? [],
      headerDocument: params.headerDocument ?? null,
      body: params.bodyParams,
    },
    status: data.status,
    errorDetail: data.errorDetail ?? null,
    // Un reintento exitoso limpia el metaMessageId de un intento fallido previo.
    metaMessageId: null,
    receiptPublicId: params.headerDocument?.publicId ?? null,
  };

  if (params.paymentId) {
    return prisma.whatsAppNotification.upsert({
      where: { paymentId_type: { paymentId: params.paymentId, type: params.type } },
      create: payload,
      update: payload,
    });
  }
  return prisma.whatsAppNotification.create({ data: payload });
}

/**
 * Envía una notificación de WhatsApp por template, con idempotencia,
 * aislamiento multi-tenant y re-verificación de opt-in — todo validado
 * de nuevo contra la BD, sin confiar en lo que ya chequeó el caller.
 */
export async function sendWhatsAppTemplate(
  params: SendWhatsAppTemplateParams,
): Promise<SendWhatsAppTemplateResult> {
  // Gate por plan — igual que el resto de funciones feature-gated
  // (src/lib/billing/featureGate.ts). Planes legado (featureKeys=null) y
  // COMPLIMENTARY quedan sin restricción, igual que cualquier otra función.
  if (!(await hasFeature(params.dojoId, NAV_KEYS.WHATSAPP_NOTIFICATIONS))) {
    return { sent: false, skipped: true, reason: "PLAN_NOT_INCLUDED" };
  }

  // Idempotencia: si ya existe un envío exitoso para este pago+tipo, no reenviar.
  // Corre ANTES de llamar a Meta — a diferencia de un insert, la llamada a la
  // API no es idempotente en sí misma.
  if (params.paymentId) {
    const existing = await prisma.whatsAppNotification.findFirst({
      where: {
        paymentId: params.paymentId,
        type: params.type,
        status: { in: ["SENT", "DELIVERED", "READ"] },
      },
      select: { id: true },
    });
    if (existing) return { sent: false, skipped: true, reason: "ALREADY_SENT" };
  }

  const student = await prisma.student.findUnique({
    where: { id: params.studentId, dojoId: params.dojoId },
    select: {
      dojoId: true, whatsappOptIn: true, primaryGuardian: true,
      motherName: true, motherPhone: true, fatherName: true, fatherPhone: true,
    },
  });

  // No existe, o pertenece a otro dojo (aislamiento cruzado) — nunca se envía "por si acaso".
  if (!student || student.dojoId !== params.dojoId) {
    return { sent: false, skipped: true, reason: "STUDENT_DOJO_MISMATCH" };
  }
  if (!student.whatsappOptIn) {
    return { sent: false, skipped: true, reason: "NO_OPT_IN" };
  }

  const phone = normalizePhoneE164(resolveGuardianContact(student).phone);
  if (!phone) {
    await upsertNotification(params, {
      recipientPhone: "",
      status: "FAILED",
      errorDetail: "Teléfono de acudiente no disponible o con formato inválido",
    });
    return { sent: false, skipped: false, reason: "INVALID_PHONE" };
  }

  // Fila PENDING antes de llamar a Meta — trazabilidad aunque la llamada falle o cuelgue.
  const notification = await upsertNotification(params, { recipientPhone: phone, status: "PENDING" });

  const MAX_ATTEMPTS = 3; // intento original + 2 reintentos
  const BACKOFF_MS = [1000, 3000];

  let result = await callMetaGraphApi(phone, params);
  for (let attempt = 1; !result.ok && result.retryable && attempt < MAX_ATTEMPTS; attempt++) {
    await sleep(BACKOFF_MS[attempt - 1] ?? 3000);
    result = await callMetaGraphApi(phone, params);
  }

  if (result.ok) {
    await prisma.whatsAppNotification.update({
      where: { id: notification.id },
      data: { status: "SENT", metaMessageId: result.metaMessageId },
    });
    return { sent: true, skipped: false };
  }

  await prisma.whatsAppNotification.update({
    where: { id: notification.id },
    data: { status: "FAILED", errorDetail: result.errorMessage ?? "Error desconocido" },
  });
  return { sent: false, skipped: false, reason: result.errorMessage };
}

// ── Builders de variables por template ──────────────────────────────────────

interface DojoLateParams {
  name: string;
  lateInterestPct: number;
}

interface StudentNameParams {
  fullName: string;
}

/**
 * aviso_atraso_dojomaster — estructura real aprobada en Meta (confirmada vía
 * GET .../message_templates, no coincidía con la spec original del prompt):
 *   HEADER (texto): {{1}} — branding fijo, no personalizado por dojo.
 *   BODY: "Hola {{1}}, tu pago en {{2}} está pendiente. Monto: ${{3}}
 *          Días de atraso: {{4}} Cargo por mora aplicado: {{5}}
 *          ...contacta a tu dojo {{6}}. ..."
 *   Sin botones — el template aprobado no tiene ninguno, a pesar de que el
 *   prompt original describía un botón "Pagar ahora". /pagar/[token] queda
 *   como página standalone, sin enlazar desde este mensaje por ahora.
 */
export function buildOverdueVars(params: {
  guardianName?: string | null;
  dojo: DojoLateParams & { phone?: string | null };
  student: StudentNameParams;
  amount: number;
  daysLate: number;
}): { headerParams: string[]; bodyParams: string[] } {
  const total = params.amount + (params.amount * params.dojo.lateInterestPct) / 100;
  return {
    headerParams: ["Dojo Master Online"],
    bodyParams: [
      params.guardianName || "padre/tutor",
      params.dojo.name,
      total.toFixed(2),
      String(params.daysLate),
      `${params.dojo.lateInterestPct}%`,
      params.dojo.phone || "el dojo",
    ],
  };
}

/**
 * confirmacion_pago_dojomaster — estructura real aprobada en Meta:
 *   HEADER (documento/PDF): requiere un `link` a un PDF ya hospedado — se genera
 *   con renderPaymentReceiptPdf() y se sube a ImageKit vía
 *   generateAndUploadReceiptPdf() (ver src/lib/whatsapp/receiptPdf.ts). Sin este
 *   header, Meta rechaza el envío — por eso el caller solo llama a
 *   sendWhatsAppTemplate() si la subida del PDF fue exitosa.
 *   BODY: {{1}} nombre acudiente, {{2}} dojo, {{3}} monto recibido, {{4}} fecha.
 */
export function buildConfirmedVars(params: {
  guardianName?: string | null;
  dojo: { name: string };
  amount: number;
  paidDate: string;
}): { bodyParams: string[] } {
  return {
    bodyParams: [
      params.guardianName || "padre/tutor",
      params.dojo.name,
      params.amount.toFixed(2),
      params.paidDate,
    ],
  };
}
