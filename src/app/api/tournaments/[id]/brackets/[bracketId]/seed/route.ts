/**
 * PUT /api/tournaments/[id]/brackets/[bracketId]/seed
 * Siembra manual: guarda el orden explícito de los participantes de un
 * bracket. body: { order: string[] } — IDs de TournamentParticipant en el
 * orden deseado (posición 1 = primer sembrado, etc). No genera la llave —
 * solo fija los seeds que luego usa POST .../bracket (distribución WKF:
 * seed 1 y 2 en cuartos opuestos, 3 y 4 en semifinales).
 */
import { NextRequest, NextResponse } from "next/server";
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

  const bracket = await prisma.tournamentBracket.findFirst({ where: { id: bracketId, tournamentId: id } });
  if (!bracket) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  if (bracket.bracketLocked) {
    return NextResponse.json({ error: "La categoría está confirmada y no se puede modificar" }, { status: 400 });
  }

  const body = await req.json().catch(() => null) as { order?: string[] } | null;
  if (!body?.order || !Array.isArray(body.order)) {
    return NextResponse.json({ error: "order debe ser un arreglo de IDs" }, { status: 400 });
  }

  // Verificar que todos los IDs pertenecen a este bracket
  const current = await prisma.tournamentParticipant.findMany({
    where:  { bracketId, tournamentId: id },
    select: { id: true },
  });
  const validIds = new Set(current.map(p => p.id));
  if (body.order.length !== current.length || !body.order.every(pid => validIds.has(pid))) {
    return NextResponse.json({ error: "El orden no coincide con los participantes actuales del bracket" }, { status: 400 });
  }

  await prisma.$transaction(
    body.order.map((participantId, i) =>
      prisma.tournamentParticipant.update({ where: { id: participantId }, data: { seed: i + 1 } }),
    ),
  );

  return NextResponse.json({ ok: true });
}
