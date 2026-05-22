/**
 * API de Video Review — autenticada por PIN del torneo (no por NextAuth).
 * El árbitro no necesita cuenta en DojoManager; usa el PIN configurado por el admin.
 *
 * POST → solicitar revisión (pausa el timer automáticamente)
 * PUT  → registrar decisión del árbitro
 * GET  → estado actual de la revisión (para polling desde la pantalla del árbitro)
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, getClientIp } from "@/lib/tournament-security";
import {
  calculateReviewOffset,
  formatReviewOffset,
  buildOBSSeekInstruction,
  type ReviewDecision,
  type ReviewRequestedBy,
} from "@/lib/video-review";

type Params = { params: Promise<{ id: string; matchId: string }> };

/** Verifica el PIN del torneo y retorna el torneo si es válido. */
async function verifyPin(tournamentId: string, pin: string) {
  if (!pin) return null;
  const tournament = await prisma.tournament.findUnique({
    where:  { id: tournamentId },
    select: { id: true, dojoId: true, accreditationPin: true },
  });
  if (!tournament?.accreditationPin) return null;
  if (tournament.accreditationPin !== pin) return null;
  return tournament;
}

// ── GET — estado actual de la revisión ──────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const { id, matchId } = await params;
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, "video-review-get", 60, 60_000)) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const match = await prisma.tournamentMatch.findFirst({
    where:  { id: matchId, tournamentId: id },
    select: {
      id: true,
      reviewStatus: true,
      reviewRequestedBy: true,
      reviewRequestedAt: true,
      reviewDecision: true,
      reviewNotes: true,
      reviewCompletedAt: true,
      tatami: {
        select: {
          currentMatchStartedAt: true,
          lastReviewOffset: true,
          youtubeVideoId: true,
          obsRecordingPath: true,
          videoReviewEnabled: true,
        },
      },
    },
  });

  if (!match) return NextResponse.json({ error: "Combate no encontrado" }, { status: 404 });

  return NextResponse.json({
    reviewStatus:      match.reviewStatus,
    reviewRequestedBy: match.reviewRequestedBy,
    reviewDecision:    match.reviewDecision,
    reviewNotes:       match.reviewNotes,
    reviewCompletedAt: match.reviewCompletedAt,
    offsetSeconds:     match.tatami?.lastReviewOffset ?? null,
    offsetFormatted:   match.tatami?.lastReviewOffset != null
      ? formatReviewOffset(match.tatami.lastReviewOffset)
      : null,
    youtubeVideoId:    match.tatami?.youtubeVideoId ?? null,
    videoReviewEnabled: match.tatami?.videoReviewEnabled ?? false,
  }, { headers: { "Cache-Control": "no-store" } });
}

// ── POST — solicitar revisión ────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const { id, matchId } = await params;
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, "video-review-post", 10, 60_000)) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as {
    pin?: string;
    requestedBy?: ReviewRequestedBy;
  };

  const tournament = await verifyPin(id, body.pin ?? "");
  if (!tournament) {
    return NextResponse.json({ error: "PIN inválido" }, { status: 403 });
  }

  const match = await prisma.tournamentMatch.findFirst({
    where: { id: matchId, tournamentId: id },
    include: {
      tatami: {
        select: {
          id: true,
          videoReviewEnabled: true,
          currentMatchStartedAt: true,
          youtubeVideoId: true,
          obsRecordingPath: true,
        },
      },
    },
  });

  if (!match) return NextResponse.json({ error: "Combate no encontrado" }, { status: 404 });

  if (!match.tatami?.videoReviewEnabled) {
    return NextResponse.json({ error: "Video review no está activado en este tatami" }, { status: 403 });
  }

  if (match.reviewStatus !== "none") {
    return NextResponse.json({ error: "Ya hay una revisión en proceso" }, { status: 409 });
  }

  const now = new Date();
  const matchStart = match.tatami.currentMatchStartedAt ?? now;
  const offsetSeconds = calculateReviewOffset(matchStart, now);

  await prisma.$transaction([
    prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        reviewStatus:      "requested",
        reviewRequestedAt: now,
        reviewRequestedBy: body.requestedBy ?? "referee",
      },
    }),
    // Pausar el timer automáticamente
    prisma.tournamentTatami.update({
      where: { id: match.tatami.id },
      data: {
        matchTimerRunning:     false,
        matchTimerBaseElapsed: { increment: Math.floor((now.getTime() - (match.tatami.currentMatchStartedAt?.getTime() ?? now.getTime())) / 1000) },
        lastReviewOffset:      offsetSeconds,
      },
    }),
  ]);

  await logAudit({
    action:  "VIDEO_REVIEW_REQUESTED",
    dojoId:  tournament.dojoId,
    details: JSON.stringify({ matchId, tournamentId: id, offsetSeconds, requestedBy: body.requestedBy }),
  });

  return NextResponse.json({
    ok:              true,
    offsetSeconds,
    offsetFormatted: formatReviewOffset(offsetSeconds),
    youtubeVideoId:  match.tatami.youtubeVideoId,
    obsInstruction:  buildOBSSeekInstruction(offsetSeconds, match.tatami.obsRecordingPath),
  });
}

// ── PUT — registrar decisión ─────────────────────────────────

export async function PUT(req: NextRequest, { params }: Params) {
  const { id, matchId } = await params;
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, "video-review-put", 20, 60_000)) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as {
    pin?:      string;
    decision?: ReviewDecision;
    notes?:    string;
  };

  const tournament = await verifyPin(id, body.pin ?? "");
  if (!tournament) {
    return NextResponse.json({ error: "PIN inválido" }, { status: 403 });
  }

  const valid: ReviewDecision[] = ["confirmed", "reversed", "no_contest"];
  if (!body.decision || !valid.includes(body.decision)) {
    return NextResponse.json({ error: "Decisión inválida" }, { status: 400 });
  }

  const match = await prisma.tournamentMatch.findFirst({
    where:  { id: matchId, tournamentId: id },
    select: { reviewStatus: true, tatami: { select: { id: true, matchTimerBaseElapsed: true } } },
  });

  if (!match) return NextResponse.json({ error: "Combate no encontrado" }, { status: 404 });

  if (match.reviewStatus === "none" || match.reviewStatus === "confirmed" || match.reviewStatus === "reversed") {
    return NextResponse.json({ error: "No hay revisión activa" }, { status: 409 });
  }

  const finalStatus = body.decision === "no_contest" ? "confirmed" : body.decision;

  await prisma.tournamentMatch.update({
    where: { id: matchId },
    data: {
      reviewStatus:     finalStatus,
      reviewDecision:   body.decision,
      reviewNotes:      body.notes?.trim() || null,
      reviewCompletedAt: new Date(),
    },
  });

  await logAudit({
    action:  "VIDEO_REVIEW_DECIDED",
    dojoId:  tournament.dojoId,
    details: JSON.stringify({ matchId, tournamentId: id, decision: body.decision, notes: body.notes }),
  });

  return NextResponse.json({ ok: true, decision: body.decision, finalStatus });
}
