import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { deleteMediaAsset } from "@/lib/media";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { sanitizeStudentAllowlist } from "@/lib/belt-videos";
import { withPlanFeatureGuard } from "@/lib/billing/planFeatureGuard";
import { NAV_KEYS } from "@/lib/permissions";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null; id?: string; email?: string | null };

async function _PUT(req: NextRequest, ctx?: unknown) {
  const { id } = await (ctx as Params).params;
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

  // If a new main video was uploaded, delete the old one
  if (body.videoUrl && body.publicId && body.publicId !== existing.publicId && existing.publicId) {
    await deleteMediaAsset(existing.videoUrl, existing.publicId, "video");
  }

  // If a new Tachi Kata video was uploaded, delete the old one
  if (body.tachiKataPublicId && body.tachiKataPublicId !== existing.tachiKataPublicId && existing.tachiKataPublicId) {
    await deleteMediaAsset(existing.tachiKataUrl, existing.tachiKataPublicId, "video");
  }

  // If Tachi Kata was explicitly cleared (null sent), delete it
  if (body.tachiKataUrl === null && existing.tachiKataPublicId) {
    await deleteMediaAsset(existing.tachiKataUrl, existing.tachiKataPublicId, "video");
  }

  let visibleToStudentIds;
  if ("visibleToStudentIds" in body) {
    try {
      visibleToStudentIds = await sanitizeStudentAllowlist(body.visibleToStudentIds, dojoId);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Selección de alumnos inválida" }, { status: 400 });
    }
  }

  const video = await prisma.beltVideo.update({
    where: { id },
    data: {
      beltColor:         body.beltColor   ?? existing.beltColor,
      title:             body.title?.trim() ?? existing.title,
      description:       body.description !== undefined ? (body.description?.trim() || null) : existing.description,
      videoUrl:          body.videoUrl    ?? existing.videoUrl,
      publicId:          body.publicId    ?? existing.publicId,
      tachiKataUrl:      "tachiKataUrl" in body      ? (body.tachiKataUrl      || null) : existing.tachiKataUrl,
      tachiKataPublicId: "tachiKataPublicId" in body ? (body.tachiKataPublicId || null) : existing.tachiKataPublicId,
      order:             body.order !== undefined ? Number(body.order) : existing.order,
      active:            body.active      ?? existing.active,
      visibleToStudentIds,
    },
  });

  const auditCtx = buildAuditCtx(session, req, { dojoId });
  await logAudit({
    ...auditCtx,
    action:       "BELT_VIDEO_UPDATED",
    module:       AUDIT_MODULE.SETTINGS,
    resourceType: "BeltVideo",
    resourceId:   video.id,
    statusCode:   200,
    details:      JSON.stringify({ title: video.title, beltColor: video.beltColor, restricted: Array.isArray(video.visibleToStudentIds) }),
  });

  return NextResponse.json(video);
}

async function _DELETE(req: NextRequest, ctx?: unknown) {
  const { id } = await (ctx as Params).params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const existing = await prisma.beltVideo.findFirst({ where: { id, dojoId } });
  if (!existing) return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });

  // Delete main video and Tachi Kata from their provider, then from DB
  if (existing.publicId) {
    await deleteMediaAsset(existing.videoUrl, existing.publicId, "video");
  }
  if (existing.tachiKataPublicId) {
    await deleteMediaAsset(existing.tachiKataUrl, existing.tachiKataPublicId, "video");
  }

  await prisma.beltVideo.delete({ where: { id } });

  const auditCtx = buildAuditCtx(session, req, { dojoId });
  await logAudit({
    ...auditCtx,
    action:       "BELT_VIDEO_DELETED",
    module:       AUDIT_MODULE.SETTINGS,
    resourceType: "BeltVideo",
    resourceId:   id,
    statusCode:   200,
    details:      JSON.stringify({ title: existing.title, beltColor: existing.beltColor }),
  });

  return NextResponse.json({ ok: true });
}

export const PUT    = withPlanFeatureGuard(NAV_KEYS.SETTINGS_VIDEOS, _PUT);
export const DELETE = withPlanFeatureGuard(NAV_KEYS.SETTINGS_VIDEOS, _DELETE);
