import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;

  const tournament = await prisma.tournament.findFirst({ where: { id, dojoId } });
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  if (tournament.bracketLocked) {
    return NextResponse.json(
      { error: "No se pueden modificar participantes con el bracket confirmado" },
      { status: 400 },
    );
  }

  try {
    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

    const { studentIds } = raw as { studentIds: string[] };
    if (!Array.isArray(studentIds)) {
      return NextResponse.json({ error: "studentIds debe ser un arreglo" }, { status: 400 });
    }

    // Verify all students belong to this dojo — prevent cross-dojo contamination
    if (studentIds.length > 0) {
      const validCount = await prisma.student.count({
        where: { id: { in: studentIds }, dojoId },
      });
      if (validCount !== studentIds.length) {
        return NextResponse.json({ error: "Uno o más alumnos no pertenecen a este dojo" }, { status: 400 });
      }
    }

    // Replace participants in a transaction
    await prisma.$transaction([
      prisma.tournamentParticipant.deleteMany({ where: { tournamentId: id } }),
      ...(studentIds.length > 0
        ? [
            prisma.tournamentParticipant.createMany({
              data: studentIds.map((studentId) => ({
                tournamentId: id,
                studentId,
                seed: 0,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
      prisma.tournament.update({
        where: { id },
        data: { status: "draft" },
      }),
    ]);

    const updated = await prisma.tournamentParticipant.findMany({
      where: { tournamentId: id },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            birthDate: true,
            beltHistory: {
              take: 1,
              orderBy: { changeDate: "desc" },
              select: { beltColor: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/tournaments/[id]/participants error:", err);
    return NextResponse.json({ error: "Error interno al actualizar participantes" }, { status: 500 });
  }
}
