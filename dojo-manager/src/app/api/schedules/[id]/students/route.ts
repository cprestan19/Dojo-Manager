import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { dojoId?: string; role?: string };

// PUT /api/schedules/[id]/students
// Body: { studentIds: string[] }
// Syncs active assignments. All cross-dojo contamination is blocked at the DB layer:
//   - schedule ownership verified via dojoId
//   - studentIds are filtered to only those belonging to the same dojo before assignment
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId, role } = session.user as SessionUser;
  if (!dojoId || role === "user") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id: scheduleId } = await params;
  const body = await req.json() as { studentIds?: string[] };
  const requestedIds: string[] = Array.isArray(body.studentIds) ? body.studentIds : [];

  // Verify the schedule belongs to this dojo
  const schedule = await prisma.schedule.findFirst({ where: { id: scheduleId, dojoId } });
  if (!schedule) return NextResponse.json({ error: "Horario no encontrado" }, { status: 404 });

  // Enforce dojo isolation: only assign students that actually belong to this dojo.
  // Any IDs from other dojos are silently discarded — no error, no cross-dojo data.
  const validStudents = await prisma.student.findMany({
    where: { id: { in: requestedIds }, dojoId, active: true },
    select: { id: true },
  });
  const studentIds = validStudents.map(s => s.id);

  const now = new Date();

  // Current active assignments for this schedule
  const current = await prisma.studentSchedule.findMany({
    where: { scheduleId, removedAt: null },
    select: { id: true, studentId: true },
  });

  const currentIds = current.map(c => c.studentId);
  const toAdd      = studentIds.filter(id => !currentIds.includes(id));
  const toRemove   = current.filter(c => !studentIds.includes(c.studentId));

  await prisma.$transaction([
    ...toRemove.map(r =>
      prisma.studentSchedule.update({ where: { id: r.id }, data: { removedAt: now } })
    ),
    ...(toAdd.length > 0
      ? [prisma.studentSchedule.createMany({
          data: toAdd.map(studentId => ({ studentId, scheduleId })),
          skipDuplicates: true,
        })]
      : []
    ),
  ]);

  return NextResponse.json({ ok: true });
}
