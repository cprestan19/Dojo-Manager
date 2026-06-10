import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  // La sesión es requerida — el scanner siempre opera con un usuario autenticado
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id         = searchParams.get("id");
  const scheduleId = searchParams.get("scheduleId") || null;

  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  // Resolver studentCode numérico o cardToken → SIEMPRE filtrando por dojoId del usuario autenticado
  let resolvedId = id;
  if (/^\d+$/.test(id)) {
    const byCode = await prisma.student.findFirst({
      where: { studentCode: parseInt(id, 10), dojoId },
      select: { id: true },
    });
    if (byCode) resolvedId = byCode.id;
  } else {
    const byToken = await prisma.student.findFirst({
      where: { OR: [{ id }, { cardToken: id }], dojoId },
      select: { id: true },
    });
    if (byToken) resolvedId = byToken.id;
  }

  // Nunca devolver datos de un alumno de otro dojo
  const student = await prisma.student.findFirst({
    where: { id: resolvedId, dojoId },
    select: {
      id: true, studentCode: true, fullName: true, firstName: true, lastName: true, photo: true, active: true,
      beltHistory: {
        orderBy: { changeDate: "desc" },
        take: 1,
        include: { kata: { select: { name: true } } },
      },
    },
  });

  if (!student)        return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  if (!student.active) return NextResponse.json({ error: "Alumno inactivo" },      { status: 403 });

  const studentOut = {
    id:          student.id,
    studentCode: student.studentCode,
    fullName:    student.fullName || `${student.firstName} ${student.lastName}`.trim(),
    photo:       student.photo?.startsWith("http") ? student.photo : null,
  };

  if (scheduleId) {
    // El horario también debe pertenecer al mismo dojo
    const assigned = await prisma.studentSchedule.findFirst({
      where: { studentId: resolvedId, scheduleId, schedule: { dojoId } },
      select: { id: true },
    });
    if (!assigned) {
      return NextResponse.json({
        error:   "Alumno no asignado a esta clase",
        code:    "NOT_ASSIGNED",
        student: studentOut,
      });
    }
  }

  const belt      = student.beltHistory[0]?.beltColor ?? null;
  const beltLabel = belt
    ? belt.charAt(0).toUpperCase() + belt.slice(1).replace(/-/g, " ")
    : "Sin rango";

  return NextResponse.json({
    ...studentOut,
    belt,
    beltLabel,
    assigned: true,
  });
}
