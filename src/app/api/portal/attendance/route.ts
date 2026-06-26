import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user    = session?.user as { role?: string; studentId?: string | null } | undefined;

  if (!user || user.role !== "student" || !user.studentId)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateFrom      = searchParams.get("dateFrom");
  const dateTo        = searchParams.get("dateTo");
  const requestedId   = searchParams.get("studentId"); // "all" | sibling id | null

  // Fetch session student's family context
  const me = await prisma.student.findUnique({
    where:  { id: user.studentId },
    select: { familyId: true, dojoId: true },
  });
  if (!me) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

  // Resolve which student IDs to query
  let studentIds: string[];

  if (!requestedId || requestedId === user.studentId) {
    // Default: solo el alumno en sesión
    studentIds = [user.studentId];
  } else if (requestedId === "all") {
    // Todos los miembros de la familia
    if (!me.familyId) {
      studentIds = [user.studentId];
    } else {
      const siblings = await prisma.student.findMany({
        where:  { familyId: me.familyId, dojoId: me.dojoId, active: true },
        select: { id: true },
      });
      studentIds = siblings.map(s => s.id);
    }
  } else {
    // Hermano específico — validar que pertenece a la misma familia
    if (!me.familyId) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    const sibling = await prisma.student.findFirst({
      where:  { id: requestedId, familyId: me.familyId, dojoId: me.dojoId, active: true },
      select: { id: true },
    });
    if (!sibling) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    studentIds = [requestedId];
  }

  const rows = await prisma.attendance.findMany({
    where: {
      studentId: { in: studentIds },
      ...((dateFrom || dateTo) ? {
        markedAt: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
        },
      } : {}),
    },
    select: {
      id: true, type: true, markedAt: true, corrected: true,
      student:  { select: { id: true, fullName: true } },
      schedule: { select: { id: true, name: true } },
    },
    orderBy: { markedAt: "desc" },
    take: 500,
  });

  return NextResponse.json(rows);
}
