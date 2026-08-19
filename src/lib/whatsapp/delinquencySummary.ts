/**
 * Resumen de morosidad al ADMIN del dojo (no a los padres — ese es un canal
 * aparte, ver aviso_atraso_dojomaster en sendTemplate.ts). Se dispara desde
 * el cron payment-late-status, mismo día que ese cron le manda a los padres
 * el aviso de atraso automático, y solo si ese envío realmente ocurrió
 * (dojo.autoRemindersEnabled=true) — la nota fija del template afirma que ya
 * se avisó a los padres, así que no debe mandarse si eso no pasó de verdad.
 *
 * Es dojo-level, no student-level — por eso usa callMetaGraphApi() directo
 * (igual que el CRM de activación en lifecycleTemplates.ts) en vez de
 * sendWhatsAppTemplate(), que exige un studentId y valida opt-in de alumno.
 * Acá el gate es Dojo.whatsappOptIn + Dojo.phone, igual que el CRM.
 */
import prisma from "@/lib/prisma";
import { callMetaGraphApi, normalizePhoneE164 } from "@/lib/whatsapp/sendTemplate";

// Nombre/idioma reales pendientes de confirmar cuando Meta apruebe el
// template — mismo criterio que LIFECYCLE_TEMPLATE_CFG (lifecycleTemplates.ts):
// centralizado acá para no desincronizar test-send y el envío real.
export const DELINQUENCY_SUMMARY_TEMPLATE = {
  name: "resumen_morosidad_dojomaster",
  language: "es_PA",
};

export interface DelinquencySummaryStats {
  lateStudents:       number;
  lateAmount:         number;
  collectedThisMonth: number;
}

/**
 * Snapshot ACTUAL de mora del dojo (no solo el lote recién marcado "late" hoy)
 * + recaudado del mes en curso (pagos "paid" con dueDate en el mes actual).
 */
export async function computeDelinquencySummary(dojoId: string): Promise<DelinquencySummaryStats> {
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd    = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [lateByStudent, collectedAgg] = await Promise.all([
    prisma.payment.groupBy({
      by:    ["studentId"],
      where: { student: { dojoId }, status: "late" },
      _sum:  { amount: true },
    }),
    prisma.payment.aggregate({
      where: { student: { dojoId }, status: "paid", dueDate: { gte: monthStart, lt: monthEnd } },
      _sum:  { amount: true },
    }),
  ]);

  return {
    lateStudents:       lateByStudent.length,
    lateAmount:          lateByStudent.reduce((sum, row) => sum + (row._sum.amount ?? 0), 0),
    collectedThisMonth: collectedAgg._sum.amount ?? 0,
  };
}

// El body aprobado por Meta ("Total en mora: {{3}}", sin "$" literal en el
// texto — confirmado vía GET .../message_templates) no trae el símbolo de
// moneda, así que va incluido en el valor de cada variable.
export function buildDelinquencySummaryVars(
  dojoName: string,
  stats: DelinquencySummaryStats,
): { bodyParams: string[] } {
  return {
    bodyParams: [
      dojoName,
      String(stats.lateStudents),
      `$${stats.lateAmount.toFixed(2)}`,
      `$${stats.collectedThisMonth.toFixed(2)}`,
    ],
  };
}

export type DelinquencySummarySkipReason = "OPT_OUT" | "NO_PHONE" | "SEND_FAILED";
export type DelinquencySummaryResult =
  | { sent: true }
  | { sent: false; reason: DelinquencySummarySkipReason };

/**
 * Envía el resumen y deja registro en WhatsAppNotification (dojoId, sin
 * studentId/paymentId — es un mensaje del dojo, no de un alumno/pago
 * puntual). Nunca lanza — cualquier fallo se traduce a un `reason`.
 */
export async function sendDojoDelinquencySummary(
  dojo:  { id: string; name: string; phone: string | null; whatsappOptIn: boolean },
  stats: DelinquencySummaryStats,
): Promise<DelinquencySummaryResult> {
  if (!dojo.whatsappOptIn) return { sent: false, reason: "OPT_OUT" };

  const phone = normalizePhoneE164(dojo.phone);
  if (!phone) return { sent: false, reason: "NO_PHONE" };

  const { bodyParams } = buildDelinquencySummaryVars(dojo.name, stats);

  let result;
  try {
    result = await callMetaGraphApi(phone, {
      templateName: DELINQUENCY_SUMMARY_TEMPLATE.name,
      language:     DELINQUENCY_SUMMARY_TEMPLATE.language,
      bodyParams,
    });
  } catch (err) {
    console.error("Error enviando resumen de morosidad por WhatsApp:", err);
    result = { ok: false as const, retryable: false, errorMessage: "Excepción al llamar a Meta" };
  }

  await prisma.whatsAppNotification.create({
    data: {
      dojoId:         dojo.id,
      recipientPhone: phone,
      type:           "DOJO_DELINQUENCY_SUMMARY",
      templateName:   DELINQUENCY_SUMMARY_TEMPLATE.name,
      templateVars:   { header: [], body: bodyParams },
      status:         result.ok ? "SENT" : "FAILED",
      metaMessageId:  result.ok ? (result.metaMessageId ?? null) : null,
      errorDetail:    result.ok ? null : (result.errorMessage ?? "Error desconocido"),
      sendCount:      result.ok ? 1 : 0,
    },
  });

  if (result.ok) return { sent: true };
  return { sent: false, reason: "SEND_FAILED" };
}
