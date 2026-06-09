import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type PortalUser = { role?: string; studentId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as PortalUser;
  if (user.role !== "student" || !user.studentId)
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const student = await prisma.student.findUnique({
    where:  { id: user.studentId },
    select: { dojoId: true },
  });
  if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "active";
  const now    = new Date();

  const baseWhere = {
    dojoId:  student.dojoId,
    endDate: status === "active" ? { gte: now } : { lt: now },
  };
  const baseOrder = { startDate: status === "active" ? ("asc" as const) : ("desc" as const) };

  try {
    // Try with RSVP data first
    const events = await prisma.event.findMany({
      where:   baseWhere,
      orderBy: baseOrder,
      include: {
        rsvps: {
          where:  { studentId: user.studentId! },
          select: { status: true },
        },
        _count: { select: { rsvps: { where: { status: "attending" } } } },
      },
    });

    const result = events.map(ev => ({
      id:             ev.id,
      title:          ev.title,
      description:    ev.description,
      location:       ev.location,
      imageUrl:       ev.imageUrl,
      startDate:      ev.startDate,
      endDate:        ev.endDate,
      myRsvp:         ev.rsvps[0]?.status ?? null,
      attendingCount: ev._count.rsvps,
    }));

    return NextResponse.json(result);
  } catch {
    // Fallback: return events without RSVP (e.g. Prisma client not yet regenerated)
    const events = await prisma.event.findMany({
      where:   baseWhere,
      orderBy: baseOrder,
    });
    const result = events.map(ev => ({
      id:             ev.id,
      title:          ev.title,
      description:    ev.description,
      location:       ev.location,
      imageUrl:       ev.imageUrl,
      startDate:      ev.startDate,
      endDate:        ev.endDate,
      myRsvp:         null,
      attendingCount: 0,
    }));
    return NextResponse.json(result);
  }
}

// POST — alumno confirma o cancela su participación
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as PortalUser;
  if (user.role !== "student" || !user.studentId)
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  try {
    const { eventId, status: rsvpStatus, note } = await req.json() as {
      eventId: string;
      status:  "attending" | "not_attending";
      note?:   string;
    };

    if (!eventId) return NextResponse.json({ error: "eventId requerido" }, { status: 400 });
    if (!["attending", "not_attending"].includes(rsvpStatus))
      return NextResponse.json({ error: "status inválido" }, { status: 400 });

    // Verify event belongs to student's dojo
    const student = await prisma.student.findUnique({
      where:  { id: user.studentId },
      select: { dojoId: true },
    });
    if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    const event = await prisma.event.findFirst({
      where: { id: eventId, dojoId: student.dojoId },
    });
    if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

    const rsvp = await prisma.eventRSVP.upsert({
      where:  { eventId_studentId: { eventId, studentId: user.studentId } },
      create: { eventId, studentId: user.studentId!, status: rsvpStatus, note: note ?? null },
      update: { status: rsvpStatus, note: note ?? null },
    });

    // Return updated count
    const attendingCount = await prisma.eventRSVP.count({
      where: { eventId, status: "attending" },
    });

    return NextResponse.json({ rsvp, attendingCount });
  } catch (err) {
    console.error("POST /api/portal/events error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
