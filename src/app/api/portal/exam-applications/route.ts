import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/portal/exam-applications — postulaciones PUBLISHED donde el alumno está invitado
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; studentId?: string | null };
    if (user.role !== "student" || !user.studentId) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const invitees = await prisma.examApplicationInvitee.findMany({
      where: {
        studentId:   user.studentId,
        application: { status: { in: ["PUBLISHED", "CLOSED", "FINALIZED"] } },
      },
      include: {
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
