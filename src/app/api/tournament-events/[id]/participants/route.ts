/**
 * GET  /api/tournament-events/[id]/participants?search=<term>
 *   Busca alumnos activos del dojo que AÚN NO están inscritos en el evento.
 *   Usado por el modal "Agregar alumno" para inscribir a último momento.
 *
 * POST /api/tournament-events/[id]/participants
 *   Body: { studentId: string }
 *   Inscribe a un alumno al evento (crea TournamentEventParticipant).
 *   La constraint @@unique([eventId, studentId]) evita duplicados en BD.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type Params      = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

// ── GET: buscar alumnos no inscritos ────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: eventId } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sDojoId } = session.user as SessionUser;
    const dojoId = getEffectiveDojoId(role, sDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    // Verificar que el evento pertenece al dojo
    const event = await prisma.tournamentEvent.findFirst({
      where:  { id: eventId, dojoId },
      select: { id: true },
    });
    if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

    const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";
    if (search.length < 2) return NextResponse.json([]);

    // IDs ya inscritos en este evento
    const enrolled = await prisma.tournamentEventParticipant.findMany({
      where:  { eventId },
      select: { studentId: true },
    });
    const enrolledIds = enrolled.map(e => e.studentId);

    // Buscar por nombre o código numérico
    const code = /^\d+$/.test(search) ? parseInt(search, 10) : null;

    const students = await prisma.student.findMany({
      where: {
        dojoId,
        active: true,
        id:     { notIn: enrolledIds.length > 0 ? enrolledIds : ["__none__"] },
        OR: code
          ? [{ studentCode: code }]
          : [
              { fullName:  { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName:  { contains: search, mode: "insensitive" } },
            ],
      },
      select: {
        id: true, fullName: true, studentCode: true,
        beltHistory: { orderBy: { changeDate: "desc" }, take: 1, select: { beltColor: true } },
      },
      take: 10,
      orderBy: { fullName: "asc" },
    });

    return NextResponse.json(students.map(s => ({
      id:          s.id,
      fullName:    s.fullName,
      studentCode: s.studentCode ?? null,
      belt:        s.beltHistory[0]?.beltColor ?? null,
    })));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    console.error("[GET participants/search]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── POST: inscribir alumno ──────────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: eventId } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sDojoId } = session.user as SessionUser;
    const dojoId = getEffectiveDojoId(role, sDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    // Verificar que el evento pertenece al dojo
    const event = await prisma.tournamentEvent.findFirst({
      where:  { id: eventId, dojoId },
      select: { id: true, name: true },
    });
    if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

    const body = await req.json().catch(() => ({})) as { studentId?: string };
    const studentId = body.studentId?.trim();
    if (!studentId) return NextResponse.json({ error: "studentId requerido" }, { status: 400 });

    // Verificar que el alumno está activo y pertenece a este dojo
    const student = await prisma.student.findFirst({
      where:  { id: studentId, dojoId, active: true },
      select: {
        id: true, fullName: true, studentCode: true,
        beltHistory: { orderBy: { changeDate: "desc" }, take: 1, select: { beltColor: true } },
      },
    });
    if (!student) return NextResponse.json({ error: "Alumno no encontrado, inactivo o no pertenece a este dojo" }, { status: 404 });

    // Verificar si ya está inscrito
    const existing = await prisma.tournamentEventParticipant.findUnique({
      where: { eventId_studentId: { eventId, studentId } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ error: "El alumno ya está inscrito en este evento", alreadyEnrolled: true }, { status: 409 });

    // Inscribir
    const participant = await prisma.tournamentEventParticipant.create({
      data:   { eventId, studentId },
      select: { id: true },
    });

    return NextResponse.json({
      ok:          true,
      participant: {
        id:          participant.id,
        fullName:    student.fullName,
        studentCode: student.studentCode ?? null,
        belt:        student.beltHistory[0]?.beltColor ?? null,
      },
    }, { status: 201 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    console.error("[POST participants]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
