import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/portal/notifications?since=<ISO_timestamp>
// Returns counts of new content created by the sensei since the given timestamp.
// Used by PortalNav to show notification badges on tabs.

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as { role?: string; studentId?: string | null };
  if (user.role !== "student" || !user.studentId)
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const student = await prisma.student.findUnique({
    where:  { id: user.studentId },
    select: { dojoId: true },
  });
  if (!student) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const sinceParam = req.nextUrl.searchParams.get("since");
  const since      = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const now = new Date();

  const [newEvents, newVideos, newSchedules, pendingPayments, pendingExams] = await Promise.all([
    // Eventos próximos creados después de `since`
    prisma.event.findMany({
      where: {
        dojoId:    student.dojoId,
        createdAt: { gte: since },
        endDate:   { gte: now },
      },
      orderBy: { startDate: "asc" },
      select: { id: true, title: true, startDate: true, createdAt: true },
      take: 10,
    }),

    // Videos de cinta activos agregados después de `since`
    prisma.beltVideo.findMany({
      where: {
        dojoId:    student.dojoId,
        active:    true,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, beltColor: true, createdAt: true },
      take: 10,
    }),

    // Horarios asignados al alumno después de `since`
    prisma.studentSchedule.count({
      where: {
        studentId: user.studentId!,
        removedAt: null,
        assignedAt: { gte: since },
      },
    }),

    // Pagos pendientes o en mora (persistente — sin límite de fecha)
    prisma.payment.count({
      where: {
        studentId: user.studentId!,
        status:    { in: ["pending", "late"] },
      },
    }),

    // Postulaciones de examen pendientes de respuesta (solo publicadas)
    prisma.examApplicationInvitee.count({
      where: {
        studentId:   user.studentId!,
        response:    "PENDING",
        application: { status: "PUBLISHED" },
      },
    }),
  ]);

  return NextResponse.json({
    newEvents:       newEvents.length,
    newVideos:       newVideos.length,
    newSchedules,
    pendingPayments,
    pendingExams,
    // total = contenido nuevo descartable (no incluye pagos pendientes)
    total:           newEvents.length + newVideos.length + newSchedules,
    events:          newEvents,
    videos:          newVideos,
  });
}
