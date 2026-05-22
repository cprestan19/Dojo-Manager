import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type Params = { params: Promise<{ id: string; tatamiId: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

/** PUT: asigna qué match está activo en este tatami y actualiza tatamiId del match */
export async function PUT(req: NextRequest, { params }: Params) {
  const { id, tatamiId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const tatami = await prisma.tournamentTatami.findFirst({
    where: { id: tatamiId, tournamentId: id, dojoId },
  });
  if (!tatami) return NextResponse.json({ error: "Tatami no encontrado" }, { status: 404 });

  const { matchId } = await req.json().catch(() => ({})) as { matchId: string | null };

  if (matchId) {
    // Verificar que el match pertenece al torneo
    const match = await prisma.tournamentMatch.findFirst({
      where: { id: matchId, tournamentId: id },
    });
    if (!match) return NextResponse.json({ error: "Match no encontrado en este torneo" }, { status: 404 });

    // Asignar tatami al match y marcarlo como activo en el tatami
    const now = new Date();
    await prisma.$transaction([
      prisma.tournamentMatch.update({ where: { id: matchId }, data: { tatamiId } }),
      prisma.tournamentTatami.update({
        where: { id: tatamiId },
        data:  {
          currentMatchId:        matchId,
          currentMatchStartedAt: null,   // se asigna cuando el juez presiona ▶
          matchTimerRunning:     false,  // el juez lo arranca manualmente
          matchTimerBaseElapsed: 0,      // empieza en 2:00 (base=0 → remaining=120)
        },
      }),
    ]);
  } else {
    await prisma.tournamentTatami.update({
      where: { id: tatamiId },
      data:  {
        currentMatchId:        null,
        currentMatchStartedAt: null,
        matchTimerRunning:     false,
        matchTimerBaseElapsed: 0,
      },
    });
  }

  return NextResponse.json({ ok: true, currentMatchId: matchId ?? null });
}
