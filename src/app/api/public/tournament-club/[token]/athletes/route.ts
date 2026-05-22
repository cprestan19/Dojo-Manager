/**
 * POST /api/public/tournament-club/[token]/athletes  → agregar atleta
 * PUT  /api/public/tournament-club/[token]/athletes  → editar atleta (body: id + campos)
 * DELETE /api/public/tournament-club/[token]/athletes → retirar atleta (body: id)
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { requireCoachToken } from "@/lib/coach-token";
import { checkRateLimit, getClientIp, verifyClubOwnership, verifyAthleteOwnership } from "@/lib/tournament-security";
import { calculateAgeGroup } from "@/lib/tournament-categories";

type Params = { params: Promise<{ token: string }> };

async function getAuth(req: NextRequest, token: string) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, "coach-athletes", 30, 60_000)) return null;
  return requireCoachToken(token);
}

// ── POST — agregar atleta ────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const auth = await getAuth(req, token);
  if (!auth) return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { clubId, dojoId, tournamentId } = auth.payload;

  const ok = await verifyClubOwnership(clubId, dojoId, tournamentId);
  if (!ok) return NextResponse.json({ error: "Club no encontrado" }, { status: 404 });

  const tournament = await prisma.tournament.findFirst({
    where:  { id: tournamentId, dojoId },
    select: { id: true, date: true, registrationCloseAt: true, maxAthletesPerClub: true },
  });
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  if (tournament.registrationCloseAt && new Date() > new Date(tournament.registrationCloseAt)) {
    return NextResponse.json({ error: "Inscripciones cerradas" }, { status: 403 });
  }

  if (tournament.maxAthletesPerClub) {
    const count = await prisma.externalAthlete.count({ where: { externalClubId: clubId, dojoId } });
    if (count >= tournament.maxAthletesPerClub) {
      return NextResponse.json({ error: `Límite de ${tournament.maxAthletesPerClub} atletas alcanzado` }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => ({})) as {
    firstName?:   string;
    lastName?:    string;
    birthDate?:   string;
    gender?:      string;
    nationality?: string;
    weight?:      number | string;
    beltColor?:   string;
    fepakaId?:    string;
    categoryIds?: string[];
  };

  if (!body.firstName?.trim() || !body.lastName?.trim() || !body.birthDate || !body.gender) {
    return NextResponse.json({ error: "firstName, lastName, birthDate y gender son requeridos" }, { status: 400 });
  }

  const bDate    = new Date(body.birthDate);
  const ageGroup = calculateAgeGroup(bDate, new Date(tournament.date));
  const qrCode   = `${tournamentId.slice(-6).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;

  const athlete = await prisma.externalAthlete.create({
    data: {
      tournamentId,
      dojoId,
      externalClubId: clubId,
      firstName:   body.firstName.trim(),
      lastName:    body.lastName.trim(),
      birthDate:   bDate,
      gender:      body.gender,
      nationality: body.nationality,
      weight:      body.weight ? parseFloat(String(body.weight)) : null,
      beltColor:   body.beltColor,
      fepakaId:    body.fepakaId?.toUpperCase(),
      ageGroup,
      qrCode,
      status: "pending",
    },
  });

  // Inscribir en categorías seleccionadas
  if (body.categoryIds?.length) {
    const [brackets, tournament2] = await Promise.all([
      prisma.tournamentBracket.findMany({
        where:  { id: { in: body.categoryIds }, tournamentId },
        select: { id: true, categoryLabel: true },
      }),
      prisma.tournament.findUnique({
        where:  { id: tournamentId },
        select: { entryFeePerCategory: true },
      }),
    ]);

    await prisma.externalAthleteCategory.createMany({
      data: brackets.map(b => ({
        tournamentId,
        dojoId,
        athleteId:     athlete.id,
        bracketId:     b.id,
        categoryLabel: b.categoryLabel ?? "Sin categoría",
        status:        "pending",
        feeAmount:     tournament2?.entryFeePerCategory ?? null,
      })),
    });
  }

  return NextResponse.json({ ok: true, athleteId: athlete.id, ageGroup }, { status: 201 });
}

// ── PUT — editar atleta ──────────────────────────────────────

export async function PUT(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const auth = await getAuth(req, token);
  if (!auth) return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { clubId, dojoId, tournamentId } = auth.payload;

  const body = await req.json().catch(() => ({})) as {
    id?:          string;
    firstName?:   string;
    lastName?:    string;
    nationality?: string;
    weight?:      number | string | null;
    beltColor?:   string;
    fepakaId?:    string;
  };

  if (!body.id) return NextResponse.json({ error: "id del atleta requerido" }, { status: 400 });

  const ok = await verifyAthleteOwnership(body.id, clubId, dojoId);
  if (!ok) return NextResponse.json({ error: "Atleta no encontrado" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.firstName  !== undefined) data.firstName  = body.firstName.trim();
  if (body.lastName   !== undefined) data.lastName   = body.lastName.trim();
  if (body.nationality !== undefined) data.nationality = body.nationality;
  if (body.weight     !== undefined) data.weight     = body.weight != null ? parseFloat(String(body.weight)) : null;
  if (body.beltColor  !== undefined) data.beltColor  = body.beltColor;
  if (body.fepakaId   !== undefined) data.fepakaId   = body.fepakaId?.toUpperCase() ?? null;

  await prisma.externalAthlete.update({ where: { id: body.id }, data });
  return NextResponse.json({ ok: true });
}

// ── DELETE — retirar atleta ──────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const auth = await getAuth(req, token);
  if (!auth) return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { clubId, dojoId } = auth.payload;

  const body = await req.json().catch(() => ({})) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id del atleta requerido" }, { status: 400 });

  const ok = await verifyAthleteOwnership(body.id, clubId, dojoId);
  if (!ok) return NextResponse.json({ error: "Atleta no encontrado" }, { status: 404 });

  // Marcar como retirado en lugar de eliminar (para historial)
  await prisma.externalAthlete.update({
    where: { id: body.id },
    data:  { status: "withdrawn" },
  });
  await prisma.externalAthleteCategory.updateMany({
    where: { athleteId: body.id },
    data:  { status: "withdrawn" },
  });

  return NextResponse.json({ ok: true });
}
