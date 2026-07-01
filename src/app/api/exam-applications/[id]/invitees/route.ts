import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// POST /api/exam-applications/[id]/invitees — agregar invitado
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

    const { id: applicationId } = await params;

    const application = await prisma.examApplication.findFirst({ where: { id: applicationId, dojoId } });
    if (!application) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    if (application.status !== "DRAFT" && application.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Solo se pueden agregar invitados en DRAFT o PUBLISHED" }, { status: 400 });
    }

    // Bloquear si el plazo de respuesta ya venció
    if (application.deadline && application.deadline < new Date()) {
      return NextResponse.json({ error: "El plazo de respuesta ha vencido — no se pueden agregar más invitados" }, { status: 400 });
    }

    const body = await req.json() as { studentId: string; beltToPresent: string };
    if (!body.studentId?.trim())    return NextResponse.json({ error: "studentId requerido" }, { status: 400 });
    if (!body.beltToPresent?.trim()) return NextResponse.json({ error: "beltToPresent requerido" }, { status: 400 });

    // Verificar que el alumno pertenezca al dojo
    const student = await prisma.student.findFirst({
      where: { id: body.studentId, dojoId },
    });
    if (!student) return NextResponse.json({ error: "Alumno no encontrado en este dojo" }, { status: 404 });

    const invitee = await prisma.examApplicationInvitee.create({
      data: {
        applicationId:  applicationId,
        studentId:      body.studentId,
        beltToPresent:  body.beltToPresent,
      },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_INVITEE_ADDED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamApplicationInvitee",
      resourceId:   invitee.id,
      statusCode:   201,
      details:      JSON.stringify({ applicationId }),
    });

    return NextResponse.json(invitee, { status: 201 });
  } catch (err) {
    console.error("POST /api/exam-applications/[id]/invitees", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/exam-applications/[id]/invitees — quitar invitado (body: {inviteeId})
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

    const { id: applicationId } = await params;

    const application = await prisma.examApplication.findFirst({ where: { id: applicationId, dojoId } });
    if (!application) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    if (application.status !== "DRAFT") {
      return NextResponse.json({ error: "Solo se pueden quitar invitados en estado DRAFT" }, { status: 400 });
    }

    const body = await req.json() as { inviteeId: string };
    if (!body.inviteeId) return NextResponse.json({ error: "inviteeId requerido" }, { status: 400 });

    const invitee = await prisma.examApplicationInvitee.findFirst({
      where: { id: body.inviteeId, applicationId },
    });
    if (!invitee) return NextResponse.json({ error: "Invitado no encontrado" }, { status: 404 });

    await prisma.examApplicationInvitee.delete({ where: { id: body.inviteeId } });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_INVITEE_REMOVED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamApplicationInvitee",
      resourceId:   body.inviteeId,
      statusCode:   200,
      details:      JSON.stringify({ applicationId }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/exam-applications/[id]/invitees", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
