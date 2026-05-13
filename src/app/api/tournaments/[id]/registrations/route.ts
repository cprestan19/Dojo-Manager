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

  const { id: tournamentId } = await params;
  const statusFilter = req.nextUrl.searchParams.get("status");
  const search = req.nextUrl.searchParams.get("search")?.toLowerCase();

  try {
    const registrations = await prisma.tournamentRegistration.findMany({
      where: {
        tournamentId,
        dojoId,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        student: { select: { fullName: true, studentCode: true } },
      },
    });

    const filtered = search
      ? registrations.filter((r) => {
          const name = r.student?.fullName ?? `${r.guestFirstName ?? ""} ${r.guestLastName ?? ""}`;
          return name.toLowerCase().includes(search) || (r.guestDojo ?? "").toLowerCase().includes(search);
        })
      : registrations;

    return NextResponse.json(filtered);
  } catch (err) {
    console.error("GET /api/tournaments/[id]/registrations error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
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

  const { id: tournamentId } = await params;

  const tournament = await prisma.tournament.findFirst({ where: { id: tournamentId, dojoId } });
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  if (tournament.status !== "registration_open") {
    return NextResponse.json({ error: "Las inscripciones no están abiertas" }, { status: 400 });
  }

  const raw = await req.json().catch(() => null);
  if (!raw || !raw.categories) {
    return NextResponse.json({ error: "categories es requerido" }, { status: 400 });
  }

  const categories = typeof raw.categories === "string" ? raw.categories : JSON.stringify(raw.categories);

  try {
    const registration = await prisma.tournamentRegistration.create({
      data: {
        tournamentId,
        dojoId,
        studentId: raw.studentId ?? null,
        guestFirstName: raw.guestFirstName ?? null,
        guestLastName: raw.guestLastName ?? null,
        guestDojo: raw.guestDojo ?? null,
        guestBelt: raw.guestBelt ?? null,
        guestBirthDate: raw.guestBirthDate ? new Date(raw.guestBirthDate) : null,
        guestEmail: raw.guestEmail ?? null,
        guestPhone: raw.guestPhone ?? null,
        categories,
      },
      include: {
        student: { select: { fullName: true, studentCode: true } },
      },
    });
    return NextResponse.json(registration, { status: 201 });
  } catch (err) {
    console.error("POST /api/tournaments/[id]/registrations error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
