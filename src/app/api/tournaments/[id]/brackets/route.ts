import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;

  const tournament = await prisma.tournament.findFirst({ where: { id, dojoId } });
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  try {
    const brackets = await prisma.tournamentBracket.findMany({
      where: { tournamentId: id },
      orderBy: { order: "asc" },
      include: { _count: { select: { participants: true, matches: true } } },
    });
    return NextResponse.json(brackets);
  } catch (err) {
    console.error("GET /api/tournaments/[id]/brackets error:", err);
    return NextResponse.json({ error: "Error interno al cargar brackets" }, { status: 500 });
  }
}

export async function POST(
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

  if (tournament.status === "completed") {
    return NextResponse.json(
      { error: "No se pueden crear brackets en un torneo completado" },
      { status: 400 },
    );
  }

  try {
    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

    const { name, order, gender, type } = raw as { name?: string; order?: number; gender?: string | null; type?: string };
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "El nombre del bracket es requerido" }, { status: 400 });
    }
    const validGender = gender === "M" || gender === "F" ? gender : null;
    const bracketType = type === "kata" ? "kata" : "kumite";

    // Determine next order if not provided
    let bracketOrder = order ?? 0;
    if (bracketOrder === 0) {
      const lastBracket = await prisma.tournamentBracket.findFirst({
        where: { tournamentId: id },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      bracketOrder = (lastBracket?.order ?? 0) + 1;
    }

    const bracket = await prisma.tournamentBracket.create({
      data: {
        tournamentId: id,
        name:   name.trim(),
        type:   bracketType,
        gender: validGender,
        order:  bracketOrder,
        status: "draft",
      },
      include: {
        _count: {
          select: { participants: true, matches: true },
        },
      },
    });

    return NextResponse.json(bracket, { status: 201 });
  } catch (err) {
    console.error("POST /api/tournaments/[id]/brackets error:", err);
    return NextResponse.json({ error: "Error interno al crear el bracket" }, { status: 500 });
  }
}
