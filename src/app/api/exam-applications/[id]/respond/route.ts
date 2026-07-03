import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { sendPushToDojoAdminsAsync } from "@/lib/push";

type Params = { params: Promise<{ id: string }> };

// POST /api/exam-applications/[id]/respond — alumno responde su invitación
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; studentId?: string | null };
    if (user.role !== "student" || !user.studentId) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const { id: applicationId } = await params;

    const application = await prisma.examApplication.findUnique({
      where:  { id: applicationId },
      select: { id: true, status: true, deadline: true, dojoId: true, title: true },
    });
    if (!application) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    if (application.status !== "PUBLISHED") {
      return NextResponse.json({ error: "La postulación no está disponible para responder" }, { status: 400 });
    }

    // Verificar deadline comparando solo la fecha en Panama (UTC-5).
    // El deadline se guarda como medianoche UTC; comparar timestamps exactos
    // expiraría 7 horas antes del día real en Panama.
    if (application.deadline) {
      const toYMD = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Panama" });
      if (toYMD(new Date()) > toYMD(application.deadline)) {
        return NextResponse.json({ error: "El período de respuesta ha cerrado" }, { status: 400 });
      }
    }

    const body = await req.json() as { response: "ACCEPTED" | "REJECTED"; responseNote?: string; studentId?: string };

    // Si se pasa studentId (invitación de un hermano), verificar que sea hermano del alumno principal
    const targetStudentId = body.studentId && body.studentId !== user.studentId
      ? body.studentId
      : user.studentId!;

    if (targetStudentId !== user.studentId) {
      // Verificar que targetStudentId sea hermano (mismo correo de padre/madre)
      const [principal, target] = await Promise.all([
        prisma.student.findUnique({ where: { id: user.studentId! }, select: { dojoId: true, motherEmail: true, fatherEmail: true } }),
        prisma.student.findUnique({ where: { id: targetStudentId },  select: { dojoId: true, motherEmail: true, fatherEmail: true } }),
      ]);
      const isSameDojo = principal?.dojoId === target?.dojoId;
      const principalEmails = [principal?.motherEmail?.trim(), principal?.fatherEmail?.trim()].filter(Boolean);
      const targetEmails    = [target?.motherEmail?.trim(),    target?.fatherEmail?.trim()   ].filter(Boolean);
      const shareEmail      = principalEmails.some(e => targetEmails.includes(e));
      if (!isSameDojo || !shareEmail) {
        return NextResponse.json({ error: "Sin permiso para responder por este alumno" }, { status: 403 });
      }
    }

    // Verificar que el alumno (o el hermano) sea invitado
    const invitee = await prisma.examApplicationInvitee.findUnique({
      where: {
        applicationId_studentId: {
          applicationId,
          studentId: targetStudentId,
        },
      },
      include: { student: { select: { fullName: true } } },
    });
    if (!invitee) return NextResponse.json({ error: "No estás invitado a esta postulación" }, { status: 403 });
    if (!body.response || !["ACCEPTED", "REJECTED"].includes(body.response)) {
      return NextResponse.json({ error: "Respuesta inválida. Use ACCEPTED o REJECTED" }, { status: 400 });
    }
    if (body.response === "REJECTED" && !body.responseNote?.trim()) {
      return NextResponse.json({ error: "El motivo es requerido al rechazar" }, { status: 400 });
    }
    const responseNote = body.responseNote?.trim().slice(0, 1000) ?? null;

    const updated = await prisma.examApplicationInvitee.update({
      where: { id: invitee.id },
      data: {
        response:     body.response,
        responseNote,
        respondedAt:  new Date(),
      },
    });

    const ctx = buildAuditCtx(session, req, { dojoId: null });
    await logAudit({
      ...ctx,
      action:       "EXAM_INVITATION_RESPONDED",
      module:       AUDIT_MODULE.PORTAL,
      resourceType: "ExamApplicationInvitee",
      resourceId:   invitee.id,
      statusCode:   200,
      details:      JSON.stringify({ applicationId, response: body.response }),
    });

    // Notificar a admins del dojo
    const studentName = invitee.student.fullName;
    const accepted    = body.response === "ACCEPTED";
    sendPushToDojoAdminsAsync(application.dojoId, {
      title: `${accepted ? "✅" : "❌"} Respuesta a postulación`,
      body:  `${studentName} ${accepted ? "aceptó" : "rechazó"} la invitación a ${application.title}`,
      url:   `/dashboard/postulaciones/${applicationId}`,
      tag:   `exam-respond-${applicationId}`,
    }, { type: "exam_response" });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("POST /api/exam-applications/[id]/respond", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
