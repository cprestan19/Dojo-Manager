/**
 * POST /api/public/tournaments/[slug]/register-club
 * Registro inicial de un club externo en un torneo abierto.
 * Sin autenticación — rate limit 5 req/min por IP.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateCoachToken } from "@/lib/coach-token";
import { checkRateLimit, getClientIp } from "@/lib/tournament-security";
import { sendEmail } from "@/lib/email";

type Params = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, "register-club", 5, 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera 1 minuto." }, { status: 429 });
  }

  const tournament = await prisma.tournament.findFirst({
    where: {
      publicSlug:     slug,
      isPublic:       true,
      tournamentType: { in: ["open", "federated"] },
      status:         { in: ["draft", "ready", "active"] },
    },
    select: {
      id:                  true,
      dojoId:              true,
      name:                true,
      registrationCloseAt: true,
      maxAthletesPerClub:  true,
      requireWaiver:       true,
      entryFeePerCategory: true,
      feeCurrency:         true,
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Torneo no disponible para inscripciones" }, { status: 404 });
  }

  if (tournament.registrationCloseAt && new Date() > tournament.registrationCloseAt) {
    return NextResponse.json({ error: "Las inscripciones están cerradas" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as {
    clubName?:    string;
    country?:     string;
    city?:        string;
    coachName?:   string;
    coachEmail?:  string;
    coachPhone?:  string;
    federationId?: string;
  };

  const { clubName, coachName, coachEmail } = body;
  if (!clubName?.trim() || !coachName?.trim() || !coachEmail?.trim()) {
    return NextResponse.json({ error: "clubName, coachName y coachEmail son requeridos" }, { status: 400 });
  }

  const email = coachEmail.toLowerCase().trim();

  // Email ya registrado en este torneo
  const existing = await prisma.externalClub.findFirst({
    where:  { tournamentId: tournament.id, coachEmail: email },
    select: { id: true, status: true },
  });
  if (existing) {
    return NextResponse.json({
      error:  "Este email ya tiene una inscripción en este torneo",
      status: existing.status,
    }, { status: 409 });
  }

  const accessExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Crear club con token temporal
  const club = await prisma.externalClub.create({
    data: {
      tournamentId: tournament.id,
      dojoId:       tournament.dojoId,
      clubName:     clubName.trim(),
      country:      body.country,
      city:         body.city,
      coachName:    coachName.trim(),
      coachEmail:   email,
      coachPhone:   body.coachPhone,
      federationId: body.federationId?.toUpperCase(),
      accessToken:  "pending",
      accessExpires,
      status:       "pending",
    },
  });

  // Generar JWT con el ID del club ya creado
  const token = await generateCoachToken({
    clubId:       club.id,
    tournamentId: tournament.id,
    dojoId:       tournament.dojoId,
    coachEmail:   email,
    type:         "coach_access",
  });

  await prisma.externalClub.update({
    where: { id: club.id },
    data:  { accessToken: token },
  });

  // Email de confirmación al coach
  const portalUrl = `${process.env.NEXTAUTH_URL}/coach/${token}`;
  try {
    await sendEmail({
      to:      email,
      subject: `Inscripción recibida — ${tournament.name}`,
      html:    `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
          <div style="background:#C0392B;padding:24px;text-align:center;">
            <h1 style="color:#FFD700;margin:0;font-size:24px;letter-spacing:2px;">🥋 INSCRIPCIÓN RECIBIDA</h1>
            <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">${tournament.name}</p>
          </div>
          <div style="padding:28px;">
            <p style="color:#1a1a1a;font-size:15px;">Hola <strong>${coachName.trim()}</strong>,</p>
            <p style="color:#444;font-size:14px;line-height:1.6;">
              Tu club <strong>${clubName.trim()}</strong> ha sido registrado exitosamente.
              Usa el siguiente enlace para gestionar tus atletas y categorías:
            </p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${portalUrl}" style="background:#C0392B;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold;display:inline-block;">
                Gestionar mi inscripción →
              </a>
            </div>
            <p style="color:#888;font-size:12px;line-height:1.5;">
              Este enlace es válido por 30 días y es personal — no lo compartas.<br/>
              Estado actual: <strong>PENDIENTE DE APROBACIÓN</strong>
            </p>
          </div>
        </div>`,
    });
  } catch (e) {
    console.error("[register-club] email error:", e);
  }

  return NextResponse.json({
    ok:      true,
    clubId:  club.id,
    message: "Inscripción registrada. Revisa tu correo para el enlace de gestión.",
  }, { status: 201 });
}
