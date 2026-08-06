/**
 * Pesaje digital en la entrada del torneo (mismo modelo que la acreditación:
 * scanner QR del staff protegido por el PIN del torneo, sin sesión NextAuth).
 * GET  /api/public/tournament-weigh-in/[qrCode]                        → busca atleta y sus categorías de kumite con peso
 * PUT  /api/public/tournament-weigh-in/[qrCode]  { pin, tournamentId, actualWeight } → registra el peso medido
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimit, getClientIp, constantTimeStringEqual } from "@/lib/tournament-security";
import { evaluateWeighIn, parseWeightCategoryBounds } from "@/lib/weigh-in";

type Params = { params: Promise<{ qrCode: string }> };

type CategoryInfo = {
  participantId: string; bracketName: string; weightCategory: string | null;
  min: number | null; max: number | null;
  declaredWeight: number | null; actualWeight: number | null;
  weighInStatus: string | null; weighedInAt: string | null;
};
type WeighInResult = {
  found: boolean;
  athlete?: { name: string; clubName: string; photoUrl: string | null };
  categories?: CategoryInfo[];
};

async function resolveAthlete(code: string): Promise<{ studentId: string | null; externalAthleteId: string | null; tournamentId: string; name: string; clubName: string; photoUrl: string | null } | null> {
  const external = await prisma.externalAthlete.findUnique({
    where:  { qrCode: code },
    select: {
      id: true, tournamentId: true, firstName: true, lastName: true, photoUrl: true,
      externalClub: { select: { clubName: true } },
    },
  });
  if (external) {
    return {
      studentId: null, externalAthleteId: external.id, tournamentId: external.tournamentId,
      name: `${external.firstName} ${external.lastName}`,
      clubName: external.externalClub.clubName,
      photoUrl: external.photoUrl?.startsWith("http") ? external.photoUrl : null,
    };
  }

  const internal = await prisma.tournamentParticipant.findUnique({
    where:  { qrCode: code },
    select: {
      studentId: true, tournamentId: true,
      student: { select: { fullName: true, photo: true, dojo: { select: { name: true } } } },
    },
  });
  if (internal?.studentId && internal.student) {
    return {
      studentId: internal.studentId, externalAthleteId: null, tournamentId: internal.tournamentId,
      name: internal.student.fullName,
      clubName: internal.student.dojo?.name ?? "",
      photoUrl: internal.student.photo?.startsWith("http") ? internal.student.photo : null,
    };
  }
  return null;
}

export async function GET(req: NextRequest, { params }: Params) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, "tournament-weighin-get", 60, 60_000)) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const { qrCode } = await params;
  const code = qrCode?.trim().toUpperCase();
  if (!code) return NextResponse.json({ found: false } as WeighInResult, { status: 404 });

  const url          = new URL(req.url);
  const tournamentId = url.searchParams.get("tournamentId");
  const pin          = url.searchParams.get("pin");
  if (!tournamentId) return NextResponse.json({ error: "tournamentId requerido" }, { status: 400 });

  const tournamentPin = await prisma.tournament.findUnique({
    where:  { id: tournamentId },
    select: { accreditationPin: true },
  });
  if (!tournamentPin?.accreditationPin || !constantTimeStringEqual(tournamentPin.accreditationPin, pin)) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 403 });
  }

  const athlete = await resolveAthlete(code);
  if (!athlete) return NextResponse.json({ found: false } as WeighInResult, { status: 404 });

  const rows = await prisma.tournamentParticipant.findMany({
    where: {
      tournamentId: athlete.tournamentId,
      ...(athlete.studentId ? { studentId: athlete.studentId } : { externalAthleteId: athlete.externalAthleteId }),
      bracket: { type: "kumite", weightCategory: { not: null } },
    },
    select: {
      id: true, weight: true, actualWeight: true, weighInStatus: true, weighedInAt: true,
      bracket: { select: { name: true, categoryLabel: true, weightCategory: true } },
    },
  });

  const categories: CategoryInfo[] = rows.map(r => {
    const { min, max } = parseWeightCategoryBounds(r.bracket?.weightCategory ?? null);
    return {
      participantId:  r.id,
      bracketName:    r.bracket?.categoryLabel ?? r.bracket?.name ?? "",
      weightCategory: r.bracket?.weightCategory ?? null,
      min, max,
      declaredWeight: r.weight ?? null,
      actualWeight:   r.actualWeight ?? null,
      weighInStatus:  r.weighInStatus ?? null,
      weighedInAt:    r.weighedInAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json({
    found: true,
    athlete: { name: athlete.name, clubName: athlete.clubName, photoUrl: athlete.photoUrl },
    categories,
  } as WeighInResult, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, "tournament-weighin-put", 30, 60_000)) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const { qrCode } = await params;
  const code = qrCode?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Código inválido" }, { status: 400 });

  const body = await req.json().catch(() => ({})) as { pin?: string; tournamentId?: string; actualWeight?: number };
  if (!body.pin || !body.tournamentId || typeof body.actualWeight !== "number" || body.actualWeight <= 0) {
    return NextResponse.json({ error: "pin, tournamentId y actualWeight (> 0) son requeridos" }, { status: 400 });
  }

  const tournament = await prisma.tournament.findUnique({
    where:  { id: body.tournamentId },
    select: { id: true, accreditationPin: true, weighInTolerance: true },
  });
  if (!tournament?.accreditationPin || !constantTimeStringEqual(tournament.accreditationPin, body.pin.trim())) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 403 });
  }

  const athlete = await resolveAthlete(code);
  if (!athlete || athlete.tournamentId !== tournament.id) {
    return NextResponse.json({ error: "Atleta no encontrado" }, { status: 404 });
  }

  const rows = await prisma.tournamentParticipant.findMany({
    where: {
      tournamentId: tournament.id,
      ...(athlete.studentId ? { studentId: athlete.studentId } : { externalAthleteId: athlete.externalAthleteId }),
      bracket: { type: "kumite", weightCategory: { not: null } },
    },
    select: { id: true, bracket: { select: { weightCategory: true } } },
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "Este atleta no está inscrito en ninguna categoría de kumite con peso" }, { status: 400 });
  }

  const weighedInAt = new Date();
  await prisma.$transaction(
    rows.map(r => prisma.tournamentParticipant.update({
      where: { id: r.id },
      data: {
        actualWeight:  body.actualWeight,
        weighInStatus: evaluateWeighIn(body.actualWeight as number, r.bracket?.weightCategory ?? null, tournament.weighInTolerance),
        weighedInAt,
      },
    })),
  );

  return NextResponse.json({ ok: true, weighedInAt: weighedInAt.toISOString(), categoriesUpdated: rows.length });
}
