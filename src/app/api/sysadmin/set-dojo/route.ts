import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role } = session.user as SessionUser;
  if (role !== "sysadmin")
    return NextResponse.json({ error: "Solo sysadmin" }, { status: 403 });

  const { dojoId, preview } = await req.json() as { dojoId?: string; preview?: boolean };
  if (!dojoId) return NextResponse.json({ error: "dojoId requerido" }, { status: 400 });

  const dojo = await prisma.dojo.findUnique({
    where:  { id: dojoId },
    select: { id: true, name: true, slug: true },
  });
  if (!dojo) return NextResponse.json({ error: "Dojo no encontrado" }, { status: 404 });

  const res    = NextResponse.json({ ok: true, dojo });
  const secure = process.env.NODE_ENV === "production";

  res.cookies.set("sx-dojo",      dojo.id,   { path: "/", sameSite: "lax", httpOnly: true, secure });
  res.cookies.set("sx-dojo-name", dojo.name, { path: "/", sameSite: "lax", httpOnly: true, secure });
  if (preview) {
    res.cookies.set("sx-preview", "1", { path: "/", sameSite: "lax", httpOnly: true, secure });
  } else {
    res.cookies.delete("sx-preview");
  }

  const ctx = buildAuditCtx(session, req, { dojoId: dojo.id });
  await logAudit({
    ...ctx,
    action:      preview ? "SYSADMIN_PREVIEW_DOJO" : "SYSADMIN_ENTER_DOJO",
    module:      AUDIT_MODULE.SYSADMIN,
    resourceType: "Dojo",
    resourceId:  dojo.id,
    dojoSlug:    dojo.slug,
    statusCode:  200,
    isSysadminProxy: true,
    details:     JSON.stringify({ dojoName: dojo.name, dojoSlug: dojo.slug, preview: !!preview }),
  });

  return res;
}
