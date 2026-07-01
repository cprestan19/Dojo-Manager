import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// POST /api/exam-applications/[id]/archive — mover a historial manualmente
export async function POST(req: NextRequest, { params }: Params) {
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

    const existing = await prisma.examApplication.findFirst({ where: { id, dojoId } });
    if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    if (existing.archivedAt) return NextResponse.json({ error: "Ya está archivada" }, { status: 400 });

    const updated = await prisma.examApplication.update({
      where: { id },
      data:  { archivedAt: new Date() },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_APPLICATION_ARCHIVED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamApplication",
      resourceId:   id,
      statusCode:   200,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("POST /api/exam-applications/[id]/archive", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
