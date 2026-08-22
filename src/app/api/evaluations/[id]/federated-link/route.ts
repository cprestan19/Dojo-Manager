import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { createFederatedLink } from "@/lib/federation/evaluationLink";
import { BELT_COLORS } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };
const VALID_BELTS = new Set(BELT_COLORS.map(b => b.value));

// POST /api/evaluations/[id]/federated-link — "Llamar dojo": el dojo PADRE
// vincula una Postulación OFRECIDA por un dojo hijo (ver /offer-to-parent y
// /api/dojo-federation/offers) a esta Evaluación. Crea un snapshot de sus
// postulados aceptados (FederatedCandidate) — nunca una relación viva al
// hijo. Ver src/lib/federation/evaluationLink.ts.
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

    const { id: evaluationId } = await params;
    const evaluation = await prisma.evaluation.findFirst({ where: { id: evaluationId, dojoId } });
    if (!evaluation) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });

    const body = await req.json().catch(() => ({})) as { applicationId?: string; beltFilter?: unknown };
    if (!body.applicationId) return NextResponse.json({ error: "applicationId requerido" }, { status: 400 });

    const beltFilter = Array.isArray(body.beltFilter) ? [...new Set(body.beltFilter.filter((b): b is string => typeof b === "string"))] : [];
    for (const belt of beltFilter) {
      if (!VALID_BELTS.has(belt)) return NextResponse.json({ error: `Cinta inválida: ${belt}` }, { status: 400 });
    }

    const result = await createFederatedLink(dojoId, evaluationId, body.applicationId, beltFilter, user.id ?? "");

    const ctx = buildAuditCtx(session, req, { dojoId });

    if (!result.ok) {
      await logAudit({
        ...ctx,
        action:       "FEDERATION_EVALUATION_LINK_DENIED",
        module:       AUDIT_MODULE.FEDERATION,
        resourceType: "FederatedEvaluationLink",
        statusCode:   400,
        details:      JSON.stringify({ applicationId: body.applicationId, reason: result.error }),
      });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await logAudit({
      ...ctx,
      action:       "FEDERATION_EVALUATION_LINK_CREATED",
      module:       AUDIT_MODULE.FEDERATION,
      resourceType: "FederatedEvaluationLink",
      resourceId:   result.linkId,
      statusCode:   200,
      details:      JSON.stringify({ evaluationId, applicationId: body.applicationId, candidateCount: result.candidateCount }),
    });

    return NextResponse.json({ ok: true, candidateCount: result.candidateCount });
  } catch (err) {
    console.error("POST /api/evaluations/[id]/federated-link", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
