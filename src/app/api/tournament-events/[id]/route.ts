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

  // Leer category via SQL directo — el cliente Prisma cacheado puede no conocer el campo
  const rawCategories = await prisma.$queryRaw<{ id: string; category: string | null }[]>`
    SELECT id, category FROM tournament_event_participants WHERE event_id = ${id}
  `;
  const catMap = Object.fromEntries(rawCategories.map(r => [r.id, r.category ?? null]));

  // Cargar solo alumnos ACTIVOS — los inactivos no aparecen en ningún módulo
  const studentIds = event.participants.map(p => p.studentId);
  const students   = await prisma.student.findMany({
    where:  { id: { in: studentIds }, dojoId, active: true },
    select: { id: true, fullName: true, birthDate: true, studentCode: true, photo: true,
              beltHistory: { orderBy: { changeDate: "desc" }, take: 1, select: { beltColor: true } } },
  });
  const sMap = Object.fromEntries(students.map(s => [s.id, s]));

  // Filtrar participantes cuyo alumno está inactivo (sMap solo tiene activos)
  const participants = event.participants
    .filter(p => sMap[p.studentId])   // excluir inactivos
    .map(p => {
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
      category:         catMap[p.id] ?? null,
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
    resultsCount:  participants.filter(p => p.kataResult || p.kumiteResult).length,
    participants,
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const event = await prisma.tournamentEvent.findFirst({
    where:  { id, dojoId },
    select: { id: true, name: true, date: true },
  });
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { name, date, location, notes } = body as {
    name: string; date: string; location: string; notes?: string;
  };

  if (!name?.trim() || !date || !location?.trim())
    return NextResponse.json({ error: "Nombre, fecha y lugar son requeridos" }, { status: 400 });

  const newName = name.trim();
  const newDate = new Date(date);
  const nameChanged = newName !== event.name;
  const dateChanged = newDate.getTime() !== event.date.getTime();

  const updated = await prisma.tournamentEvent.update({
    where: { id },
    data: {
      name:     newName,
      date:     newDate,
      location: location.trim(),
      notes:    notes?.trim() || null,
    },
    select: { id: true, name: true, date: true, location: true, notes: true },
  });

  // Sincronizar fecha y/o nombre en KataCompetition si cambiaron
  if (dateChanged || nameChanged) {
    // Obtener todos los competition IDs vinculados a participantes de este evento
    const participants = await prisma.tournamentEventParticipant.findMany({
      where:  { eventId: id },
      select: { kataCompetitionId: true, kumiteCompetitionId: true },
    });

    const competitionIds = [
      ...participants.map(p => p.kataCompetitionId),
      ...participants.map(p => p.kumiteCompetitionId),
    ].filter((cid): cid is string => !!cid);

    if (competitionIds.length > 0) {
      await prisma.kataCompetition.updateMany({
        where: { id: { in: competitionIds } },
        data: {
          ...(dateChanged ? { date: newDate }       : {}),
          ...(nameChanged ? { tournament: newName } : {}),
        },
      });
    }
  }

  return NextResponse.json({ ok: true, event: { ...updated, date: updated.date.toISOString() } });
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

  // Limpiar KataCompetition vinculadas antes de borrar (evita registros huérfanos en historial)
  const participants = await prisma.tournamentEventParticipant.findMany({
    where:  { eventId: id },
    select: { kataCompetitionId: true, kumiteCompetitionId: true },
  });
  const competitionIds = [
    ...participants.map(p => p.kataCompetitionId),
    ...participants.map(p => p.kumiteCompetitionId),
  ].filter((cid): cid is string => !!cid);

  if (competitionIds.length > 0) {
    await prisma.kataCompetition.deleteMany({ where: { id: { in: competitionIds } } });
  }

  // Cascade borra los participants automáticamente
  await prisma.tournamentEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
