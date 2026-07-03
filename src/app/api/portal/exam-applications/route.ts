import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/portal/exam-applications — postulaciones donde el alumno o sus hermanos están invitados
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; studentId?: string | null };
    if (user.role !== "student" || !user.studentId) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    // Obtener emails del alumno principal para detectar hermanos de familia
    const principal = await prisma.student.findUnique({
      where:  { id: user.studentId },
      select: { dojoId: true, motherEmail: true, fatherEmail: true },
    });
    if (!principal) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

    const parentEmails = [principal.motherEmail?.trim(), principal.fatherEmail?.trim()]
      .filter((e): e is string => !!e);

    // Buscar hermanos activos con mismo correo de padre/madre
    const siblingIds: string[] = [];
    if (parentEmails.length > 0) {
      const siblings = await prisma.student.findMany({
        where: {
          dojoId: principal.dojoId,
          id:     { not: user.studentId },
          active: true,
          OR: [
            ...parentEmails.map(e => ({ motherEmail: e })),
            ...parentEmails.map(e => ({ fatherEmail: e })),
          ],
        },
        select: { id: true },
      });
      siblingIds.push(...siblings.map(s => s.id));
    }

    const allStudentIds = [user.studentId, ...siblingIds];

    const invitees = await prisma.examApplicationInvitee.findMany({
      where: {
        studentId:   { in: allStudentIds },
        application: { status: { in: ["PUBLISHED", "CLOSED", "FINALIZED"] } },
      },
      include: {
        student: { select: { fullName: true } },
        application: {
          select: {
            id:           true,
            title:        true,
            location:     true,
            examDate:     true,
            examTime:     true,
            deadline:     true,
            amount:       true,
            status:       true,
            description:  true,
            imageUrl:     true,
          },
        },
      },
      orderBy: { application: { examDate: "asc" } },
    });

    const result = invitees.map(inv => ({
      application:   inv.application,
      inviteeId:     inv.id,
      studentId:     inv.studentId,
      studentName:   inv.student.fullName,
      beltToPresent: inv.beltToPresent,
      response:      inv.response,
      responseNote:  inv.responseNote,
      respondedAt:   inv.respondedAt,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/portal/exam-applications", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
