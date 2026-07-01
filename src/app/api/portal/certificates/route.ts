import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/portal/certificates — certificados ISSUED del alumno
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; studentId?: string | null };
    if (user.role !== "student" || !user.studentId) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const certificates = await prisma.generatedCertificate.findMany({
      where: {
        studentId: user.studentId,
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
      },
    });

    return NextResponse.json(certificates);
  } catch (err) {
    console.error("GET /api/portal/certificates", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
