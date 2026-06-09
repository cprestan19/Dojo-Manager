import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { withReadOnlyGuard } from "@/lib/billing/readOnlyGuard";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;

  if (role === "student") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  try {
    const url      = new URL(req.url);
    const archived = url.searchParams.get("archived") === "true";

    const tournaments = await prisma.tournament.findMany({
      where: {
        dojoId,
        archivedAt: archived ? { not: null } : null,
      },
      orderBy: { date: "desc" },
      select: {
        id: true, name: true, date: true, location: true,
        organization: true, leader1: true, leader2: true, leader3: true,
        status: true, bracketLocked: true, tatami: true, scheduledAt: true,
        archivedAt: true, createdAt: true, updatedAt: true,
        // flyerImage excluido — puede ser varios MB en base64
        _count: { select: { participants: true } },
      },
    });
    return NextResponse.json(tournaments);
  } catch (err) {
    console.error("GET /api/tournaments error:", err);
    return NextResponse.json({ error: "Error interno al cargar torneos" }, { status: 500 });
  }
}

async function _POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  try {
    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

    const { name, date, location, organization, leader1, leader2, leader3 } = raw as {
      name: string;
      date: string;
      location: string;
      organization: string;
      leader1: string;
      leader2?: string;
      leader3?: string;
    };

    if (!name || !date || !location || !organization || !leader1) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const tournament = await prisma.tournament.create({
      data: {
        dojoId,
        name:         name.trim(),
        date:         new Date(date),
        location:     location.trim(),
        organization: organization.trim(),
        leader1:      leader1.trim(),
        leader2:      leader2?.trim() ?? null,
        leader3:      leader3?.trim() ?? null,
      },
      // Select solo los campos core para evitar fallos por columnas nuevas
      // pendientes de db:push (archivedAt, etc.)
      select: {
        id: true, name: true, date: true, location: true,
        organization: true, status: true, bracketLocked: true,
        leader1: true, leader2: true, leader3: true,
        createdAt: true, dojoId: true,
      },
    });

    return NextResponse.json(tournament, { status: 201 });
  } catch (err) {
    console.error("POST /api/tournaments error:", err);
    return NextResponse.json({ error: "Error interno al crear el torneo" }, { status: 500 });
  }
}

export const POST = withReadOnlyGuard(_POST);
