import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { recomputeInviteeFinalScore } from "@/lib/examScoring";

type Params = { params: Promise<{ id: string; criteriaId: string }> };

// PUT /api/exam-applications/[id]/criteria/[criteriaId]
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id, criteriaId } = await params;
    const application = await prisma.examApplication.findFirst({ where: { id, dojoId } });
    if (!application) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    if (application.status === "FINALIZED") {
      return NextResponse.json({ error: "No se pueden editar los criterios de un examen finalizado" }, { status: 400 });
    }

    const criteria = await prisma.examCriteria.findFirst({ where: { id: criteriaId, applicationId: id } });
    if (!criteria) return NextResponse.json({ error: "Criterio no encontrado" }, { status: 404 });

    const body = await req.json() as { name?: string; weightPct?: number };
    const data: { name?: string; weightPct?: number } = {};
    if (body.name != null) {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });
      data.name = name;
    }
    if (body.weightPct != null) {
      if (typeof body.weightPct !== "number" || body.weightPct <= 0 || body.weightPct > 100) {
        return NextResponse.json({ error: "El peso debe ser un número entre 1 y 100" }, { status: 400 });
      }
      data.weightPct = body.weightPct;
    }

    const updated = await prisma.examCriteria.update({ where: { id: criteriaId }, data });

    // El peso cambió — recalcular la nota final de todos los que ya tienen notas
    if (body.weightPct != null) {
      const invitees = await prisma.examApplicationInvitee.findMany({
        where:  { applicationId: id, scores: { some: {} } },
        select: { id: true },
      });
      await Promise.all(invitees.map(inv => recomputeInviteeFinalScore(inv.id)));
    }

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_CRITERIA_UPDATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamCriteria",
      resourceId:   criteriaId,
      statusCode:   200,
      details:      JSON.stringify(data),
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/exam-applications/[id]/criteria/[criteriaId]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/exam-applications/[id]/criteria/[criteriaId]
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

    const { id, criteriaId } = await params;
    const application = await prisma.examApplication.findFirst({ where: { id, dojoId } });
    if (!application) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    if (application.status === "FINALIZED") {
      return NextResponse.json({ error: "No se pueden editar los criterios de un examen finalizado" }, { status: 400 });
    }

    const criteria = await prisma.examCriteria.findFirst({ where: { id: criteriaId, applicationId: id } });
    if (!criteria) return NextResponse.json({ error: "Criterio no encontrado" }, { status: 404 });

    const affectedInvitees = await prisma.examApplicationInvitee.findMany({
      where:  { applicationId: id, scores: { some: { criteriaId } } },
      select: { id: true },
    });

    await prisma.examCriteria.delete({ where: { id: criteriaId } }); // cascada borra sus ExamScore

    await Promise.all(affectedInvitees.map(inv => recomputeInviteeFinalScore(inv.id)));

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_CRITERIA_DELETED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamCriteria",
      resourceId:   criteriaId,
      statusCode:   200,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/exam-applications/[id]/criteria/[criteriaId]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
