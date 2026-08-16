import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { sendWhatsAppTemplate, buildConfirmedVars, resolveGuardianContact } from "@/lib/whatsapp/sendTemplate";
import { generateAndUploadReceiptPdf } from "@/lib/whatsapp/receiptPdf";

export type PaymentConfirmedWhatsAppSkipReason =
  | "STUDENT_NOT_FOUND" | "DOJO_NOT_FOUND" | "NO_OPT_IN" | "NO_PHONE" | "PDF_FAILED"
  | "ALREADY_SENT" | "PLAN_NOT_INCLUDED" | "INVALID_PHONE" | "STUDENT_DOJO_MISMATCH" | "SEND_FAILED";

export type PaymentConfirmedWhatsAppResult =
  | { sent: true }
  | { sent: false; reason: PaymentConfirmedWhatsAppSkipReason };

/**
 * Genera el recibo PDF y envía la confirmación de pago por WhatsApp — usado
 * tanto por la transición automática pendiente/atrasado → pagado
 * (src/app/api/payments/route.ts) como por el botón manual "Enviar Recibo"
 * (src/app/api/payments/receipt/route.ts), para no duplicar esta lógica en
 * dos lugares. Nunca lanza — cualquier fallo se traduce a un `reason`.
 */
export async function sendPaymentConfirmedWhatsApp(
  dojoId:  string,
  payment: { id: string; studentId: string; amount: number; paidDate: Date | null; dueDate: Date },
): Promise<PaymentConfirmedWhatsAppResult> {
  try {
    const student = await prisma.student.findUnique({
      where: { id: payment.studentId, dojoId },
      select: {
        id: true, fullName: true, firstName: true, lastName: true, studentCode: true,
        motherName: true, motherPhone: true, fatherName: true, fatherPhone: true,
        primaryGuardian: true, whatsappOptIn: true,
      },
    });
    if (!student) return { sent: false, reason: "STUDENT_NOT_FOUND" };
    if (!student.whatsappOptIn) return { sent: false, reason: "NO_OPT_IN" };

    const guardianContact = resolveGuardianContact(student);
    if (!guardianContact.phone) return { sent: false, reason: "NO_PHONE" };

    const dojo = await prisma.dojo.findUnique({ where: { id: dojoId }, select: { name: true, logo: true, slug: true } });
    if (!dojo) return { sent: false, reason: "DOJO_NOT_FOUND" };

    const paidDate  = formatDate(payment.paidDate ?? new Date());
    const receiptNo = payment.id.slice(-8).toUpperCase();
    const { bodyParams } = buildConfirmedVars({
      guardianName: guardianContact.name,
      dojo,
      amount: payment.amount,
      paidDate,
    });

    let headerDocument;
    try {
      headerDocument = await generateAndUploadReceiptPdf({
        dojoName:    dojo.name,
        dojoSlug:    dojo.slug,
        dojoLogoUrl: dojo.logo,
        receiptNo,
        studentName: student.fullName || `${student.firstName} ${student.lastName}`.trim(),
        studentCode: student.studentCode,
        concept:     `Mensualidad ${new Date(payment.dueDate).toLocaleDateString("es-PA", { month: "long", year: "numeric" })}`,
        paidDate,
        amount:      payment.amount,
      });
    } catch (pdfErr) {
      console.error("Error generando/subiendo recibo PDF para WhatsApp:", pdfErr);
      return { sent: false, reason: "PDF_FAILED" };
    }

    const result = await sendWhatsAppTemplate({
      dojoId, studentId: student.id, paymentId: payment.id,
      type: "PAYMENT_CONFIRMED", templateName: "confirmacion_pago_dojomaster",
      headerDocument, bodyParams,
    });

    if (result.sent) return { sent: true };
    if (result.skipped) return { sent: false, reason: (result.reason as PaymentConfirmedWhatsAppSkipReason) ?? "ALREADY_SENT" };
    return { sent: false, reason: "SEND_FAILED" };
  } catch (err) {
    console.error("Error sending WhatsApp payment confirmation:", err);
    return { sent: false, reason: "SEND_FAILED" };
  }
}
