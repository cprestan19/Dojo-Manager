import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { sendPushToDojoStudentsAsync } from "@/lib/push";

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

  return NextResponse.json(events);
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
