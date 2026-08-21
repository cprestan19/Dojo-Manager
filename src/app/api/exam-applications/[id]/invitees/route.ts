import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { resolveDojoTimezone } from "@/lib/timezone-server";
import { ymdInTz } from "@/lib/timezone";

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

    const VALID_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED", "FINALIZED"];
    if (!VALID_STATUSES.includes(application.status)) {
      return NextResponse.json({ error: "Estado de postulación no válido" }, { status: 400 });
    }

    // El plazo de respuesta solo tiene sentido mientras la postulación sigue
    // publicada — en CLOSED/FINALIZED un admin puede agregar a alguien
    // manualmente desde Asistencia de Examen (ej. un alumno que llegó sin
    // haber respondido a tiempo), así que el plazo ya no aplica ahí.
    if (application.status === "PUBLISHED" && application.deadline) {
      const dojoTz = await resolveDojoTimezone(dojoId);
      if (ymdInTz(new Date(), dojoTz) > ymdInTz(application.deadline, dojoTz)) {
        return NextResponse.json({ error: "El plazo de respuesta ha vencido — no se pueden agregar más invitados" }, { status: 400 });
      }
    }

    const body = await req.json() as {
      studentId: string; beltToPresent: string;
      response?: "ACCEPTED"; attended?: boolean;
    };
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
        // Un alumno agregado manualmente desde Asistencia de Examen (postulación
        // ya cerrada) entra directo como aceptado — y si ya llegó, presente.
        ...(body.response === "ACCEPTED" ? { response: "ACCEPTED", respondedAt: new Date() } : {}),
        ...(body.attended === true ? { attended: true, arrivedAt: new Date() } : {}),
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

// PATCH /api/exam-applications/[id]/invitees — editar cinta o pago de un invitado
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

    const { id: applicationId } = await params;

    const application = await prisma.examApplication.findFirst({ where: { id: applicationId, dojoId } });
    if (!application) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const body = await req.json() as { inviteeId: string; beltToPresent?: string; paymentStatus?: string };
    if (!body.inviteeId) return NextResponse.json({ error: "inviteeId requerido" }, { status: 400 });

    const invitee = await prisma.examApplicationInvitee.findFirst({
      where: { id: body.inviteeId, applicationId },
    });
    if (!invitee) return NextResponse.json({ error: "Invitado no encontrado" }, { status: 404 });

    const updated = await prisma.examApplicationInvitee.update({
      where: { id: body.inviteeId },
      data: {
        ...(body.beltToPresent  ? { beltToPresent:  body.beltToPresent }  : {}),
        ...(body.paymentStatus  ? { paymentStatus:  body.paymentStatus }  : {}),
      },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_INVITEE_UPDATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamApplicationInvitee",
      resourceId:   body.inviteeId,
      statusCode:   200,
      details:      JSON.stringify({ applicationId }),
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/exam-applications/[id]/invitees", err);
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

    const VALID_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED", "FINALIZED"];
    if (!VALID_STATUSES.includes(application.status)) {
      return NextResponse.json({ error: "Estado de postulación no válido" }, { status: 400 });
    }

    const body = await req.json() as { inviteeId: string };
    if (!body.inviteeId) return NextResponse.json({ error: "inviteeId requerido" }, { status: 400 });

    const invitee = await prisma.examApplicationInvitee.findFirst({
      where: { id: body.inviteeId, applicationId },
    });
    if (!invitee) return NextResponse.json({ error: "Invitado no encontrado" }, { status: 404 });

    // Una vez que ya tiene un resultado de examen decidido (o cinta ya
    // otorgada), quitarlo borraría ese registro para siempre — bloqueado,
    // primero hay que corregir el resultado antes de poder eliminarlo.
    if (invitee.passed !== null || invitee.beltAwarded) {
      return NextResponse.json({ error: "Este alumno ya tiene un resultado de examen registrado — no se puede eliminar" }, { status: 400 });
    }

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
