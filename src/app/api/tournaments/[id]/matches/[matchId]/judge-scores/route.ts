import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type Params = { params: Promise<{ id: string; matchId: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

/** GET: obtener todos los scores de jueces para este match + promedios calculados */
export async function GET(req: NextRequest, { params }: Params) {
  const { id, matchId } = await params;

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const role = (session.user as SessionUser)?.role;
  const sessionDojoId = (session.user as SessionUser)?.dojoId;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const match = await prisma.tournamentMatch.findFirst({
    where: { id: matchId, tournamentId: id, tournament: { dojoId } },
    include: {
      judgeScores: {
        include: {
          judge: { select: { id: true, name: true, role: true, tatamiId: true } },
        },
        orderBy: { judge: { name: "asc" } },
      },
    },
  });
  if (!match) return NextResponse.json({ error: "Match no encontrado" }, { status: 404 });

  // Calcular promedios / totales
  const scores = match.judgeScores;
  const n = scores.length;

  const type = scores[0]?.scoreType ?? "kumite";

  let summary: Record<string, unknown> = {};

  if (type === "kata") {
    // Kata: score individual por juez, eliminar mayor y menor, promediar el resto
    const raw1 = scores.map(s => s.kataScore1 ?? 0).sort((a, b) => a - b);
    const raw2 = scores.map(s => s.kataScore2 ?? 0).sort((a, b) => a - b);

    const trim = (arr: number[]) => {
      if (arr.length <= 2) return arr;
      return arr.slice(1, -1); // drop lowest and highest
    };

    const avg = (arr: number[]) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    summary = {
      type: "kata",
      competitor1: { raw: raw1, trimmed: trim(raw1), final: parseFloat(avg(trim(raw1)).toFixed(2)) },
      competitor2: { raw: raw2, trimmed: trim(raw2), final: parseFloat(avg(trim(raw2)).toFixed(2)) },
      judgeCount: n,
    };
  } else {
    // Kumite: sumar puntos de todos los jueces (en competencias locales es 1 árbitro)
    const total1 = scores.reduce((a, s) => a + s.score1, 0);
    const total2 = scores.reduce((a, s) => a + s.score2, 0);
    const penalties1 = scores.reduce((a, s) => a + s.penalty1, 0);
    const penalties2 = scores.reduce((a, s) => a + s.penalty2, 0);

    summary = {
      type: "kumite",
      competitor1: { score: total1, penalties: penalties1 },
      competitor2: { score: total2, penalties: penalties2 },
      judgeCount: n,
    };
  }

  return NextResponse.json({ scores, summary });
}

/**
 * PUT: el juez registra/actualiza su puntuación.
 * No requiere autenticación — acceso por judgeId.
 * El judgeId se valida contra el match/torneo.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const { id, matchId } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { judgeId, scoreType } = body as {
    judgeId: string; scoreType: "kumite" | "kata";
    score1?: number; score2?: number;
    penalty1?: number; penalty2?: number;
    kataScore1?: number; kataScore2?: number;
  };

  if (!judgeId) return NextResponse.json({ error: "judgeId requerido" }, { status: 400 });

  // Verificar que el match existe y que el juez pertenece al torneo
  const [match, judge] = await Promise.all([
    prisma.tournamentMatch.findFirst({ where: { id: matchId, tournamentId: id } }),
    prisma.tournamentJudge.findFirst({ where: { id: judgeId, tournamentId: id } }),
  ]);

  if (!match) return NextResponse.json({ error: "Match no encontrado" }, { status: 404 });
  if (!judge) return NextResponse.json({ error: "Juez no encontrado en este torneo" }, { status: 404 });

  const data: Record<string, unknown> = {
    matchId, judgeId,
    tatamiId: judge.tatamiId ?? null,
    scoreType: scoreType ?? "kumite",
  };

  if (scoreType === "kata") {
    if (body.kataScore1 !== undefined) data.kataScore1 = Math.max(0, Math.min(10, Number(body.kataScore1)));
    if (body.kataScore2 !== undefined) data.kataScore2 = Math.max(0, Math.min(10, Number(body.kataScore2)));
  } else {
    const clamp = (v: unknown, max: number) => Math.max(0, Math.min(max, Number(v ?? 0)));
    if (body.ippon1    !== undefined) data.ippon1    = clamp(body.ippon1, 99);
    if (body.wazaari1  !== undefined) data.wazaari1  = clamp(body.wazaari1, 99);
    if (body.yuko1     !== undefined) data.yuko1     = clamp(body.yuko1, 99);
    if (body.ippon2    !== undefined) data.ippon2    = clamp(body.ippon2, 99);
    if (body.wazaari2  !== undefined) data.wazaari2  = clamp(body.wazaari2, 99);
    if (body.yuko2     !== undefined) data.yuko2     = clamp(body.yuko2, 99);
    if (body.chukoku1  !== undefined) data.chukoku1  = clamp(body.chukoku1, 10);
    if (body.hansoku1  !== undefined) data.hansoku1  = clamp(body.hansoku1, 5);
    if (body.chukoku2  !== undefined) data.chukoku2  = clamp(body.chukoku2, 10);
    if (body.hansoku2  !== undefined) data.hansoku2  = clamp(body.hansoku2, 5);
    if (body.score1    !== undefined) data.score1    = clamp(body.score1, 999);
    if (body.score2    !== undefined) data.score2    = clamp(body.score2, 999);
    if (body.penalty1  !== undefined) data.penalty1  = clamp(body.penalty1, 10);
    if (body.penalty2  !== undefined) data.penalty2  = clamp(body.penalty2, 10);
    if (body.lastTechnique1 !== undefined) {
      const valid = ["ippon","wazaari","yuko","chukoku","hansoku",null];
      data.lastTechnique1 = valid.includes(body.lastTechnique1) ? body.lastTechnique1 : null;
    }
    if (body.lastTechnique2 !== undefined) {
      const valid = ["ippon","wazaari","yuko","chukoku","hansoku",null];
      data.lastTechnique2 = valid.includes(body.lastTechnique2) ? body.lastTechnique2 : null;
    }
  }

  const score = await prisma.tournamentJudgeScore.upsert({
    where:  { matchId_judgeId: { matchId, judgeId } },
    create: data as Parameters<typeof prisma.tournamentJudgeScore.create>[0]["data"],
    update: data as Parameters<typeof prisma.tournamentJudgeScore.update>[0]["data"],
    include: { judge: { select: { id: true, name: true } } },
  });

  // ── Senshu: registrar quién anotó primero ─────────────────────────────────
  // Solo se registra una vez; si ya existe senshu, no se sobreescribe.
  if (scoreType !== "kata" && !match.senshu) {
    const s1 = Number(body.score1 ?? 0);
    const s2 = Number(body.score2 ?? 0);
    // Obtener datos del match para conocer los participantIds
    const matchFull = await prisma.tournamentMatch.findUnique({
      where:  { id: matchId },
      select: { participant1Id: true, participant2Id: true },
    });
    if (s1 > 0 && matchFull?.participant1Id) {
      await prisma.tournamentMatch.update({ where: { id: matchId }, data: { senshu: matchFull.participant1Id } });
    } else if (s2 > 0 && matchFull?.participant2Id) {
      await prisma.tournamentMatch.update({ where: { id: matchId }, data: { senshu: matchFull.participant2Id } });
    }
  }

  return NextResponse.json(score);
}

/** DELETE: el juez borra su puntuación */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, matchId } = await params;
  const { judgeId } = await req.json().catch(() => ({})) as { judgeId: string };
  if (!judgeId) return NextResponse.json({ error: "judgeId requerido" }, { status: 400 });

  const judge = await prisma.tournamentJudge.findFirst({ where: { id: judgeId, tournamentId: id } });
  if (!judge) return NextResponse.json({ error: "Juez no autorizado" }, { status: 403 });

  await prisma.tournamentJudgeScore.deleteMany({ where: { matchId, judgeId } });
  return NextResponse.json({ ok: true });
}
