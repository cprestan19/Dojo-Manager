import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { sendPushToDojoStudentsAsync } from "@/lib/push";
import { computeSyncDiff } from "@/lib/tournament-event-sync";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "active";
  const now    = new Date();

  const events = await prisma.event.findMany({
    where: {
      dojoId,
      endDate: status === "active" ? { gte: now } : { lt: now },
    },
    orderBy: { startDate: status === "active" ? "asc" : "desc" },
  });

  // Vincula cada evento con su lista de asistencia (TournamentEvent) si ya fue generada,
  // y calcula cuántos cambios de RSVP están pendientes de sincronizar (sin aplicarlos).
  const eventIds = events.map(e => e.id);
  const links = eventIds.length > 0
    ? await prisma.tournamentEvent.findMany({
        where:  { dojoId, sourceEventId: { in: eventIds } },
        select: { id: true, sourceEventId: true },
      })
    : [];
  const linkMap = Object.fromEntries(links.map(l => [l.sourceEventId as string, l.id]));
  const tournamentEventIds = links.map(l => l.id);

  const [rsvpRows, activeStudents, participantRows] = await Promise.all([
    eventIds.length > 0
      ? prisma.eventRSVP.findMany({
          where:  { eventId: { in: eventIds }, status: "attending" },
          select: { eventId: true, studentId: true },
        })
      : Promise.resolve([]),
    prisma.student.findMany({ where: { dojoId, active: true }, select: { id: true } }),
    tournamentEventIds.length > 0
      ? prisma.tournamentEventParticipant.findMany({
          where:  { eventId: { in: tournamentEventIds } },
          select: {
            id: true, eventId: true, studentId: true, arrived: true, kataResult: true, kumiteResult: true,
            kataCompetitionId: true, kumiteCompetitionId: true, confirmed: true, optedOut: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const activeStudentIds = new Set(activeStudents.map(s => s.id));

  return NextResponse.json(events.map(e => {
    const teId = linkMap[e.id] ?? null;
    let pendingSyncCount = 0;
    if (teId) {
      const confirmedIds = new Set(
        rsvpRows.filter(r => r.eventId === e.id && activeStudentIds.has(r.studentId)).map(r => r.studentId)
      );
      const currentParticipants = participantRows.filter(p => p.eventId === teId);
      const { toAdd, toRemove } = computeSyncDiff(confirmedIds, currentParticipants);
      pendingSyncCount = toAdd.length + toRemove.length;
    }
    return { ...e, tournamentEventId: teId, pendingSyncCount };
  }));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  try {
    const { title, description, location, imageUrl, startDate, endDate } = await req.json();

    if (!title?.trim())
      return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
    if (!startDate || !endDate)
      return NextResponse.json({ error: "Las fechas son requeridas" }, { status: 400 });
    if (new Date(endDate) <= new Date(startDate))
      return NextResponse.json({ error: "La fecha de fin debe ser posterior al inicio" }, { status: 400 });

    const event = await prisma.event.create({
      data: {
        dojoId,
        title:       title.trim(),
        description: description?.trim() || null,
        location:    location?.trim()    || null,
        imageUrl:    imageUrl            || null,
        startDate:   new Date(startDate),
        endDate:     new Date(endDate),
      },
    });

    // Push a los alumnos del dojo — fire-and-forget
    const pushSettings = await prisma.pushSettings.findUnique({ where: { dojoId }, select: { enabled: true, notifyNewEvent: true } }).catch(() => null);
    if (pushSettings?.enabled && pushSettings.notifyNewEvent) {
      const startStr = event.startDate.toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "numeric", month: "long" });
      sendPushToDojoStudentsAsync(dojoId, {
        title: "📅 Nuevo evento en el dojo",
        body:  `"${event.title}" — ${startStr}${event.location ? ` en ${event.location}` : ""}.`,
        url:   "/portal/events",
        tag:   "new-event",
      }, { type: "event" });
    }

    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    console.error("[events POST]", err);
    return NextResponse.json({ error: "Error al crear evento" }, { status: 500 });
  }
}
