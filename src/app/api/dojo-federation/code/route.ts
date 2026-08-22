import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { generateFederationCode } from "@/lib/federation/authz";

// POST /api/dojo-federation/code — el dojo HIJO genera (o regenera) su
// código de invitación de 10 dígitos. Regenerar invalida el código anterior
// de inmediato (misma columna, se sobreescribe). Solo admin/sysadmin.
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

    const code = await generateFederationCode(dojoId);

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "FEDERATION_CODE_GENERATED",
      module:       AUDIT_MODULE.FEDERATION,
      resourceType: "Dojo",
      resourceId:   dojoId,
      statusCode:   200,
    });

    return NextResponse.json({ code });
  } catch (err) {
    console.error("POST /api/dojo-federation/code", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// GET — devuelve si ya existe un código generado (sin regenerarlo).
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const dojo = await prisma.dojo.findUnique({
      where:  { id: dojoId },
      select: { federationCode: true, federationCodeGeneratedAt: true },
    });

    return NextResponse.json({
      code:        dojo?.federationCode ?? null,
      generatedAt: dojo?.federationCodeGeneratedAt ?? null,
    });
  } catch (err) {
    console.error("GET /api/dojo-federation/code", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
