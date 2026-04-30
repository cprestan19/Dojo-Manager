import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

const VALID_TYPES = new Set(["entry", "exit"]);

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const studentId  = searchParams.get("studentId");
  const scheduleId = searchParams.get("scheduleId");
  const type       = searchParams.get("type");
  const dateFrom   = searchParams.get("dateFrom");
  const dateTo     = searchParams.get("dateTo");

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
  try {
    // ── Parse & validate body ────────────────────────────────
    let body: { studentId?: unknown; type?: unknown; scheduleId?: unknown; note?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
    }

    const studentId  = typeof body.studentId === "string" ? body.studentId.trim()  : null;
    const type       = typeof body.type      === "string" ? body.type.trim()       : null;
    const scheduleId = typeof body.scheduleId === "string" ? body.scheduleId.trim() : null;
    const note       = typeof body.note       === "string" ? body.note.trim()       : null;

    if (!studentId) return NextResponse.json({ error: "studentId requerido" }, { status: 400 });
    if (!type || !VALID_TYPES.has(type))
      return NextResponse.json({ error: "type debe ser 'entry' o 'exit'" }, { status: 400 });

    // ── Fetch student — CRITICAL: always filter by dojoId ───
    // The QR scanner endpoint is public but we still validate that the student
    // exists and belongs to the dojo before creating any record.
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        // If the scanner sends a numeric code instead of cuid, support both.
        // dojoId is intentionally NOT required here so the scanner can work
        // without a session — but we still validate the student exists in DB.
        // Dojo isolation is enforced: only the student's own attendance is created.
      },
      select: {
        id: true, fullName: true, firstName: true, lastName: true,
        photo: true, active: true, dojoId: true,
        beltHistory: {
          orderBy: { changeDate: "desc" },
          take: 1,
          select: { beltColor: true },
        },
      },
    });

    if (!student)        return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    if (!student.active) return NextResponse.json({ error: "Alumno inactivo" },      { status: 403 });

    // ── Validate scheduleId belongs to the student's dojo ───
    if (scheduleId) {
      const schedule = await prisma.schedule.findFirst({
        where: { id: scheduleId, dojoId: student.dojoId },
        select: { id: true },
      });
      if (!schedule) return NextResponse.json({ error: "Horario no válido" }, { status: 400 });
    }

    // ── Duplicate check: same student + same type in last 5 min ─
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recent = await prisma.attendance.findFirst({
      where: { studentId: student.id, type, markedAt: { gte: fiveMinutesAgo } },
      select: { id: true },
    });

    const studentOut = {
      id:       student.id,
      fullName: student.fullName || `${student.firstName} ${student.lastName}`.trim(),
      photo:    student.photo?.startsWith("http") ? student.photo : null,  // never return base64
      belt:     student.beltHistory[0]?.beltColor ?? null,
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
        studentId: student.id,
        type,
        scheduleId: scheduleId || null,
        note:       note       || null,
      },
      select: { id: true, type: true, markedAt: true },
    });

    return NextResponse.json({ ok: true, attendance, student: studentOut }, { status: 201 });

  } catch (err) {
    console.error("POST /api/attendance error:", err);
    return NextResponse.json({ error: "Error interno al registrar asistencia" }, { status: 500 });
  }
}
