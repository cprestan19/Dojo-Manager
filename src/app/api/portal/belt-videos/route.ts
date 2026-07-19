import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string; dojoId?: string | null; studentId?: string | null };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId, studentId } = session.user as SessionUser;
  if (role !== "student") return NextResponse.json({ error: "Solo alumnos" }, { status: 403 });
  if (!dojoId || !studentId) return NextResponse.json({ error: "Sesión inválida" }, { status: 403 });

  try {
    // Get the unique belt colors this student has earned
    const beltRows = await prisma.beltHistory.findMany({
      where:  { studentId },
      select: { beltColor: true },
      distinct: ["beltColor"],
    });

    const earnedBelts = beltRows.map(r => r.beltColor);

    // Videos con lista de alumnos específica (visibleToStudentIds) pueden ser
    // visibles para este alumno aunque no tenga ninguna cinta registrada aún
    // (ej. katas de competencia asignadas de forma puntual), así que no se
    // puede cortar temprano solo por earnedBelts vacío como antes.
    const active = await prisma.beltVideo.findMany({
      where: { dojoId, active: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, beltColor: true, title: true, description: true,
        videoUrl: true, tachiKataUrl: true, order: true,
        visibleToStudentIds: true,
      },
    });

    // Un video con allowlist definida SOLO es visible para los alumnos de esa
    // lista (sin importar su cinta). Sin allowlist: regla normal por cinta.
    const videos = active
      .filter(v => {
        const allowlist = Array.isArray(v.visibleToStudentIds) ? v.visibleToStudentIds as string[] : null;
        if (allowlist && allowlist.length > 0) return allowlist.includes(studentId);
        return earnedBelts.includes(v.beltColor);
      })
      .map(({ visibleToStudentIds: _omit, ...v }) => v);

    return NextResponse.json({ videos, earnedBelts });
  } catch (err) {
    console.error("Error cargando videos del portal:", err);
    return NextResponse.json({ error: "Error al cargar videos" }, { status: 500 });
  }
}
