import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { acceptLink } from "@/lib/federation/authz";

// POST /api/dojo-federation/accept — el dojo HIJO acepta una solicitud
// PENDING de vinculación. Antes de esto el padre no puede ver ningún dato
// del hijo (ver assertActiveParentAccess). Solo admin/sysadmin del hijo.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { id?: string; role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const result = await acceptLink(dojoId, user.id ?? "");
    const ctx = buildAuditCtx(session, req, { dojoId });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await logAudit({
      ...ctx,
      action:       "FEDERATION_LINK_ACCEPTED",
      module:       AUDIT_MODULE.FEDERATION,
      resourceType: "DojoParentLink",
      resourceId:   dojoId,
      statusCode:   200,
      details:      JSON.stringify({ parentDojoName: result.parentDojoName }),
    });

    return NextResponse.json({ parentDojoName: result.parentDojoName });
  } catch (err) {
    console.error("POST /api/dojo-federation/accept", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
