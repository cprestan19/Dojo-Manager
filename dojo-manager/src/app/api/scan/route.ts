import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id         = searchParams.get("id");
  const scheduleId = searchParams.get("scheduleId") || null;

  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  let resolvedId = id;
  if (/^\d+$/.test(id)) {
    const byCode = await prisma.student.findFirst({
      where: { studentCode: parseInt(id, 10) },
      select: { id: true },
    });
    if (byCode) resolvedId = byCode.id;
  }

  const student = await prisma.student.findUnique({
    where: { id: resolvedId },
    select: {
      id: true, fullName: true, firstName: true, lastName: true, photo: true, active: true,
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
    id:        student.id,
    firstName: student.firstName,
    lastName:  student.lastName,
    photo:     student.photo,
  };

  if (scheduleId) {
    const assigned = await prisma.studentSchedule.findFirst({
      where: { studentId: resolvedId, scheduleId },
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
