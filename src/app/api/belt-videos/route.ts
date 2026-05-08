import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

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

  if (!body.title?.trim())     return NextResponse.json({ error: "Título requerido" }, { status: 400 });
  if (!body.beltColor)         return NextResponse.json({ error: "Cinta requerida" }, { status: 400 });
  if (!body.videoUrl)          return NextResponse.json({ error: "URL de video requerida" }, { status: 400 });
  if (!body.publicId)          return NextResponse.json({ error: "publicId requerido" }, { status: 400 });

  const video = await prisma.beltVideo.create({
    data: {
      dojoId,
      beltColor:   body.beltColor,
      title:       body.title.trim(),
      description: body.description?.trim() || null,
      videoUrl:    body.videoUrl,
      publicId:    body.publicId,
      order:       Number(body.order) || 0,
    },
  });

  return NextResponse.json(video, { status: 201 });
}
