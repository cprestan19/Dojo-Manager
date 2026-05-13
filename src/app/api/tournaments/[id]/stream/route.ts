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
  const showKey = req.nextUrl.searchParams.get("showKey") === "1";

  try {
    const stream = await prisma.tournamentStream.findUnique({
      where: { tournamentId },
    });

    if (!stream) return NextResponse.json(null);

    const canSeeKey = showKey && (role === "admin" || role === "sysadmin");

    return NextResponse.json({
      ...stream,
      youtubeStreamKey: canSeeKey ? stream.youtubeStreamKey : undefined,
    });
  } catch (err) {
    console.error("GET /api/tournaments/[id]/stream error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
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

  const { id: tournamentId } = await params;

  const tournament = await prisma.tournament.findFirst({ where: { id: tournamentId, dojoId } });
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  if (raw.youtubeVideoId !== undefined && raw.youtubeVideoId !== null && raw.youtubeVideoId !== "") {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(raw.youtubeVideoId)) {
      return NextResponse.json({ error: "YouTube Video ID debe tener exactamente 11 caracteres alfanuméricos" }, { status: 400 });
    }
  }

  try {
    const existing = await prisma.tournamentStream.findUnique({
      where: { tournamentId },
    });

    const prevStatus = existing?.status ?? "offline";
    const newStatus = raw.status ?? prevStatus;

    const extraData: Record<string, unknown> = {};
    if (newStatus === "live" && prevStatus !== "live") {
      extraData.startedAt = new Date();
    }
    if (newStatus === "finished" && prevStatus === "live") {
      extraData.endedAt = new Date();
    }

    const stream = await prisma.tournamentStream.upsert({
      where: { tournamentId },
      create: {
        tournamentId,
        dojoId,
        youtubeVideoId: raw.youtubeVideoId ?? null,
        youtubeStreamKey: raw.youtubeStreamKey ?? null,
        title: raw.title ?? null,
        description: raw.description ?? null,
        thumbnailUrl: raw.thumbnailUrl ?? null,
        status: newStatus,
        overlayMessage: raw.overlayMessage ?? null,
        activeOverlay: raw.activeOverlay ?? "logo",
        ...extraData,
      },
      update: {
        ...(raw.youtubeVideoId  !== undefined ? { youtubeVideoId: raw.youtubeVideoId ?? null }    : {}),
        ...(raw.youtubeStreamKey !== undefined ? { youtubeStreamKey: raw.youtubeStreamKey ?? null } : {}),
        ...(raw.title           !== undefined ? { title: raw.title ?? null }                      : {}),
        ...(raw.description     !== undefined ? { description: raw.description ?? null }          : {}),
        ...(raw.thumbnailUrl    !== undefined ? { thumbnailUrl: raw.thumbnailUrl ?? null }        : {}),
        ...(raw.status          !== undefined ? { status: newStatus }                             : {}),
        ...(raw.overlayMessage  !== undefined ? { overlayMessage: raw.overlayMessage ?? null }    : {}),
        ...(raw.activeOverlay   !== undefined ? { activeOverlay: raw.activeOverlay }              : {}),
        ...extraData,
      },
    });

    return NextResponse.json({
      ...stream,
      youtubeStreamKey: undefined,
    });
  } catch (err) {
    console.error("PUT /api/tournaments/[id]/stream error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
