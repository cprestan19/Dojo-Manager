import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { renderCertificatePdf, type CertElement } from "@/lib/certificate-render";
import { uploadBuffer } from "@/lib/imagekit";
import { getDojoUploadFolder } from "@/lib/media";
import { getBeltInfo } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

// POST /api/generated-certificates/[id]/issue — renderiza el PDF real y
// pasa el certificado de DRAFT a ISSUED. Solo alcanza a certificados
// DRAFT del propio dojo, cuyo postulado siga ACCEPTED + passed=true.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id } = await params;

    // Scoping estricto por dojoId — un admin nunca puede emitir un
    // certificado de otro tenant, sin importar el id que envíe.
    const cert = await prisma.generatedCertificate.findFirst({
      where: { id, dojoId },
      include: {
        student:  { select: { id: true, fullName: true, dojoId: true } },
        invitee:  { select: { id: true, response: true, passed: true } },
        template: { select: { imageUrl: true, canvasWidth: true, canvasHeight: true, elements: true } },
      },
    });
    if (!cert) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    if (cert.student.dojoId !== dojoId) {
      return NextResponse.json({ error: "El alumno no pertenece a este dojo" }, { status: 403 });
    }

    if (cert.status !== "DRAFT") {
      return NextResponse.json({ error: "Solo se pueden emitir certificados en estado DRAFT" }, { status: 400 });
    }

    // Revalidar contra el postulado por si su respuesta/resultado cambió
    // después de generar el borrador — solo emitir a quien aceptó y aprobó.
    if (cert.invitee && (cert.invitee.response !== "ACCEPTED" || cert.invitee.passed !== true)) {
      return NextResponse.json(
        { error: "El postulado ya no cumple los requisitos (debe haber aceptado y aprobado el examen)" },
        { status: 400 },
      );
    }

    // issuedDate es una fecha pura (sin hora, de <input type="date">) — se formatea con los
    // componentes UTC directos, sin convertir a ninguna zona horaria (evita mostrar el día
    // anterior al elegido, que ocurriría con cualquier zona de offset negativo).
    const issuedDate = cert.issuedDate.toLocaleDateString("es-PA", {
      timeZone: "UTC",
      day:      "2-digit",
      month:    "long",
      year:     "numeric",
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
      pdfBuffer, `certificado-${id}.pdf`, `dojo-manager/${await getDojoUploadFolder(dojoId)}/certificates`, "application/pdf",
    );

    const updated = await prisma.generatedCertificate.update({
      where: { id },
      data:  { status: "ISSUED", pdfUrl: url, pdfPublicId: fileId },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "CERTIFICATE_ISSUED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "GeneratedCertificate",
      resourceId:   id,
      statusCode:   200,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("POST /api/generated-certificates/[id]/issue", err);
    return NextResponse.json({ error: "Error al emitir el certificado" }, { status: 500 });
  }
}
