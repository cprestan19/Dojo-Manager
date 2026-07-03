import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { sendPushToSubscriptions, logPushSent } from "@/lib/push";

type Params = { params: Promise<{ id: string }> };

// POST /api/exam-applications/[id]/finalize — CLOSED → FINALIZED
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
    if (existing.status !== "CLOSED") {
      return NextResponse.json({ error: "Solo se puede finalizar desde estado CLOSED" }, { status: 400 });
    }

    const updated = await prisma.examApplication.update({
      where: { id },
      data:  { status: "FINALIZED" },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_APPLICATION_FINALIZED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamApplication",
      resourceId:   id,
      statusCode:   200,
    });

    // Push personalizado a cada alumno con su resultado — fire-and-forget
    const pushSettings = await prisma.pushSettings.findUnique({ where: { dojoId }, select: { enabled: true, notifyExamResult: true } }).catch(() => null);
    if (pushSettings?.enabled && pushSettings.notifyExamResult) {
      const invitees = await prisma.examApplicationInvitee.findMany({
        where:  { applicationId: id, attended: true },
        select: { studentId: true, passed: true },
      });
      for (const inv of invitees) {
        const subs = await prisma.pushSubscription.findMany({
          where:  { studentId: inv.studentId, active: true },
          select: { endpoint: true, p256dh: true, auth: true },
        });
        if (subs.length === 0) continue;
        const approved = inv.passed === true;
        sendPushToSubscriptions(subs, {
          title: approved ? "🏆 ¡Felicidades! Aprobaste el examen" : "📋 Resultado del examen disponible",
          body:  approved
            ? `Pasaste el examen de "${existing.title}". ¡Sigue adelante!`
            : `Tu resultado del examen "${existing.title}" está disponible.`,
          url:   "/portal/postulaciones",
          tag:   "exam-result",
        })
          .then(result => logPushSent({ dojoId, type: "exam_result", title: "Resultado de examen", body: existing.title, url: "/portal/postulaciones", result }))
          .catch(() => {});
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("POST /api/exam-applications/[id]/finalize", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
