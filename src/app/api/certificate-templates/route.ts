import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

// GET /api/certificate-templates — lista plantillas activas del dojo
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

    const templates = await prisma.certificateTemplate.findMany({
      where:   { dojoId, active: true },
      orderBy: { createdAt: "desc" },
      select: {
        id:           true,
        name:         true,
        imageUrl:     true,
        canvasWidth:  true,
        canvasHeight: true,
        active:       true,
        createdAt:    true,
      },
    });

    return NextResponse.json(templates);
  } catch (err) {
    console.error("GET /api/certificate-templates", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/certificate-templates — crear plantilla
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
      name:           string;
      imageUrl:       string;
      imagePublicId:  string;
      canvasWidth?:   number;
      canvasHeight?:  number;
      elements:       unknown;
    };

    if (!body.name?.trim())        return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    if (!body.imageUrl?.trim())    return NextResponse.json({ error: "imageUrl requerida" }, { status: 400 });
    if (!body.imagePublicId?.trim()) return NextResponse.json({ error: "imagePublicId requerido" }, { status: 400 });

    const template = await prisma.certificateTemplate.create({
      data: {
        dojoId,
        name:          body.name.trim(),
        imageUrl:      body.imageUrl.trim(),
        imagePublicId: body.imagePublicId.trim(),
        canvasWidth:   body.canvasWidth  ?? 1000,
        canvasHeight:  body.canvasHeight ?? 700,
        elements:      body.elements ?? [],
      },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "CERTIFICATE_TEMPLATE_CREATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "CertificateTemplate",
      resourceId:   template.id,
      statusCode:   201,
    });

    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    console.error("POST /api/certificate-templates", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
