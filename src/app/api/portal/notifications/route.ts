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

  const [newEvents, newVideos] = await Promise.all([
    // New upcoming events created after `since`
    prisma.event.findMany({
      where: {
        dojoId:    student.dojoId,
        createdAt: { gte: since },
        endDate:   { gte: now },   // still active
      },
      orderBy: { startDate: "asc" },
      select: { id: true, title: true, startDate: true, createdAt: true },
      take: 10,
    }),

    // New belt videos added after `since`
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
  ]);

  return NextResponse.json({
    newEvents:  newEvents.length,
    newVideos:  newVideos.length,
    total:      newEvents.length + newVideos.length,
    events:     newEvents,
    videos:     newVideos,
  });
}
