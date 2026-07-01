import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/exam-applications/[id]/payment — actualizar pago de invitado
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

    const body = await req.json() as { inviteeId: string; paymentStatus: string };
    if (!body.inviteeId)     return NextResponse.json({ error: "inviteeId requerido" }, { status: 400 });
    if (!body.paymentStatus) return NextResponse.json({ error: "paymentStatus requerido" }, { status: 400 });

    if (!["PENDING", "PAID"].includes(body.paymentStatus)) {
      return NextResponse.json({ error: "paymentStatus inválido. Use PENDING o PAID" }, { status: 400 });
    }

    const invitee = await prisma.examApplicationInvitee.findFirst({
      where: { id: body.inviteeId, applicationId },
    });
    if (!invitee) return NextResponse.json({ error: "Invitado no encontrado" }, { status: 404 });

    const updated = await prisma.examApplicationInvitee.update({
      where: { id: body.inviteeId },
      data: {
        paymentStatus: body.paymentStatus,
        paidAt:        body.paymentStatus === "PAID" ? new Date() : null,
      },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_PAYMENT_UPDATED",
      module:       AUDIT_MODULE.PAYMENTS,
      resourceType: "ExamApplicationInvitee",
      resourceId:   body.inviteeId,
      statusCode:   200,
      details:      JSON.stringify({ applicationId, paymentStatus: body.paymentStatus }),
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/exam-applications/[id]/payment", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
