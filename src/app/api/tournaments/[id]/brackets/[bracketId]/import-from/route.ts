import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; bracketId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id, bracketId } = await params;

  try {
    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

    const { sourceBracketId } = raw as { sourceBracketId: string };
    if (!sourceBracketId)
      return NextResponse.json({ error: "sourceBracketId es requerido" }, { status: 400 });

    const tournament = await prisma.tournament.findFirst({ where: { id, dojoId } });
    if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

    const destBracket = await prisma.tournamentBracket.findFirst({
      where: { id: bracketId, tournamentId: id },
    });
    if (!destBracket) return NextResponse.json({ error: "Bracket destino no encontrado" }, { status: 404 });

    if (destBracket.bracketLocked)
      return NextResponse.json({ error: "El bracket está confirmado y no se puede modificar" }, { status: 400 });

    const sourceBracket = await prisma.tournamentBracket.findFirst({
      where: { id: sourceBracketId, tournamentId: id },
    });
    if (!sourceBracket) return NextResponse.json({ error: "Bracket origen no encontrado" }, { status: 404 });

    // Verificar que origen y destino son tipos diferentes (kumite → kata o kata → kumite)
    if (sourceBracket.type === destBracket.type)
      return NextResponse.json({ error: "El bracket origen y destino son del mismo tipo" }, { status: 400 });

    // Obtener alumnos del bracket origen
    const sourceParticipants = await prisma.tournamentParticipant.findMany({
      where: { bracketId: sourceBracketId },
      select: { studentId: true },
    });

    if (sourceParticipants.length === 0)
      return NextResponse.json({ error: "El bracket origen no tiene participantes" }, { status: 400 });

    const studentIds = sourceParticipants.map(p => p.studentId);

    // Importar al bracket destino (eliminar los actuales y crear nuevos)
    await prisma.$transaction(async (tx) => {
      await tx.tournamentParticipant.deleteMany({ where: { bracketId } });
      await tx.tournamentMatch.deleteMany({ where: { tournamentId: id, bracketId } });
      await tx.tournamentParticipant.createMany({
        data: studentIds.map(studentId => ({
          tournamentId: id,
          studentId,
          bracketId,
          seed: 0,
        })),
        skipDuplicates: true,
      });
      await tx.tournamentBracket.update({
        where: { id: bracketId },
        data: { status: "draft" },
      });
    });

    return NextResponse.json({ ok: true, imported: studentIds.length });
  } catch (err) {
    console.error("POST /import-from error:", err);
    return NextResponse.json({ error: "Error al importar participantes" }, { status: 500 });
  }
}
