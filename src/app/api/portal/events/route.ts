import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendPushToDojoAdminsAsync } from "@/lib/push";
import { createLinkedPayment, cancelLinkedPaymentIfUnpaid } from "@/lib/linkedPayments";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type PortalUser = { role?: string; studentId?: string | null };

async function resolveFamily(studentId: string) {
  const me = await prisma.student.findUnique({
    where:  { id: studentId },
    select: { id: true, fullName: true, familyId: true, dojoId: true },
  });
  if (!me) return null;

  if (!me.familyId) return { me, dojoId: me.dojoId, members: [{ id: me.id, fullName: me.fullName }] };

  const members = await prisma.student.findMany({
    where:   { familyId: me.familyId, dojoId: me.dojoId, active: true },
    select:  { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
  return { me, dojoId: me.dojoId, members };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as PortalUser;
  if (user.role !== "student" || !user.studentId)
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const family = await resolveFamily(user.studentId);
  if (!family) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

  const { me, dojoId, members } = family;
  const memberIds = members.map(m => m.id);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "active";
  const now    = new Date();

  const baseWhere = {
    dojoId,
    endDate: status === "active" ? { gte: now } : { lt: now },
  };
  const baseOrder = { startDate: status === "active" ? ("asc" as const) : ("desc" as const) };

  try {
    const events = await prisma.event.findMany({
      where:   baseWhere,
      orderBy: baseOrder,
      include: {
        rsvps: {
          where:  { studentId: { in: memberIds } },
          select: { studentId: true, status: true },
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
      price:          ev.price ?? 0,
      startDate:      ev.startDate,
      endDate:        ev.endDate,
      attendingCount: ev._count.rsvps,
      memberRsvps:    members.map(m => ({
        studentId: m.id,
        fullName:  m.fullName,
        isMe:      m.id === me.id,
        status:    (ev.rsvps.find(r => r.studentId === m.id)?.status ?? null) as "attending" | "not_attending" | null,
      })),
    }));

    return NextResponse.json(result);
  } catch {
    // Fallback: sin datos de RSVP (cliente Prisma no regenerado)
    const events = await prisma.event.findMany({ where: baseWhere, orderBy: baseOrder });
    const result = events.map(ev => ({
      id:             ev.id,
      title:          ev.title,
      description:    ev.description,
      location:       ev.location,
      imageUrl:       ev.imageUrl,
      price:          ev.price ?? 0,
      startDate:      ev.startDate,
      endDate:        ev.endDate,
      attendingCount: 0,
      memberRsvps:    members.map(m => ({ studentId: m.id, fullName: m.fullName, isMe: m.id === me.id, status: null as null })),
    }));
    return NextResponse.json(result);
  }
}

// POST — alumno o familiar confirma / cancela participación
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as PortalUser;
  if (user.role !== "student" || !user.studentId)
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  try {
    const { eventId, status: rsvpStatus, studentId: targetId, note: rawNote } = await req.json() as {
      eventId:    string;
      status:     "attending" | "not_attending";
      studentId?: string;
      note?:      string;
    };
    const note = typeof rawNote === "string" ? rawNote.trim().slice(0, 500) : null;

    if (!eventId) return NextResponse.json({ error: "eventId requerido" }, { status: 400 });
    if (!["attending", "not_attending"].includes(rsvpStatus))
      return NextResponse.json({ error: "status inválido" }, { status: 400 });

    const family = await resolveFamily(user.studentId);
    if (!family) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

    // Validar que el targetId es el alumno en sesión o un miembro de su familia
    const rsvpStudentId = targetId ?? user.studentId;
    const isMember = family.members.some(m => m.id === rsvpStudentId);
    if (!isMember) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const event = await prisma.event.findFirst({
      where: { id: eventId, dojoId: family.dojoId },
    });
    if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

    const rsvp = await prisma.eventRSVP.upsert({
      where:  { eventId_studentId: { eventId, studentId: rsvpStudentId } },
      create: { eventId, studentId: rsvpStudentId, status: rsvpStatus, note: note ?? null },
      update: { status: rsvpStatus, note: note ?? null },
    });

    // Cargo automático a la cuenta del alumno cuando el evento tiene precio.
    if (rsvpStatus === "attending" && event.price && event.price > 0) {
      const payment = await createLinkedPayment({
        studentId: rsvpStudentId,
        type:      "event",
        amount:    event.price,
        dueDate:   event.startDate,
        note:      `Evento: ${event.title}`,
        eventId,
      });
      if (payment) {
        const ctx = buildAuditCtx(session, req, { dojoId: family.dojoId });
        await logAudit({
          ...ctx,
          action:       "PAYMENT_CREATED_EVENT_CONFIRM",
          module:       AUDIT_MODULE.PAYMENTS,
          resourceType: "Payment",
          resourceId:   payment.id,
          targetId:     rsvpStudentId,
          statusCode:   200,
          details:      JSON.stringify({ eventId, amount: event.price }),
        });
      }
    } else if (rsvpStatus === "not_attending") {
      const result = await cancelLinkedPaymentIfUnpaid({ eventId, studentId: rsvpStudentId });
      if (result.canceled) {
        const ctx = buildAuditCtx(session, req, { dojoId: family.dojoId });
        await logAudit({
          ...ctx,
          action:       "PAYMENT_CANCELED_EVENT_OPTOUT",
          module:       AUDIT_MODULE.PAYMENTS,
          resourceType: "Payment",
          resourceId:   result.payment.id,
          targetId:     rsvpStudentId,
          statusCode:   200,
          details:      JSON.stringify({ eventId, reason: "student changed RSVP to not_attending" }),
        });
      }
    }

    const attendingCount = await prisma.eventRSVP.count({
      where: { eventId, status: "attending" },
    });

    // Notificar a admins del dojo
    const studentName = family.members.find(m => m.id === rsvpStudentId)?.fullName ?? "Un alumno";
    const emoji = rsvpStatus === "attending" ? "✅" : "❌";
    sendPushToDojoAdminsAsync(family.dojoId, {
      title: `${emoji} Confirmación de evento`,
      body:  `${studentName} ${rsvpStatus === "attending" ? "confirmó asistencia" : "no asistirá"} a ${event.title}`,
      url:   "/dashboard/events",
      tag:   `event-rsvp-${eventId}`,
    }, { type: "event_rsvp" });

    return NextResponse.json({ rsvp, attendingCount });
  } catch (err) {
    console.error("POST /api/portal/events error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
