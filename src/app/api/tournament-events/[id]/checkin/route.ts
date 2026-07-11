/**
 * POST /api/tournament-events/[id]/checkin
 * Body: { studentId?: string, studentCode?: number }
 *
 * Marca la llegada de un alumno al torneo.
 * NO crea registro en la tabla de asistencia diaria.
 * Solo funciona con alumnos del mismo dojo.
 *
 * SEGURIDAD: El check-in es atómico — usa updateMany con WHERE arrived=false
 * para evitar doble registro aunque lleguen 15 peticiones simultáneas.
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
    const { id: eventId } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as SessionUser;
    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const body = await req.json().catch(() => ({})) as { studentId?: string; studentCode?: string | number };

    let raw = body.studentId?.trim() || (body.studentCode != null ? String(body.studentCode).trim() : "");
    if (!raw) return NextResponse.json({ error: "studentId requerido" }, { status: 400 });

    // El QR del carnet codifica la URL completa del carnet (".../id/<cardToken>") — extraer solo el token
    const urlMatch = raw.match(/\/id\/([^/?#\s]+)\s*$/);
    if (urlMatch) raw = urlMatch[1];

    // Resolver a Student.id real: por código numérico, cardToken o id directo — mismo patrón que /api/scan
    const resolved = /^\d+$/.test(raw)
      ? await prisma.student.findFirst({ where: { studentCode: parseInt(raw, 10), dojoId }, select: { id: true } })
      : await prisma.student.findFirst({ where: { OR: [{ id: raw }, { cardToken: raw }], dojoId }, select: { id: true } });

    const studentId = resolved?.id ?? null;
    if (!studentId)
      return NextResponse.json({ error: "Alumno no encontrado, inactivo o no pertenece a este dojo" }, { status: 403 });

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
      // Podría ser un alumno del dojo pero no inscrito (verificar también que esté activo)
      const student = await prisma.student.findFirst({
        where:  { id: studentId, dojoId, active: true },
        select: { id: true, fullName: true },
      });
      if (!student)
        return NextResponse.json({ error: "Alumno no encontrado, inactivo o no pertenece a este dojo" }, { status: 403 });
      return NextResponse.json({
        error:       "Alumno no está inscrito en este torneo",
        studentName: student.fullName,
        notEnrolled: true,
      }, { status: 404 });
    }

    // Obtener datos del alumno para la respuesta (sin photo)
    const student = await prisma.student.findUnique({
      where:  { id: studentId },
      select: {
        fullName:    true,
        beltHistory: { orderBy: { changeDate: "desc" }, take: 1, select: { beltColor: true } },
      },
    });

    const scannedBy = user.name ?? user.email ?? "Scanner";

    // ── Check-in atómico ────────────────────────────────────────────────────
    // updateMany con WHERE arrived=false garantiza que aunque lleguen N peticiones
    // simultáneas, solo UNA actualiza la fila. Las demás reciben count=0.
    const result = await prisma.tournamentEventParticipant.updateMany({
      where: { id: participant.id, arrived: false },
      data:  { arrived: true, arrivedAt: new Date(), scannedBy },
    });

    if (result.count === 0) {
      // Otro hilo ganó la carrera — re-leer arrivedAt actualizado
      const fresh = await prisma.tournamentEventParticipant.findUnique({
        where:  { id: participant.id },
        select: { arrivedAt: true },
      });
      return NextResponse.json({
        alreadyArrived: true,
        studentName:    student?.fullName ?? "",
        belt:           student?.beltHistory[0]?.beltColor ?? "",
        arrivedAt:      fresh?.arrivedAt?.toISOString() ?? participant.arrivedAt?.toISOString() ?? null,
      });
    }

    return NextResponse.json({
      success:     true,
      studentName: student?.fullName ?? "",
      belt:        student?.beltHistory[0]?.beltColor ?? "",
      arrivedAt:   new Date().toISOString(),
    }, { status: 200 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    console.error("[POST checkin]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
