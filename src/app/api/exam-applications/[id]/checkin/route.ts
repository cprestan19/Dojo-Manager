/**
 * POST /api/exam-applications/[id]/checkin
 * Body: { studentId?: string, studentCode?: number }
 *
 * Marca la llegada de un alumno postulado a un examen ya cerrado (o
 * finalizado). Mismo patrón que /api/tournament-events/[id]/checkin:
 * check-in atómico vía updateMany con WHERE attended=false, para evitar
 * doble registro aunque lleguen varias peticiones casi simultáneas.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null; name?: string | null; email?: string | null };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: applicationId } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as SessionUser;
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const body = await req.json().catch(() => ({})) as { studentId?: string; studentCode?: string | number };
    let raw = body.studentId?.trim() || (body.studentCode != null ? String(body.studentCode).trim() : "");
    if (!raw) return NextResponse.json({ error: "studentId requerido" }, { status: 400 });

    // El QR del carnet codifica la URL completa (".../id/<cardToken>") — extraer solo el token
    const urlMatch = raw.match(/\/id\/([^/?#\s]+)\s*$/);
    if (urlMatch) raw = urlMatch[1];

    const resolved = /^\d+$/.test(raw)
      ? await prisma.student.findFirst({ where: { studentCode: parseInt(raw, 10), dojoId }, select: { id: true } })
      : await prisma.student.findFirst({ where: { OR: [{ id: raw }, { cardToken: raw }], dojoId }, select: { id: true } });

    const studentId = resolved?.id ?? null;
    if (!studentId) {
      return NextResponse.json({ error: "Alumno no encontrado, inactivo o no pertenece a este dojo" }, { status: 403 });
    }

    const application = await prisma.examApplication.findFirst({
      where:  { id: applicationId, dojoId },
      select: { id: true, status: true },
    });
    if (!application) return NextResponse.json({ error: "Postulación no encontrada" }, { status: 404 });
    if (application.status !== "CLOSED" && application.status !== "FINALIZED") {
      return NextResponse.json({ error: "La asistencia solo se puede tomar con inscripciones cerradas" }, { status: 400 });
    }

    const invitee = await prisma.examApplicationInvitee.findUnique({
      where: { applicationId_studentId: { applicationId, studentId } },
    });

    if (!invitee || invitee.response !== "ACCEPTED") {
      const student = await prisma.student.findFirst({
        where: { id: studentId, dojoId, active: true },
        select: { id: true, fullName: true },
      });
      if (!student) {
        return NextResponse.json({ error: "Alumno no encontrado, inactivo o no pertenece a este dojo" }, { status: 403 });
      }
      return NextResponse.json({
        error:       "Alumno no está en la lista de esta postulación",
        studentName: student.fullName,
        notEnrolled: true,
      }, { status: 404 });
    }

    const student = await prisma.student.findUnique({
      where:  { id: studentId },
      select: { fullName: true },
    });

    const scannedBy = user.name ?? user.email ?? "Scanner";

    const result = await prisma.examApplicationInvitee.updateMany({
      where: { id: invitee.id, attended: false },
      data:  { attended: true, arrivedAt: new Date(), scannedBy },
    });

    if (result.count === 0) {
      const fresh = await prisma.examApplicationInvitee.findUnique({
        where:  { id: invitee.id },
        select: { arrivedAt: true },
      });
      return NextResponse.json({
        alreadyArrived: true,
        studentName:    student?.fullName ?? "",
        belt:           invitee.beltToPresent,
        arrivedAt:      fresh?.arrivedAt?.toISOString() ?? invitee.arrivedAt?.toISOString() ?? null,
      });
    }

    return NextResponse.json({
      success:     true,
      studentName: student?.fullName ?? "",
      belt:        invitee.beltToPresent,
      arrivedAt:   new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    console.error("[POST /api/exam-applications/[id]/checkin]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
