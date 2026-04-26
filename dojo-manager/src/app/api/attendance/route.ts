import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  if (!dojoId) return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const studentId  = searchParams.get("studentId");
  const scheduleId = searchParams.get("scheduleId");
  const type       = searchParams.get("type");
  const dateFrom   = searchParams.get("dateFrom");
  const dateTo     = searchParams.get("dateTo");

  // Cap at 500 rows when no specific student/date range is given — prevents unbounded scans
  const hasNarrowFilter = !!(studentId || (dateFrom && dateTo));
  const takeLimit = hasNarrowFilter ? 1000 : 500;

  const attendances = await prisma.attendance.findMany({
    where: {
      student: { dojoId },
      ...(studentId  ? { studentId }  : {}),
      ...(scheduleId ? { scheduleId } : {}),
      ...(type       ? { type }       : {}),
      ...((dateFrom || dateTo) ? {
        markedAt: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
        },
      } : {}),
    },
    select: {
      id: true, type: true, markedAt: true, note: true,
      corrected: true, correctedBy: true, scheduleId: true,
      student: {
        select: {
          id: true, fullName: true, firstName: true, lastName: true,
          beltHistory: {
            orderBy: { changeDate: "desc" },
            take: 1,
            select: { beltColor: true },
          },
        },
      },
      schedule: {
        select: { id: true, name: true, startTime: true, endTime: true },
      },
    },
    orderBy: { markedAt: "desc" },
    take: takeLimit,
  });

  return NextResponse.json(attendances);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { studentId, type, scheduleId, note } = body as {
    studentId: string; type: string; scheduleId?: string; note?: string;
  };

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true, fullName: true, firstName: true, lastName: true, photo: true, active: true,
      beltHistory: {
        orderBy: { changeDate: "desc" },
        take: 1,
        select: { beltColor: true },
      },
    },
  });

  if (!student)        return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  if (!student.active) return NextResponse.json({ error: "Alumno inactivo" },      { status: 403 });

  // Duplicate check: same student + same type in last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recent = await prisma.attendance.findFirst({
    where: { studentId, type, markedAt: { gte: fiveMinutesAgo } },
    select: { id: true },
  });

  const studentOut = {
    id:        student.id,
    firstName: student.firstName,
    lastName:  student.lastName,
    photo:     student.photo,
    belt:      student.beltHistory[0]?.beltColor ?? null,
  };

  if (recent) {
    return NextResponse.json({
      warning:   `Ya se registró ${type === "entry" ? "entrada" : "salida"} hace menos de 5 minutos.`,
      student:   studentOut,
      duplicate: true,
    });
  }

  const attendance = await prisma.attendance.create({
    data: {
      studentId,
      type,
      scheduleId: scheduleId ?? null,
      note:       note       ?? null,
    },
    select: { id: true, type: true, markedAt: true },
  });

  return NextResponse.json({ ok: true, attendance, student: studentOut }, { status: 201 });
}
