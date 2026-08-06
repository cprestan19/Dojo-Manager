/**
 * Acreditación en la entrada del torneo (scanner QR del staff, PIN-protegido).
 * GET  /api/public/tournament-accredit/[qrCode]              → busca atleta (interno o externo)
 * PUT  /api/public/tournament-accredit/[qrCode]  { pin, tournamentId } → confirma acceso
 * Sin sesión NextAuth — el PIN de 4-6 dígitos del torneo es el control de acceso.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimit, getClientIp, constantTimeStringEqual } from "@/lib/tournament-security";

type Params = { params: Promise<{ qrCode: string }> };

type AthleteResult = {
  found: boolean;
  type?: "internal" | "external";
  canAccredit?: boolean;
  status?: "OK" | "WARNING";
  warnings?: string[];
  athlete?: {
    id: string; name: string; clubName: string; categories: string[];
    nationality: string | null; weight: number | null; photoUrl: string | null;
    accreditedAt: string | null; tournamentName: string;
  };
};

async function lookupExternal(code: string): Promise<AthleteResult | null> {
  const athlete = await prisma.externalAthlete.findUnique({
    where:  { qrCode: code },
    select: {
      id: true, firstName: true, lastName: true, nationality: true, weight: true,
      photoUrl: true, status: true, accreditedAt: true, tournamentId: true,
      externalClub: { select: { clubName: true, status: true, paymentStatus: true } },
      categories: { where: { status: { not: "withdrawn" } }, select: { categoryLabel: true } },
      tournament: { select: { name: true } },
    },
  });
  if (!athlete) return null;

  const warnings: string[] = [];
  if (athlete.accreditedAt) warnings.push("YA_ACREDITADO");
  if (athlete.externalClub.status !== "approved") warnings.push("CLUB_NO_APROBADO");
  if (athlete.status !== "approved") warnings.push("ATLETA_NO_APROBADO");
  if (!["paid", "waived"].includes(athlete.externalClub.paymentStatus)) warnings.push("PAGO_PENDIENTE");

  return {
    found: true,
    type:  "external",
    canAccredit: athlete.externalClub.status === "approved" && athlete.status === "approved",
    status: warnings.length ? "WARNING" : "OK",
    warnings,
    athlete: {
      id:   athlete.id,
      name: `${athlete.firstName} ${athlete.lastName}`,
      clubName: athlete.externalClub.clubName,
      categories: athlete.categories.map(c => c.categoryLabel),
      nationality: athlete.nationality ?? null,
      weight: athlete.weight ?? null,
      photoUrl: athlete.photoUrl?.startsWith("http") ? athlete.photoUrl : null,
      accreditedAt: athlete.accreditedAt?.toISOString() ?? null,
      tournamentName: athlete.tournament.name,
    },
  };
}

async function lookupInternal(code: string): Promise<AthleteResult | null> {
  const participant = await prisma.tournamentParticipant.findUnique({
    where:  { qrCode: code },
    select: {
      id: true, tournamentId: true, studentId: true, accreditedAt: true, weight: true,
      student: { select: { fullName: true, nationality: true, photo: true, dojo: { select: { name: true } } } },
      tournament: { select: { name: true } },
    },
  });
  if (!participant || !participant.studentId || !participant.student) return null;

  // Un alumno puede tener otra fila (kumite Y kata) en el mismo torneo — agrupamos categorías.
  const siblings = await prisma.tournamentParticipant.findMany({
    where:  { tournamentId: participant.tournamentId, studentId: participant.studentId },
    select: { weight: true, bracket: { select: { categoryLabel: true } } },
  });

  const warnings: string[] = participant.accreditedAt ? ["YA_ACREDITADO"] : [];

  return {
    found: true,
    type:  "internal",
    canAccredit: true,
    status: warnings.length ? "WARNING" : "OK",
    warnings,
    athlete: {
      id:   participant.id,
      name: participant.student.fullName,
      clubName: participant.student.dojo?.name ?? "",
      categories: siblings.map(s => s.bracket?.categoryLabel).filter((c): c is string => !!c),
      nationality: participant.student.nationality ?? null,
      weight: participant.weight ?? siblings.find(s => s.weight != null)?.weight ?? null,
      photoUrl: participant.student.photo?.startsWith("http") ? participant.student.photo : null,
      accreditedAt: participant.accreditedAt?.toISOString() ?? null,
      tournamentName: participant.tournament.name,
    },
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, "tournament-accredit-get", 60, 60_000)) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const { qrCode } = await params;
  const code = qrCode?.trim().toUpperCase();
  if (!code) return NextResponse.json({ found: false }, { status: 404 });

  const url          = new URL(req.url);
  const tournamentId = url.searchParams.get("tournamentId");
  const pin          = url.searchParams.get("pin");
  if (!tournamentId) return NextResponse.json({ error: "tournamentId requerido" }, { status: 400 });

  const tournament = await prisma.tournament.findUnique({
    where:  { id: tournamentId },
    select: { accreditationPin: true },
  });
  if (!tournament?.accreditationPin || !constantTimeStringEqual(tournament.accreditationPin, pin)) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 403 });
  }

  const result = (await lookupExternal(code)) ?? (await lookupInternal(code));
  if (!result) return NextResponse.json({ found: false }, { status: 404 });

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, "tournament-accredit-put", 30, 60_000)) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const { qrCode } = await params;
  const code = qrCode?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Código inválido" }, { status: 400 });

  const body = await req.json().catch(() => ({})) as { pin?: string; tournamentId?: string };
  if (!body.pin || !body.tournamentId) {
    return NextResponse.json({ error: "pin y tournamentId son requeridos" }, { status: 400 });
  }

  const tournament = await prisma.tournament.findUnique({
    where:  { id: body.tournamentId },
    select: { id: true, accreditationPin: true },
  });
  if (!tournament?.accreditationPin || !constantTimeStringEqual(tournament.accreditationPin, body.pin.trim())) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 403 });
  }

  const external = await prisma.externalAthlete.findUnique({ where: { qrCode: code }, select: { id: true, accreditedAt: true } });
  if (external) {
    const updated = await prisma.externalAthlete.update({
      where: { id: external.id },
      data:  { accreditedAt: external.accreditedAt ?? new Date() },
      select: { accreditedAt: true },
    });
    return NextResponse.json({ ok: true, accreditedAt: updated.accreditedAt?.toISOString() ?? null });
  }

  const participant = await prisma.tournamentParticipant.findUnique({
    where:  { qrCode: code },
    select: { id: true, tournamentId: true, studentId: true, accreditedAt: true },
  });
  if (!participant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const accreditedAt = participant.accreditedAt ?? new Date();
  // Acreditar TODAS las filas (kumite + kata) del mismo alumno en este torneo con un solo scan.
  await prisma.tournamentParticipant.updateMany({
    where: { tournamentId: participant.tournamentId, studentId: participant.studentId },
    data:  { accreditedAt },
  });

  return NextResponse.json({ ok: true, accreditedAt: accreditedAt.toISOString() });
}
