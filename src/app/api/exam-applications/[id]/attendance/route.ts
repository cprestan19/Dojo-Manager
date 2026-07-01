import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/exam-applications/[id]/attendance — marcar asistencia y resultado
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id: applicationId } = await params;

    const application = await prisma.examApplication.findFirst({ where: { id: applicationId, dojoId } });
    if (!application) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const body = await req.json() as { inviteeId: string; attended: boolean; passed?: boolean | null };
    if (!body.inviteeId) return NextResponse.json({ error: "inviteeId requerido" }, { status: 400 });

    const invitee = await prisma.examApplicationInvitee.findFirst({
      where: { id: body.inviteeId, applicationId },
    });
    if (!invitee) return NextResponse.json({ error: "Invitado no encontrado" }, { status: 404 });

    const updated = await prisma.examApplicationInvitee.update({
      where: { id: body.inviteeId },
      data: {
        attended: body.attended,
        ...(body.passed !== undefined ? { passed: body.passed } : {}),
      },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_ATTENDANCE_UPDATED",
      module:       AUDIT_MODULE.ATTENDANCE,
      resourceType: "ExamApplicationInvitee",
      resourceId:   body.inviteeId,
      statusCode:   200,
      details:      JSON.stringify({ applicationId, attended: body.attended, passed: body.passed }),
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/exam-applications/[id]/attendance", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
