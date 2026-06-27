import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const pending = await prisma.pendingStudent.findUnique({ where: { id }, select: { dojoId: true, status: true } });

    if (!pending || pending.dojoId !== dojoId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    if (pending.status !== "pending") {
      return NextResponse.json({ error: "Esta solicitud ya fue procesada" }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const note = typeof body?.note === "string" ? body.note.trim() : null;
    const reviewerId = (session.user as { id?: string }).id ?? "";

    await prisma.pendingStudent.update({
      where: { id },
      data: {
        status:        "rejected",
        reviewedBy:    reviewerId,
        reviewedAt:    new Date(),
        rejectionNote: note || null,
      },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "PENDING_STUDENT_REJECTED",
      module:       AUDIT_MODULE.STUDENTS,
      resourceType: "PendingStudent",
      resourceId:   id,
      statusCode:   200,
      details:      note ? JSON.stringify({ note }) : undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/pending-students/[id]/reject error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
