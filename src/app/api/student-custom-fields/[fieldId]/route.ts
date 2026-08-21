import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ fieldId: string }> };

// PUT /api/student-custom-fields/[fieldId] — renombrar / activar / desactivar
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { fieldId } = await params;
    const existing = await prisma.studentCustomField.findFirst({ where: { id: fieldId, dojoId } });
    if (!existing) return NextResponse.json({ error: "Campo no encontrado" }, { status: 404 });

    const body = await req.json() as { label?: string; active?: boolean };
    const data: { label?: string; active?: boolean } = {};
    if (body.label != null) {
      const label = body.label.trim().slice(0, 60);
      if (!label) return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });
      data.label = label;
    }
    if (body.active != null) data.active = Boolean(body.active);

    const updated = await prisma.studentCustomField.update({ where: { id: fieldId }, data });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "STUDENT_CUSTOM_FIELD_UPDATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "StudentCustomField",
      resourceId:   fieldId,
      statusCode:   200,
      details:      JSON.stringify(data),
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/student-custom-fields/[fieldId]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/student-custom-fields/[fieldId] — elimina el campo y sus valores
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { fieldId } = await params;
    const existing = await prisma.studentCustomField.findFirst({ where: { id: fieldId, dojoId } });
    if (!existing) return NextResponse.json({ error: "Campo no encontrado" }, { status: 404 });

    await prisma.studentCustomField.delete({ where: { id: fieldId } }); // cascada borra sus valores

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "STUDENT_CUSTOM_FIELD_DELETED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "StudentCustomField",
      resourceId:   fieldId,
      statusCode:   200,
      details:      JSON.stringify({ label: existing.label }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/student-custom-fields/[fieldId]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
