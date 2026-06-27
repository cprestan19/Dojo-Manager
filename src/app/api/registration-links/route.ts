import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { randomUUID } from "crypto";

type SessionUser = { id?: string; role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const links = await prisma.registrationLink.findMany({
      where:   { dojoId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { pendingStudents: { where: { status: "pending" } } },
        },
      },
    });

    return NextResponse.json(links);
  } catch (err) {
    console.error("GET /api/registration-links error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.label?.trim()) {
      return NextResponse.json({ error: "El campo 'label' es requerido" }, { status: 400 });
    }

    const userId = (session.user as { id?: string }).id ?? "";
    const link = await prisma.registrationLink.create({
      data: {
        dojoId,
        token:       randomUUID(),
        label:       String(body.label).trim(),
        isActive:    body.isActive    !== undefined ? Boolean(body.isActive)  : true,
        activatesAt: body.activatesAt ? new Date(body.activatesAt) : null,
        expiresAt:   body.expiresAt   ? new Date(body.expiresAt)   : null,
        maxUses:     body.maxUses     ? Number(body.maxUses)        : null,
        createdBy:   userId,
      },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "REGISTRATION_LINK_CREATED",
      module:       AUDIT_MODULE.STUDENTS,
      resourceType: "RegistrationLink",
      resourceId:   link.id,
      statusCode:   201,
      details:      JSON.stringify({ label: link.label, token: link.token }),
    });

    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    console.error("POST /api/registration-links error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
