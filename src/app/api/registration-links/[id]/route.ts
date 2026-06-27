import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const link = await prisma.registrationLink.findUnique({ where: { id }, select: { dojoId: true } });
    if (!link || link.dojoId !== dojoId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (body.label      != null) data.label      = String(body.label).trim();
    if (body.isActive   != null) data.isActive   = Boolean(body.isActive);
    if ("activatesAt" in body)   data.activatesAt = body.activatesAt ? new Date(body.activatesAt) : null;
    if ("expiresAt"   in body)   data.expiresAt   = body.expiresAt   ? new Date(body.expiresAt)   : null;
    if ("maxUses"     in body)   data.maxUses     = body.maxUses != null ? Number(body.maxUses) : null;

    const updated = await prisma.registrationLink.update({ where: { id }, data });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "REGISTRATION_LINK_UPDATED",
      module:       AUDIT_MODULE.STUDENTS,
      resourceType: "RegistrationLink",
      resourceId:   id,
      statusCode:   200,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/registration-links/[id] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const link = await prisma.registrationLink.findUnique({
      where:  { id },
      select: {
        dojoId: true,
        label:  true,
        pendingStudents: { select: { id: true, status: true, fullName: true } },
      },
    });

    if (!link || link.dojoId !== dojoId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const pendingCount  = link.pendingStudents.filter(p => p.status === "pending").length;
    const approvedCount = link.pendingStudents.filter(p => p.status === "approved").length;
    const rejectedCount = link.pendingStudents.filter(p => p.status === "rejected").length;

    // Bloquear si hay solicitudes sin revisar
    if (pendingCount > 0) {
      return NextResponse.json({
        error: `No se puede eliminar: hay ${pendingCount} solicitud${pendingCount > 1 ? "es" : ""} pendiente${pendingCount > 1 ? "s" : ""} de revisión. Apruébalas o recházalas primero.`,
      }, { status: 409 });
    }

    // Eliminar el link — los pending_students asociados se borran en cascada por la BD
    await prisma.registrationLink.delete({ where: { id } });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "REGISTRATION_LINK_DELETED",
      module:       AUDIT_MODULE.STUDENTS,
      resourceType: "RegistrationLink",
      resourceId:   id,
      statusCode:   200,
      // Registra cuántas solicitudes históricas se eliminaron junto con el link
      details: JSON.stringify({
        label:         link.label,
        cascadeDeleted: { approved: approvedCount, rejected: rejectedCount },
        note: "Students ya creados (approved) no son afectados — viven en tabla students independiente",
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/registration-links/[id] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
