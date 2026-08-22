import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { verifyAndRequestLink, FEDERATION_GENERIC_ERROR } from "@/lib/federation/authz";

// POST /api/dojo-federation/verify — el dojo PADRE ingresa el código de 10
// dígitos de un dojo hijo. Si es válido, crea una solicitud PENDING (el
// padre todavía no ve ningún dato del hijo — solo su nombre, para confirmar
// que es el dojo correcto antes de que el hijo acepte). Nunca revela si el
// código no existe vs. pertenece a un dojo ya vinculado — mismo error
// genérico en ambos casos (ver verifyAndRequestLink).
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

    const body = await req.json().catch(() => null) as { code?: unknown } | null;
    const code = typeof body?.code === "string" ? body.code : "";

    const ctx = buildAuditCtx(session, req, { dojoId });

    if (!code) {
      return NextResponse.json({ error: FEDERATION_GENERIC_ERROR }, { status: 400 });
    }

    const result = await verifyAndRequestLink(dojoId, code, user.id ?? "");

    if (!result.ok) {
      // Intento fallido de vinculación — se audita SIEMPRE (a diferencia del
      // resto de la app, donde solo se audita el éxito) porque un patrón
      // repetido de códigos fallidos desde el mismo dojo/IP es señal de
      // fuerza bruta contra el espacio de códigos de otros dojos.
      await logAudit({
        ...ctx,
        action:       "FEDERATION_VERIFY_DENIED",
        module:       AUDIT_MODULE.FEDERATION,
        resourceType: "DojoParentLink",
        statusCode:   400,
        details:      JSON.stringify({ reason: result.error }),
      });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await logAudit({
      ...ctx,
      action:       "FEDERATION_LINK_REQUESTED",
      module:       AUDIT_MODULE.FEDERATION,
      resourceType: "DojoParentLink",
      resourceId:   result.childDojoId,
      statusCode:   200,
    });

    // DTO mínimo — solo el nombre del dojo hijo, nada más (sin ids internos
    // adicionales, sin roster, sin ningún dato de alumnos en esta etapa).
    return NextResponse.json({ childDojoName: result.childDojoName });
  } catch (err) {
    console.error("POST /api/dojo-federation/verify", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
