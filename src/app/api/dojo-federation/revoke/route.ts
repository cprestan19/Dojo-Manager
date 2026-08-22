import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { revokeLink } from "@/lib/federation/authz";

// POST /api/dojo-federation/revoke — el dojo HIJO corta la vinculación
// (pendiente o activa) en cualquier momento. Corta acceso futuro del padre
// de inmediato (assertActiveParentAccess deja de devolver true). NUNCA borra
// puntajes/resultados que el padre ya haya registrado en otras tablas —
// quedan como histórico. Solo admin/sysadmin del hijo.
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

    const result = await revokeLink(dojoId, user.id ?? "");
    const ctx = buildAuditCtx(session, req, { dojoId });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await logAudit({
      ...ctx,
      action:       "FEDERATION_LINK_REVOKED",
      module:       AUDIT_MODULE.FEDERATION,
      resourceType: "DojoParentLink",
      resourceId:   dojoId,
      statusCode:   200,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/dojo-federation/revoke", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
