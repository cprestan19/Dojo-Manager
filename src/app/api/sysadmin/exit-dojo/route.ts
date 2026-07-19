import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role } = session.user as SessionUser;
  if (role !== "sysadmin")
    return NextResponse.json({ error: "Solo sysadmin" }, { status: 403 });

  // Leer el dojo del que se sale ANTES de borrar la cookie
  const sxDojo = req.cookies.get("sx-dojo")?.value ?? null;

  const ctx = buildAuditCtx(session, req, { dojoId: sxDojo });
  await logAudit({
    ...ctx,
    action:          "SYSADMIN_EXIT_DOJO",
    module:          AUDIT_MODULE.SYSADMIN,
    resourceType:    "Dojo",
    resourceId:      sxDojo,
    statusCode:      200,
    isSysadminProxy: true,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.delete("sx-dojo");
  res.cookies.delete("sx-dojo-name");
  res.cookies.delete("sx-preview");
  return res;
}
