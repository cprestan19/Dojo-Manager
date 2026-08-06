import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/queries";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { deleteResource, extractCloudinaryPublicId } from "@/lib/cloudinary";

type SessionUser = { role?: string };

async function guardSysadmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }), session: null };
  const { role } = session.user as SessionUser;
  if (role !== "sysadmin")
    return { error: NextResponse.json({ error: "Sin permisos" }, { status: 403 }), session: null };
  return { error: null, session };
}

export async function GET() {
  const { error } = await guardSysadmin();
  if (error) return error;

  const cfg = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({ logo: cfg?.logo ?? null });
}

export async function PUT(req: NextRequest) {
  const { error, session } = await guardSysadmin();
  if (error) return error;

  const t0   = Date.now();
  const body = await req.json();
  const logo = body.logo ? String(body.logo) : null;

  // Si se reemplaza o elimina el logo, borrar el anterior de Cloudinary —
  // mismo patrón que /api/dojo y /api/users/[id].
  const existing = await prisma.platformSettings.findUnique({ where: { id: "singleton" }, select: { logo: true } });
  if (existing?.logo && logo !== existing.logo) {
    const pid = extractCloudinaryPublicId(existing.logo);
    if (pid) deleteResource(pid).catch(() => {});
  }

  const cfg = await prisma.platformSettings.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", logo },
    update: { logo },
  });

  revalidateTag(CACHE_TAGS.platformLogo);

  const ctx = buildAuditCtx(session!, req, { startTime: t0 });
  await logAudit({
    ...ctx,
    action:       "PLATFORM_LOGO_UPDATED",
    module:       AUDIT_MODULE.SETTINGS,
    resourceType: "PlatformSettings",
    resourceId:   "singleton",
    statusCode:   200,
    details:      JSON.stringify({ logoSet: !!logo }),
  });

  return NextResponse.json({ logo: cfg.logo ?? null });
}
