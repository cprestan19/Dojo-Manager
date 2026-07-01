import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

// GET /api/generated-certificates — lista certificados del dojo
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const certificates = await prisma.generatedCertificate.findMany({
      where:   { dojoId },
      orderBy: { createdAt: "desc" },
      select: {
        id:             true,
        title:          true,
        beltColor:      true,
        issuedDate:     true,
        status:         true,
        pdfUrl:         true,
        instructorName: true,
        createdAt:      true,
        student: {
          select: {
            id:          true,
            fullName:    true,
            studentCode: true,
          },
        },
        template: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(certificates);
  } catch (err) {
    console.error("GET /api/generated-certificates", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/generated-certificates — generar certificados en batch
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const body = await req.json() as {
      inviteeIds:      string[];
      templateId:      string;
      issuedDate:      string;
      instructorName?: string;
    };

    if (!body.inviteeIds?.length)  return NextResponse.json({ error: "inviteeIds requerido" }, { status: 400 });
    if (!body.templateId?.trim())  return NextResponse.json({ error: "templateId requerido" }, { status: 400 });
    if (!body.issuedDate)          return NextResponse.json({ error: "issuedDate requerida" }, { status: 400 });

    // Verificar plantilla del dojo
    const template = await prisma.certificateTemplate.findFirst({
      where: { id: body.templateId, dojoId, active: true },
    });
    if (!template) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });

    // Obtener invitados con sus datos de alumno y cinta
    const invitees = await prisma.examApplicationInvitee.findMany({
      where: {
        id:        { in: body.inviteeIds },
        passed:    true,
        application: { dojoId },
      },
      include: {
        student:     { select: { id: true, fullName: true } },
        application: { select: { title: true } },
      },
    });

    if (!invitees.length) {
      return NextResponse.json({ error: "No hay invitados aprobados en la selección" }, { status: 400 });
    }

    // Verificar duplicados (inviteeId ya con certificado)
    const existingInviteeIds = await prisma.generatedCertificate.findMany({
      where: { inviteeId: { in: body.inviteeIds }, dojoId },
      select: { inviteeId: true },
    });
    const existingSet = new Set(existingInviteeIds.map(e => e.inviteeId));

    const toCreate = invitees.filter(inv => !existingSet.has(inv.id));
    if (!toCreate.length) {
      return NextResponse.json({ error: "Todos los invitados seleccionados ya tienen certificado" }, { status: 400 });
    }

    const issuedDate = new Date(body.issuedDate);

    const created = await prisma.$transaction(
      toCreate.map(inv =>
        prisma.generatedCertificate.create({
          data: {
            dojoId,
            studentId:      inv.student.id,
            inviteeId:      inv.id,
            templateId:     body.templateId,
            title:          `Diploma ${inv.application.title}`,
            beltColor:      inv.beltToPresent,
            issuedDate,
            instructorName: body.instructorName?.trim() ?? null,
            status:         "DRAFT",
          },
        })
      )
    );

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "CERTIFICATES_GENERATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "GeneratedCertificate",
      statusCode:   201,
      details:      JSON.stringify({ count: created.length, templateId: body.templateId }),
    });

    return NextResponse.json({ created: created.length }, { status: 201 });
  } catch (err) {
    console.error("POST /api/generated-certificates", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
