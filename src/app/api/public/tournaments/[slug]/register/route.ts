import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const tournament = await prisma.tournament.findFirst({
      where: { publicSlug: slug, isPublic: true },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    if (tournament.status !== "registration_open") {
      return NextResponse.json({ error: "Las inscripciones no están abiertas" }, { status: 400 });
    }

    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

    if (!raw.firstName?.trim() || !raw.lastName?.trim()) {
      return NextResponse.json({ error: "Nombre y apellido son requeridos" }, { status: 400 });
    }

    if (!raw.categories) {
      return NextResponse.json({ error: "categories es requerido" }, { status: 400 });
    }

    const categories = typeof raw.categories === "string" ? raw.categories : JSON.stringify(raw.categories);

    const registration = await prisma.tournamentRegistration.create({
      data: {
        tournamentId: tournament.id,
        dojoId: tournament.dojoId,
        studentId: null,
        guestFirstName: raw.firstName.trim(),
        guestLastName: raw.lastName.trim(),
        guestDojo: raw.dojo ?? null,
        guestBelt: raw.belt ?? null,
        guestBirthDate: raw.birthDate ? new Date(raw.birthDate) : null,
        guestEmail: raw.email ?? null,
        guestPhone: raw.phone ?? null,
        categories,
        status: "pending",
      },
    });

    return NextResponse.json({ ok: true, id: registration.id }, { status: 201 });
  } catch (err) {
    console.error("POST /api/public/tournaments/[slug]/register error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
