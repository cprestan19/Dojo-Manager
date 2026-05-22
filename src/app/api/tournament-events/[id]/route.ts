/**
 * GET    /api/tournament-events/[id]  → detalle con participantes
 * DELETE /api/tournament-events/[id]  → eliminar evento
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { calcAge } from "@/lib/tournament-events";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const event = await prisma.tournamentEvent.findFirst({
    where:   { id, dojoId },
    include: { participants: { orderBy: { createdAt: "asc" } } },
  });
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  // Cargar datos de los alumnos en una query
  const studentIds = event.participants.map(p => p.studentId);
  const students   = await prisma.student.findMany({
    where:  { id: { in: studentIds }, dojoId },
    select: { id: true, fullName: true, birthDate: true, studentCode: true, photo: true,
              beltHistory: { orderBy: { changeDate: "desc" }, take: 1, select: { beltColor: true } } },
  });
  const sMap = Object.fromEntries(students.map(s => [s.id, s]));

  const participants = event.participants.map(p => {
    const s = sMap[p.studentId];
    return {
      participantId:    p.id,
      studentId:        p.studentId,
      fullName:         s?.fullName         ?? "Alumno",
      belt:             s?.beltHistory[0]?.beltColor ?? "",
      photo:            s?.photo?.startsWith("http") ? s.photo : null,
      studentCode:      s?.studentCode      ?? null,
      birthDate:        s?.birthDate?.toISOString() ?? "",
      age:              s?.birthDate ? calcAge(s.birthDate.toISOString()) : 0,
      arrived:          p.arrived,
      arrivedAt:        p.arrivedAt?.toISOString() ?? null,
      scannedBy:        p.scannedBy,
      kataName:         p.kataName,
      kataResult:       p.kataResult,
      kumiteResult:     p.kumiteResult,
      competitionNotes: p.competitionNotes,
    };
  });

  // Ordenar: llegaron primero, luego alfabético
  participants.sort((a, b) => {
    if (a.arrived !== b.arrived) return a.arrived ? -1 : 1;
    return a.fullName.localeCompare(b.fullName);
  });

  return NextResponse.json({
    id:            event.id,
    name:          event.name,
    date:          event.date.toISOString(),
    location:      event.location,
    notes:         event.notes,
    totalStudents: participants.length,
    arrivedCount:  participants.filter(p => p.arrived).length,
    resultsCount:  participants.filter(p => p.kataResult).length,
    participants,
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const event = await prisma.tournamentEvent.findFirst({ where: { id, dojoId }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  await prisma.tournamentEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
