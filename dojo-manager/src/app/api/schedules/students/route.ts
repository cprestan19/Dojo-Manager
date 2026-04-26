import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { dojoId?: string; role?: string };

// GET /api/schedules/students
// Returns all active students that belong to the session's dojo (dojoId from JWT — never from client).
// The optional ?scheduleId param is accepted but ignored server-side;
// the client uses it only to decide which students to pre-select in the UI.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  if (!dojoId) return NextResponse.json({ error: "Sin dojo" }, { status: 403 });

  const students = await prisma.student.findMany({
    where: { dojoId, active: true },
    select: {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      beltHistory: {
        orderBy: { changeDate: "desc" },
        take: 1,
        select: { beltColor: true },
      },
      studentSchedules: {
        where: { removedAt: null },
        select: {
          scheduleId: true,
          schedule: { select: { id: true, name: true } },
        },
        take: 1,
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const now = new Date();
  const result = students.map(s => {
    const ageMs   = now.getTime() - new Date(s.birthDate).getTime();
    const age     = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365.25));
    const belt    = s.beltHistory[0]?.beltColor ?? "blanco";
    const current = s.studentSchedules[0] ?? null;
    const fullName = s.fullName || `${s.firstName} ${s.lastName}`.trim();
    return {
      id:              s.id,
      fullName,
      firstName:       s.firstName,
      lastName:        s.lastName,
      age,
      belt,
      currentScheduleId:   current?.scheduleId ?? null,
      currentScheduleName: current?.schedule.name ?? null,
    };
  });

  return NextResponse.json(result);
}
