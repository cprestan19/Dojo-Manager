import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type Params = { params: Promise<{ id: string; tatamiId: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest, { params }: Params) {
  const { id, tatamiId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const tatami = await prisma.tournamentTatami.findFirst({
    where: { id: tatamiId, tournamentId: id, dojoId },
    select: {
      id: true, name: true, color: true,
      youtubeVideoId: true, streamStatus: true, overlayMessage: true,
      currentMatchId: true,
    },
  });
  if (!tatami) return NextResponse.json({ error: "Tatami no encontrado" }, { status: 404 });

  const showKey = new URL(req.url).searchParams.get("showKey") === "1";
  if (showKey) {
    const full = await prisma.tournamentTatami.findUnique({
      where: { id: tatamiId },
      select: { youtubeStreamKey: true },
    });
    return NextResponse.json({ ...tatami, youtubeStreamKey: full?.youtubeStreamKey ?? null });
  }

  return NextResponse.json(tatami);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id, tatamiId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const tatami = await prisma.tournamentTatami.findFirst({
    where: { id: tatamiId, tournamentId: id, dojoId },
  });
  if (!tatami) return NextResponse.json({ error: "Tatami no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const data: Record<string, unknown> = {};

  if (body.youtubeVideoId !== undefined) {
    const vid = body.youtubeVideoId?.trim() ?? null;
    if (vid && !/^[a-zA-Z0-9_-]{11}$/.test(vid))
      return NextResponse.json({ error: "YouTube Video ID inválido (debe ser 11 caracteres)" }, { status: 400 });
    data.youtubeVideoId = vid;
  }
  if (body.youtubeStreamKey !== undefined) data.youtubeStreamKey = body.youtubeStreamKey?.trim() || null;
  if (body.overlayMessage   !== undefined) data.overlayMessage   = body.overlayMessage?.trim() || null;

  if (body.streamStatus !== undefined) {
    const validStatuses = ["offline", "live", "finished"];
    if (!validStatuses.includes(body.streamStatus))
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    data.streamStatus = body.streamStatus;
  }
  if (body.videoReviewEnabled !== undefined) data.videoReviewEnabled = Boolean(body.videoReviewEnabled);
  if (body.obsRecordingPath    !== undefined) data.obsRecordingPath   = body.obsRecordingPath?.trim() || null;

  const updated = await prisma.tournamentTatami.update({
    where: { id: tatamiId },
    data,
    select: { id: true, name: true, color: true, youtubeVideoId: true, streamStatus: true, overlayMessage: true, videoReviewEnabled: true, obsRecordingPath: true },
  });

  return NextResponse.json(updated);
}
