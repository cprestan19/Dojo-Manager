import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/portal/certificates — certificados ISSUED del alumno (o de un
// hermano de su misma familia — ver mismo patrón en /api/portal/attendance)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; studentId?: string | null };
    if (user.role !== "student" || !user.studentId) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const requestedId = new URL(req.url).searchParams.get("studentId"); // "all" | hermano id | null
    const me = await prisma.student.findUnique({
      where:  { id: user.studentId },
      select: { familyId: true, dojoId: true },
    });

    let studentIds: string[];
    if (!requestedId || requestedId === user.studentId) {
      studentIds = [user.studentId];
    } else if (requestedId === "all") {
      studentIds = !me?.familyId ? [user.studentId] : (await prisma.student.findMany({
        where:  { familyId: me.familyId, dojoId: me.dojoId, active: true },
        select: { id: true },
      })).map(s => s.id);
    } else {
      if (!me?.familyId) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
      const sibling = await prisma.student.findFirst({
        where:  { id: requestedId, familyId: me.familyId, dojoId: me.dojoId, active: true },
        select: { id: true },
      });
      if (!sibling) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
      studentIds = [requestedId];
    }

    const certificates = await prisma.generatedCertificate.findMany({
      where: {
        studentId: { in: studentIds },
        status:    "ISSUED",
      },
      orderBy: { issuedDate: "desc" },
      select: {
        id:             true,
        title:          true,
        beltColor:      true,
        issuedDate:     true,
        pdfUrl:         true,
        instructorName: true,
        student:        { select: { id: true, fullName: true } },
      },
    });

    return NextResponse.json(certificates);
  } catch (err) {
    console.error("GET /api/portal/certificates", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
