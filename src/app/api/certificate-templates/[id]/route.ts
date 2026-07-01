import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// GET /api/certificate-templates/[id]
export async function GET(req: NextRequest, { params }: Params) {
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

    const template = await prisma.certificateTemplate.findFirst({
      where: { id, dojoId },
    });
    if (!template) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    return NextResponse.json(template);
  } catch (err) {
    console.error("GET /api/certificate-templates/[id]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PUT /api/certificate-templates/[id]
export async function PUT(req: NextRequest, { params }: Params) {
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

    const existing = await prisma.certificateTemplate.findFirst({ where: { id, dojoId } });
    if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const body = await req.json() as {
      name?:         string;
      elements?:     unknown;
      canvasWidth?:  number;
      canvasHeight?: number;
    };

    const updated = await prisma.certificateTemplate.update({
      where: { id },
      data: {
        ...(body.name         != null ? { name:         body.name.trim() }   : {}),
        ...(body.elements     != null ? { elements:     body.elements }       : {}),
        ...(body.canvasWidth  != null ? { canvasWidth:  body.canvasWidth }   : {}),
        ...(body.canvasHeight != null ? { canvasHeight: body.canvasHeight }  : {}),
      },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "CERTIFICATE_TEMPLATE_UPDATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "CertificateTemplate",
      resourceId:   id,
      statusCode:   200,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/certificate-templates/[id]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/certificate-templates/[id] — soft-delete (active=false)
export async function DELETE(req: NextRequest, { params }: Params) {
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

    const existing = await prisma.certificateTemplate.findFirst({ where: { id, dojoId } });
    if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    // Verificar que no tenga certificados ISSUED
    const issuedCount = await prisma.generatedCertificate.count({
      where: { templateId: id, status: "ISSUED" },
    });
    if (issuedCount > 0) {
      return NextResponse.json({ error: "No se puede eliminar: tiene certificados emitidos" }, { status: 400 });
    }

    await prisma.certificateTemplate.update({
      where: { id },
      data:  { active: false },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "CERTIFICATE_TEMPLATE_DELETED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "CertificateTemplate",
      resourceId:   id,
      statusCode:   200,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/certificate-templates/[id]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
