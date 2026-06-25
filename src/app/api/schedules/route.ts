import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role === "student") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const schedules = await prisma.schedule.findMany({
    where: { dojoId },
    include: {
      _count: { select: { attendances: true, studentSchedules: true } },
      studentSchedules: {
        where: { removedAt: null },
        select: {
          student: {
            select: {
              id: true,
              fullName: true,
              beltHistory: {
                orderBy: { changeDate: "desc" },
                take: 1,
                select: { beltColor: true },
              },
              attendances: {
                orderBy: { markedAt: "desc" },
                take: 2,
                select: { type: true, markedAt: true },
              },
            },
          },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json(schedules);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();

    const schedule = await prisma.schedule.create({
      data: {
        dojoId,
        name:        body.name,
        days:        JSON.stringify(body.days),
        startTime:   body.startTime,
        endTime:     body.endTime,
        description: body.description ?? null,
        active:      body.active ?? true,
      },
      include: { _count: { select: { attendances: true } } },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (err) {
    console.error("[schedules POST]", err);
    return NextResponse.json({ error: "Error al crear horario" }, { status: 500 });
  }
}
