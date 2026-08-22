import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { BELT_COLORS } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };
const VALID_BELTS = new Set(BELT_COLORS.map(b => b.value));

// POST /api/exam-applications/[id]/offer-to-parent — el dojo HIJO ofrece esta
// Postulación a su dojo padre (para que pueda "llamarla" desde una de sus
// Evaluaciones). Solo tiene efecto real si hay un DojoParentLink ACTIVE —
// se valida aquí, no se confía en que el frontend solo muestre el botón
// cuando corresponde.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { id?: string; role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const link = await prisma.dojoParentLink.findUnique({
      where:  { childDojoId: dojoId },
      select: { status: true },
    });
    if (!link || link.status !== "ACTIVE") {
      return NextResponse.json({ error: "Este dojo no tiene un dojo padre vinculado." }, { status: 400 });
    }

    const { id } = await params;
    const application = await prisma.examApplication.findFirst({ where: { id, dojoId } });
    if (!application) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const body = await req.json().catch(() => ({})) as { beltFilter?: unknown };
    const beltFilter = Array.isArray(body.beltFilter) ? [...new Set(body.beltFilter.filter((b): b is string => typeof b === "string"))] : [];
    for (const belt of beltFilter) {
      if (!VALID_BELTS.has(belt)) return NextResponse.json({ error: `Cinta inválida: ${belt}` }, { status: 400 });
    }

    await prisma.examApplication.update({
      where: { id },
      data:  { offeredToParentAt: new Date(), offeredToParentBeltFilter: beltFilter },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "FEDERATION_APPLICATION_OFFERED",
      module:       AUDIT_MODULE.FEDERATION,
      resourceType: "ExamApplication",
      resourceId:   id,
      statusCode:   200,
      details:      JSON.stringify({ beltFilter }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/exam-applications/[id]/offer-to-parent", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE — retira la oferta (el padre deja de verla; vínculos ya creados no se tocan).
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id } = await params;
    const application = await prisma.examApplication.findFirst({ where: { id, dojoId } });
    if (!application) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    await prisma.examApplication.update({
      where: { id },
      data:  { offeredToParentAt: null, offeredToParentBeltFilter: [] },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "FEDERATION_APPLICATION_OFFER_WITHDRAWN",
      module:       AUDIT_MODULE.FEDERATION,
      resourceType: "ExamApplication",
      resourceId:   id,
      statusCode:   200,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/exam-applications/[id]/offer-to-parent", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
