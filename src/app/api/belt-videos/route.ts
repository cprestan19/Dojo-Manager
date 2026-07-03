import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { sendPushToDojoStudentsAsync } from "@/lib/push";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const beltColor = new URL(req.url).searchParams.get("beltColor");

  const videos = await prisma.beltVideo.findMany({
    where:   { dojoId, ...(beltColor ? { beltColor } : {}) },
    orderBy: [{ beltColor: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(videos);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const body = await req.json();

  if (!body.title?.trim()) return NextResponse.json({ error: "Título requerido" }, { status: 400 });
  if (!body.beltColor)     return NextResponse.json({ error: "Cinta requerida" }, { status: 400 });
  if (!body.videoUrl && !body.tachiKataUrl)
    return NextResponse.json({ error: "Se requiere al menos un video (kata o tachi kata)" }, { status: 400 });

  const video = await prisma.beltVideo.create({
    data: {
      dojoId,
      beltColor:         body.beltColor,
      title:             body.title.trim(),
      description:       body.description?.trim() || null,
      videoUrl:          body.videoUrl          || null,
      publicId:          body.publicId          || null,
      tachiKataUrl:      body.tachiKataUrl      || null,
      tachiKataPublicId: body.tachiKataPublicId || null,
      order:             Number(body.order) || 0,
    },
  });

  // Notificar a los alumnos que hay un nuevo video disponible — fire-and-forget
  const pushSettings = await prisma.pushSettings.findUnique({ where: { dojoId }, select: { enabled: true, notifyNewVideo: true } }).catch(() => null);
  if (pushSettings?.enabled && pushSettings.notifyNewVideo) {
    sendPushToDojoStudentsAsync(
      dojoId,
      {
        title: "🎥 Nuevo video disponible",
        body:  `"${video.title}" ya está en tu portal de videos.`,
        url:   "/portal/videos",
        tag:   "new-video",
      },
      { type: "video" },
    );
  }

  return NextResponse.json(video, { status: 201 });
}
