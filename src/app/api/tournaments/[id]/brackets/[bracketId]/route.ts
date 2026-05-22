import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; bracketId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as SessionUser & { id?: string; email?: string };
  if (user.role !== "admin" && user.role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id, bracketId } = await params;

  const tournament = await prisma.tournament.findFirst({ where: { id, dojoId } });
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  const bracket = await prisma.tournamentBracket.findFirst({
    where: { id: bracketId, tournamentId: id },
  });
  if (!bracket) return NextResponse.json({ error: "Bracket no encontrado" }, { status: 404 });

  // Admin puede eliminar cualquier bracket NO confirmado; sysadmin puede eliminar cualquiera
  if (user.role !== "sysadmin" && bracket.bracketLocked) {
    return NextResponse.json(
      { error: "No se puede eliminar una llave ya confirmada. Contacta al Sysadmin para reabrirla." },
      { status: 400 },
    );
  }

  try {
    await prisma.$transaction([
      prisma.tournamentParticipant.updateMany({
        where: { tournamentId: id, bracketId },
        data:  { bracketId: null },
      }),
      prisma.tournamentMatch.deleteMany({
        where: { tournamentId: id, bracketId },
      }),
      prisma.tournamentBracket.delete({ where: { id: bracketId } }),
    ]);

    // Audit log cuando sysadmin elimina un bracket no-borrador
    if (user.role === "sysadmin" && bracket.status !== "draft") {
      await logAudit({
        action:    "BRACKET_DELETED",
        userId:    user.id,
        userEmail: user.email,
        dojoId,
        details:   JSON.stringify({
          bracketId,
          bracketName: bracket.name,
          status:      bracket.status,
          tournamentId: id,
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tournaments/[id]/brackets/[bracketId] error:", err);
    return NextResponse.json({ error: "Error interno al eliminar bracket" }, { status: 500 });
  }
}
