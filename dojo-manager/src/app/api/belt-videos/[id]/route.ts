import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { deleteResource } from "@/lib/cloudinary";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const body = await req.json();

  const existing = await prisma.beltVideo.findFirst({ where: { id, dojoId } });
  if (!existing) return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });

  // If a new video was uploaded, delete the old one from Cloudinary
  if (body.videoUrl && body.publicId && body.publicId !== existing.publicId) {
    try { await deleteResource(existing.publicId, "video"); } catch { /* log but continue */ }
  }

  const video = await prisma.beltVideo.update({
    where: { id },
    data: {
      beltColor:   body.beltColor   ?? existing.beltColor,
      title:       body.title?.trim() ?? existing.title,
      description: body.description !== undefined ? (body.description?.trim() || null) : existing.description,
      videoUrl:    body.videoUrl    ?? existing.videoUrl,
      publicId:    body.publicId    ?? existing.publicId,
      order:       body.order !== undefined ? Number(body.order) : existing.order,
      active:      body.active      ?? existing.active,
    },
  });

  return NextResponse.json(video);
}

export async function DELETE( req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const existing = await prisma.beltVideo.findFirst({ where: { id, dojoId } });
  if (!existing) return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });

  // Delete from Cloudinary first, then from DB
  try { await deleteResource(existing.publicId, "video"); } catch { /* continue even if Cloudinary fails */ }

  await prisma.beltVideo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
