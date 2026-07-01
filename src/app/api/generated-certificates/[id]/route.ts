import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// GET /api/generated-certificates/[id]
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

    const cert = await prisma.generatedCertificate.findFirst({
      where: { id, dojoId },
      include: {
        student:  { select: { id: true, fullName: true, studentCode: true } },
        template: { select: { id: true, name: true, imageUrl: true, elements: true, canvasWidth: true, canvasHeight: true } },
      },
    });
    if (!cert) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    return NextResponse.json(cert);
  } catch (err) {
    console.error("GET /api/generated-certificates/[id]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH /api/generated-certificates/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
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

    const existing = await prisma.generatedCertificate.findFirst({ where: { id, dojoId } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const body = await req.json() as {
      status?:        "ISSUED" | "REVOKED";
      revokedReason?: string;
      pdfUrl?:        string;
      pdfPublicId?:   string;
    };

    if (body.status && !["ISSUED", "REVOKED"].includes(body.status)) {
      return NextResponse.json({ error: "status inválido" }, { status: 400 });
    }

    const updated = await prisma.generatedCertificate.update({
      where: { id },
      data: {
        ...(body.status        != null ? { status:        body.status }              : {}),
        ...(body.revokedReason != null ? { revokedReason: body.revokedReason.trim() } : {}),
        ...(body.pdfUrl        != null ? { pdfUrl:        body.pdfUrl }              : {}),
        ...(body.pdfPublicId   != null ? { pdfPublicId:   body.pdfPublicId }         : {}),
        ...(body.status === "REVOKED"  ? { revokedAt:     new Date() }               : {}),
      },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "CERTIFICATE_STATUS_CHANGED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "GeneratedCertificate",
      resourceId:   id,
      statusCode:   200,
      details:      JSON.stringify({ status: body.status }),
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/generated-certificates/[id]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/generated-certificates/[id] — solo DRAFT
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

    const existing = await prisma.generatedCertificate.findFirst({ where: { id, dojoId } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    if (existing.status !== "DRAFT") {
      return NextResponse.json({ error: "Solo se pueden eliminar certificados en estado DRAFT" }, { status: 400 });
    }

    await prisma.generatedCertificate.delete({ where: { id } });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "CERTIFICATE_DELETED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "GeneratedCertificate",
      resourceId:   id,
      statusCode:   200,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/generated-certificates/[id]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
