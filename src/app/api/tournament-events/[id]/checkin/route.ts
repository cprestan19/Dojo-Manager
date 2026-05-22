/**
 * POST /api/tournament-events/[id]/checkin
 * Body: { studentId?: string, studentCode?: number }
 *
 * Marca la llegada de un alumno al torneo.
 * NO crea registro en la tabla de asistencia diaria.
 * Solo funciona con alumnos del mismo dojo.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null; name?: string | null; email?: string | null };

export async function POST(req: NextRequest, { params }: Params) {
  const { id: eventId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { studentId?: string; studentCode?: string | number };

  // Resolver studentId desde código numérico o id directo
  let studentId = body.studentId?.trim() ?? null;

  if (!studentId && body.studentCode) {
    const code = parseInt(String(body.studentCode), 10);
    if (!isNaN(code)) {
      const s = await prisma.student.findFirst({
        where:  { studentCode: code, dojoId },
        select: { id: true },
      });
      studentId = s?.id ?? null;
    }
  }

  if (!studentId) return NextResponse.json({ error: "studentId requerido" }, { status: 400 });

  // Verificar que el torneo pertenece a este dojo
  const event = await prisma.tournamentEvent.findFirst({
    where:  { id: eventId, dojoId },
    select: { id: true, name: true },
  });
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  // Verificar que el alumno está en el torneo Y pertenece al dojo
  const participant = await prisma.tournamentEventParticipant.findUnique({
    where: { eventId_studentId: { eventId, studentId } },
  });

  if (!participant) {
    // Podría ser un alumno del dojo pero no inscrito
    const student = await prisma.student.findFirst({
      where:  { id: studentId, dojoId },
      select: { id: true, fullName: true },
    });
    if (!student)
      return NextResponse.json({ error: "Alumno no pertenece a este dojo" }, { status: 403 });
    return NextResponse.json({
      error:       "Alumno no está inscrito en este torneo",
      studentName: student.fullName,
      notEnrolled: true,
    }, { status: 404 });
  }

  // Obtener datos del alumno para la respuesta
  const student = await prisma.student.findUnique({
    where:  { id: studentId },
    select: {
      fullName: true,
      beltHistory: { orderBy: { changeDate: "desc" }, take: 1, select: { beltColor: true } },
    },
  });

  if (participant.arrived) {
    return NextResponse.json({
      alreadyArrived: true,
      studentName:    student?.fullName ?? "",
      belt:           student?.beltHistory[0]?.beltColor ?? "",
      arrivedAt:      participant.arrivedAt?.toISOString() ?? null,
    });
  }

  const scannedBy = user.name ?? user.email ?? "Scanner";
  const updated   = await prisma.tournamentEventParticipant.update({
    where: { id: participant.id },
    data:  { arrived: true, arrivedAt: new Date(), scannedBy },
  });

  return NextResponse.json({
    success:     true,
    studentName: student?.fullName ?? "",
    belt:        student?.beltHistory[0]?.beltColor ?? "",
    arrivedAt:   updated.arrivedAt?.toISOString() ?? null,
  }, { status: 200 });
}
