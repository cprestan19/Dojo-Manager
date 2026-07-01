import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

// GET /api/dojo/terms — obtiene la política de términos del dojo
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

    const policy = await prisma.dojoTermsPolicy.findUnique({ where: { dojoId } });

    // Cuenta cuántos alumnos activos han aceptado la versión actual
    let acceptedCount = 0;
    let totalActive   = 0;
    if (policy) {
      [acceptedCount, totalActive] = await Promise.all([
        prisma.termsAcceptance.count({
          where: { dojoId, version: policy.version },
        }),
        prisma.student.count({ where: { dojoId, active: true } }),
      ]);
    }

    return NextResponse.json({ policy, acceptedCount, totalActive });
  } catch (err) {
    console.error("GET /api/dojo/terms", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PUT /api/dojo/terms — crea o actualiza la política de términos
export async function PUT(req: NextRequest) {
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
      content:    string;
      enabled:    boolean;
      bumpVersion?: boolean;  // si true incrementa la versión y borra aceptaciones anteriores
    };

    if (!body.content?.trim()) {
      return NextResponse.json({ error: "El contenido no puede estar vacío" }, { status: 400 });
    }

    const existing = await prisma.dojoTermsPolicy.findUnique({ where: { dojoId } });
    const newVersion = existing
      ? (body.bumpVersion ? existing.version + 1 : existing.version)
      : 1;

    const policy = await prisma.dojoTermsPolicy.upsert({
      where:  { dojoId },
      create: { dojoId, content: body.content.trim(), enabled: body.enabled, version: 1 },
      update: { content: body.content.trim(), enabled: body.enabled, version: newVersion },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "DOJO_TERMS_UPDATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "DojoTermsPolicy",
      resourceId:   policy.id,
      statusCode:   200,
      details:      JSON.stringify({ enabled: body.enabled, version: policy.version, bumpVersion: !!body.bumpVersion }),
    });

    return NextResponse.json(policy);
  } catch (err) {
    console.error("PUT /api/dojo/terms", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
