import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

// GET /api/events/[id]/rsvp — lista de participantes del evento (admin)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;

  // Verify event belongs to this dojo
  const event = await prisma.event.findFirst({
    where: { id, dojoId },
    select: { id: true, title: true },
  });
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const rsvps = await prisma.eventRSVP.findMany({
    where:   { eventId: id },
    include: {
      student: {
        select: {
          id:       true,
          fullName: true,
          photo:    true,
          beltHistory: {
            orderBy: { changeDate: "desc" },
            take:    1,
            select:  { beltColor: true },
          },
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  const attending    = rsvps.filter(r => r.status === "attending");
  const notAttending = rsvps.filter(r => r.status === "not_attending");

  const respondedIds = new Set(rsvps.map(r => r.studentId));
  const pendingStudents = await prisma.student.findMany({
    where:   { dojoId, active: true, id: { notIn: [...respondedIds] } },
    select:  { id: true, fullName: true, photo: true },
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json({
    eventId:       event.id,
    eventTitle:    event.title,
    attending:     attending.map(r => ({
      rsvpId:    r.id,
      studentId: r.student.id,
      fullName:  r.student.fullName,
      photo:     r.student.photo?.startsWith("http") ? r.student.photo : null,
      belt:      r.student.beltHistory[0]?.beltColor ?? null,
      note:      r.note,
      createdAt: r.createdAt,
    })),
    notAttending: notAttending.map(r => ({
      rsvpId:    r.id,
      studentId: r.student.id,
      fullName:  r.student.fullName,
      createdAt: r.createdAt,
    })),
    pending: pendingStudents.map(s => ({
      studentId: s.id,
      fullName:  s.fullName,
      photo:     s.photo?.startsWith("http") ? s.photo : null,
    })),
    attendingCount:    attending.length,
    notAttendingCount: notAttending.length,
    pendingCount:      pendingStudents.length,
  });
}
