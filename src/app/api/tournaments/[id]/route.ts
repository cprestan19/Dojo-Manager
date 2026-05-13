import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit } from "@/lib/audit";

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

  try {
  const tournament = await prisma.tournament.findFirst({
    where: { id, dojoId },
    include: {
      participants: {
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
        },
        orderBy: { createdAt: "asc" },
      },
      matches: {
        orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
        take: 500,  // bracket de 256 participantes = 255 matches; 500 es margen seguro
      },
      referees: {
        orderBy: { order: "asc" },
      },
      brackets: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          type: true,
          gender: true,
          order: true,
          status: true,
          bracketLocked: true,
          _count: {
            select: { participants: true, matches: true },
          },
        },
      },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  return NextResponse.json(tournament);
  } catch (err) {
    console.error("GET /api/tournaments/[id] error:", err);
    return NextResponse.json({ error: "Error interno al cargar el torneo" }, { status: 500 });
  }
}

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

  const existing = await prisma.tournament.findFirst({ where: { id, dojoId } });
  if (!existing) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  try {
    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

    const {
      name, date, location, organization,
      leader1, leader2, leader3,
      tatami, scheduledAt,
      description, format, arbitrage, requirements, contact, flyerImage,
    } = raw as {
      name?: string; date?: string; location?: string; organization?: string;
      leader1?: string; leader2?: string; leader3?: string;
      tatami?: number | null; scheduledAt?: string | null;
      description?: string | null; format?: string | null;
      arbitrage?: string | null; requirements?: string | null;
      contact?: string | null; flyerImage?: string | null;
    };

    const updated = await prisma.tournament.update({
      where: { id },
      data: {
        ...(name         !== undefined ? { name: name!.trim() }                                          : {}),
        ...(date         !== undefined ? { date: new Date(date!) }                                       : {}),
        ...(location     !== undefined ? { location: location!.trim() }                                  : {}),
        ...(organization !== undefined ? { organization: organization!.trim() }                          : {}),
        ...(leader1      !== undefined ? { leader1: leader1!.trim() }                                    : {}),
        ...(leader2      !== undefined ? { leader2: leader2?.trim() || null }                            : {}),
        ...(leader3      !== undefined ? { leader3: leader3?.trim() || null }                            : {}),
        ...(tatami       !== undefined ? { tatami: tatami ?? null }                                      : {}),
        ...(scheduledAt  !== undefined ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }     : {}),
        ...(description  !== undefined ? { description: description  || null }                           : {}),
        ...(format       !== undefined ? { format: format            || null }                           : {}),
        ...(arbitrage    !== undefined ? { arbitrage: arbitrage      || null }                           : {}),
        ...(requirements !== undefined ? { requirements: requirements || null }                          : {}),
        ...(contact      !== undefined ? { contact: contact          || null }                           : {}),
        ...(flyerImage   !== undefined ? { flyerImage: flyerImage    || null }                           : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/tournaments/[id] error:", err);
    return NextResponse.json({ error: "Error interno al actualizar el torneo" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as SessionUser & { id?: string; email?: string };
  if (user.role !== "admin" && user.role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.tournament.findFirst({ where: { id, dojoId } });
  if (!existing) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  // Admin puede eliminar cualquier torneo excepto los confirmados; sysadmin puede eliminar todo
  if (user.role !== "sysadmin" && existing.status === "confirmed") {
    return NextResponse.json(
      { error: "No se puede eliminar un torneo ya confirmado. Contacta al Sysadmin." },
      { status: 400 },
    );
  }

  try {
    await prisma.tournament.delete({ where: { id } });

    // Registrar en audit log cuando sysadmin elimina un torneo (cualquier estado)
    if (user.role === "sysadmin") {
      await logAudit({
        action:    "TOURNAMENT_DELETED",
        userId:    user.id,
        userEmail: user.email,
        dojoId,
        details:   JSON.stringify({
          tournamentId:   id,
          tournamentName: existing.name,
          status:         existing.status,
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tournaments/[id] error:", err);
    return NextResponse.json({ error: "Error interno al eliminar el torneo" }, { status: 500 });
  }
}
