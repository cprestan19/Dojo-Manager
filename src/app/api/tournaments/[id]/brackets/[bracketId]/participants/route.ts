import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; bracketId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id, bracketId } = await params;

  const tournament = await prisma.tournament.findFirst({ where: { id, dojoId } });
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  const bracket = await prisma.tournamentBracket.findFirst({
    where: { id: bracketId, tournamentId: id },
  });
  if (!bracket) return NextResponse.json({ error: "Bracket no encontrado" }, { status: 404 });

  if (bracket.bracketLocked) {
    return NextResponse.json(
      { error: "No se pueden modificar participantes de un bracket confirmado" },
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

    // Conflicto solo si el alumno ya está en OTRO bracket del MISMO tipo
    // (Kumite y Kata son independientes — un alumno puede estar en ambos)
    if (studentIds.length > 0) {
      const sameBracketType = await prisma.tournamentBracket.findMany({
        where: { tournamentId: id, type: bracket.type, id: { not: bracketId } },
        select: { id: true, name: true },
      });
      const sameTypeIds = sameBracketType.map(b => b.id);

      if (sameTypeIds.length > 0) {
        const conflicting = await prisma.tournamentParticipant.findMany({
          where: {
            bracketId:  { in: sameTypeIds },
            studentId:  { in: studentIds },
          },
          include: { student: { select: { fullName: true } } },
        });

        if (conflicting.length > 0) {
          const conflicts = conflicting.map(p => p.student?.fullName ?? "?");
          return NextResponse.json(
            {
              error: `${conflicts.length} alumno(s) ya están en otro bracket de ${bracket.type === "kumite" ? "Kumite" : "Kata"}`,
              conflicts,
            },
            { status: 409 },
          );
        }
      }
    }

    // Un alumno puede ya tener código QR de acreditación de otra fila (otro bracket)
    // en este mismo torneo — reutilizarlo en vez de generar uno nuevo por bracket,
    // así un solo scan en la entrada acredita todas sus categorías.
    const existingCodes = studentIds.length > 0
      ? await prisma.tournamentParticipant.findMany({
          where:  { tournamentId: id, studentId: { in: studentIds }, qrCode: { not: null } },
          select: { studentId: true, qrCode: true },
        })
      : [];
    const codeByStudent = new Map(existingCodes.map(p => [p.studentId as string, p.qrCode as string]));
    const genCode = () => `${id.slice(-6).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;

    // Unlink current participants from this bracket (set bracketId = null)
    // Then link the new ones (create if not exist, update bracketId if they are already tournament participants)
    await prisma.$transaction(async (tx) => {
      // Eliminar participantes actuales de ESTE bracket (solo alumnos internos —
      // los atletas externos se gestionan aparte desde Inscripciones y no deben perderse aquí)
      await tx.tournamentParticipant.deleteMany({
        where: { bracketId, studentId: { not: null } },
      });

      // Eliminar matches de este bracket
      await tx.tournamentMatch.deleteMany({ where: { tournamentId: id, bracketId } });

      // Crear nuevos participantes para este bracket (uno por alumno)
      if (studentIds.length > 0) {
        await tx.tournamentParticipant.createMany({
          data: studentIds.map(studentId => ({
            tournamentId: id,
            studentId,
            bracketId,
            seed: 0,
            qrCode: codeByStudent.get(studentId) ?? genCode(),
          })),
          skipDuplicates: true,
        });
      }

      // Reset bracket status to draft since participants changed
      await tx.tournamentBracket.update({
        where: { id: bracketId },
        data: { status: "draft" },
      });
    });

    const updated = await prisma.tournamentParticipant.findMany({
      where: { tournamentId: id, bracketId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            birthDate: true,
            photo: true,
            beltHistory: {
              take: 1,
              orderBy: { changeDate: "desc" },
              select: { beltColor: true },
            },
          },
        },
        externalAthlete: {
          select: {
            id: true, firstName: true, lastName: true, birthDate: true,
            photoUrl: true, beltColor: true,
            externalClub: { select: { clubName: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/tournaments/[id]/brackets/[bracketId]/participants error:", err);
    return NextResponse.json(
      { error: "Error interno al actualizar participantes del bracket" },
      { status: 500 },
    );
  }
}
