import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as { role?: string; studentId?: string | null };
  if (user.role !== "student" || !user.studentId)
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  // Obtener dojoId del alumno
  const student = await prisma.student.findUnique({
    where:  { id: user.studentId },
    select: { dojoId: true },
  });
  if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "active";
  const now    = new Date();

  const events = await prisma.event.findMany({
    where: {
      dojoId:  student.dojoId,
      endDate: status === "active" ? { gte: now } : { lt: now },
    },
    orderBy: { startDate: status === "active" ? "asc" : "desc" },
  });

  return NextResponse.json(events);
}
