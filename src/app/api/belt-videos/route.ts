import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { sendPushToDojoStudentsAsync } from "@/lib/push";
import { withPlanFeatureGuard } from "@/lib/billing/planFeatureGuard";
import { NAV_KEYS } from "@/lib/permissions";
import { sanitizeStudentAllowlist } from "@/lib/belt-videos";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };

async function _GET(req: NextRequest) {
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

async function _POST(req: NextRequest) {
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

  let visibleToStudentIds;
  try {
    visibleToStudentIds = await sanitizeStudentAllowlist(body.visibleToStudentIds, dojoId);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Selección de alumnos inválida" }, { status: 400 });
  }

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
      visibleToStudentIds,
    },
  });

  const auditCtx = buildAuditCtx(session, req, { dojoId });
  await logAudit({
    ...auditCtx,
    action:       "BELT_VIDEO_CREATED",
    module:       AUDIT_MODULE.SETTINGS,
    resourceType: "BeltVideo",
    resourceId:   video.id,
    statusCode:   201,
    details:      JSON.stringify({ title: video.title, beltColor: video.beltColor, restricted: Array.isArray(video.visibleToStudentIds) }),
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

export const GET  = withPlanFeatureGuard(NAV_KEYS.SETTINGS_VIDEOS, _GET);
export const POST = withPlanFeatureGuard(NAV_KEYS.SETTINGS_VIDEOS, _POST);
