/**
 * GET  /api/tournament-events  → lista eventos del dojo activo
 * POST /api/tournament-events  → crea un evento + asigna alumnos confirmados
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const events = await prisma.tournamentEvent.findMany({
    where:   { dojoId },
    orderBy: { date: "desc" },
    include: { _count: { select: { participants: true } } },
  });

  // Contar cuántos llegaron y cuántos tienen resultado
  const ids = events.map(e => e.id);
  const arrived = ids.length > 0 ? await prisma.tournamentEventParticipant.groupBy({
    by:    ["eventId"],
    where: { eventId: { in: ids }, arrived: true },
    _count: { eventId: true },
  }) : [];
  const results = ids.length > 0 ? await prisma.tournamentEventParticipant.groupBy({
    by:    ["eventId"],
    where: { eventId: { in: ids }, kataResult: { not: null } },
    _count: { eventId: true },
  }) : [];

  const arrivedMap  = Object.fromEntries(arrived.map(a  => [a.eventId, a._count.eventId]));
  const resultsMap  = Object.fromEntries(results.map(r  => [r.eventId, r._count.eventId]));

  return NextResponse.json(events.map(e => ({
    id:            e.id,
    name:          e.name,
    date:          e.date.toISOString(),
    location:      e.location,
    notes:         e.notes,
    totalStudents: e._count.participants,
    arrivedCount:  arrivedMap[e.id]  ?? 0,
    resultsCount:  resultsMap[e.id] ?? 0,
  })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { name, date, location, notes, studentIds } = body as {
    name: string; date: string; location: string; notes?: string;
    studentIds: string[];
  };

  if (!name?.trim() || !date || !location?.trim())
    return NextResponse.json({ error: "Nombre, fecha y lugar son requeridos" }, { status: 400 });
  if (!Array.isArray(studentIds) || studentIds.length === 0)
    return NextResponse.json({ error: "Selecciona al menos un alumno" }, { status: 400 });

  // Verificar que todos los studentIds pertenecen a este dojo
  const validStudents = await prisma.student.findMany({
    where:  { id: { in: studentIds }, dojoId },
    select: { id: true },
  });
  const validIds = new Set(validStudents.map(s => s.id));
  const filteredIds = studentIds.filter(id => validIds.has(id));

  if (filteredIds.length === 0)
    return NextResponse.json({ error: "Ningún alumno válido para este dojo" }, { status: 400 });

  const event = await prisma.tournamentEvent.create({
    data: {
      dojoId,
      name:     name.trim(),
      date:     new Date(date),
      location: location.trim(),
      notes:    notes?.trim() || null,
      participants: {
        create: filteredIds.map(studentId => ({ studentId })),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: event.id }, { status: 201 });
}
