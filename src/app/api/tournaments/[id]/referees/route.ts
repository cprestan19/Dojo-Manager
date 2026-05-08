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

  try {
    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

    const { referees } = raw as { referees: string[] };
    if (!Array.isArray(referees)) {
      return NextResponse.json({ error: "referees debe ser un arreglo" }, { status: 400 });
    }

    const trimmed = referees
      .map((r) => r?.toString().trim())
      .filter(Boolean)
      .slice(0, 5);

    await prisma.$transaction([
      prisma.tournamentReferee.deleteMany({ where: { tournamentId: id } }),
      ...(trimmed.length > 0
        ? [
            prisma.tournamentReferee.createMany({
              data: trimmed.map((name, order) => ({
                tournamentId: id,
                name,
                order,
              })),
            }),
          ]
        : []),
    ]);

    const updated = await prisma.tournamentReferee.findMany({
      where: { tournamentId: id },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/tournaments/[id]/referees error:", err);
    return NextResponse.json({ error: "Error interno al actualizar árbitros" }, { status: 500 });
  }
}
