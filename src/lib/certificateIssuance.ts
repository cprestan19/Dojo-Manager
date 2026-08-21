import prisma from "@/lib/prisma";
import { renderCertificatePdf, type CertElement } from "@/lib/certificate-render";
import { uploadBuffer } from "@/lib/imagekit";
import { getDojoUploadFolder } from "@/lib/media";
import { getBeltInfo } from "@/lib/utils";

/**
 * Renderiza el PDF real de un certificado DRAFT y lo pasa a ISSUED.
 * Extraído de POST /api/generated-certificates/[id]/issue para poder
 * reutilizarlo desde la emisión manual Y desde la emisión automática al
 * finalizar un examen (ver finalize/route.ts) sin duplicar la lógica de
 * render/subida. No hace checks de sesión/rol — eso lo resuelve cada caller
 * según su propio contexto (HTTP con usuario real, o el cron/finalize interno).
 */
export async function issueCertificate(certId: string, dojoId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const cert = await prisma.generatedCertificate.findFirst({
    where: { id: certId, dojoId },
    include: {
      student:  { select: { id: true, fullName: true, dojoId: true } },
      invitee:  { select: { id: true, response: true, passed: true } },
      template: { select: { imageUrl: true, canvasWidth: true, canvasHeight: true, elements: true } },
    },
  });
  if (!cert) return { ok: false, error: "No encontrado" };
  if (cert.student.dojoId !== dojoId) return { ok: false, error: "El alumno no pertenece a este dojo" };
  if (cert.status !== "DRAFT") return { ok: false, error: "Solo se pueden emitir certificados en estado DRAFT" };

  if (cert.invitee && (cert.invitee.response !== "ACCEPTED" || cert.invitee.passed !== true)) {
    return { ok: false, error: "El postulado ya no cumple los requisitos (debe haber aceptado y aprobado el examen)" };
  }

  const issuedDate = cert.issuedDate.toLocaleDateString("es-PA", {
    timeZone: "UTC", day: "2-digit", month: "long", year: "numeric",
  });

  const pdfBuffer = await renderCertificatePdf(
    {
      imageUrl:     cert.template.imageUrl,
      canvasWidth:  cert.template.canvasWidth,
      canvasHeight: cert.template.canvasHeight,
      elements:     cert.template.elements as unknown as CertElement[],
    },
    {
      studentName: cert.student.fullName,
      belt:        `Cinta ${getBeltInfo(cert.beltColor).label}`,
      date:        issuedDate,
      instructor:  cert.instructorName ?? "",
    },
  );

  const { url, fileId } = await uploadBuffer(
    pdfBuffer, `certificado-${certId}.pdf`, `dojo-manager/${await getDojoUploadFolder(dojoId)}/certificates`, "application/pdf",
  );

  await prisma.generatedCertificate.update({
    where: { id: certId },
    data:  { status: "ISSUED", pdfUrl: url, pdfPublicId: fileId },
  });

  return { ok: true };
}
