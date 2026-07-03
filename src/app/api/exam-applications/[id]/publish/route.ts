import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { sendPushToSubscriptions, logPushSent } from "@/lib/push";

type Params = { params: Promise<{ id: string }> };

// POST /api/exam-applications/[id]/publish — DRAFT → PUBLISHED
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

    const existing = await prisma.examApplication.findFirst({
      where: { id, dojoId },
      include: { _count: { select: { invitees: true } } },
    });
    if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    if (existing.status !== "DRAFT") {
      return NextResponse.json({ error: "Solo se puede publicar desde estado DRAFT" }, { status: 400 });
    }
    if (existing._count.invitees === 0) {
      return NextResponse.json({ error: "Debe tener al menos 1 invitado para publicar" }, { status: 400 });
    }

    const updated = await prisma.examApplication.update({
      where: { id },
      data:  { status: "PUBLISHED" },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_APPLICATION_PUBLISHED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamApplication",
      resourceId:   id,
      statusCode:   200,
    });

    // Push a los alumnos invitados — fire-and-forget
    const pushSettings = await prisma.pushSettings.findUnique({ where: { dojoId }, select: { enabled: true, notifyExamPublished: true } }).catch(() => null);
    if (pushSettings?.enabled && pushSettings.notifyExamPublished) {
      const examDate = existing.examDate.toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "numeric", month: "long" });
      const inviteeStudentIds = await prisma.examApplicationInvitee.findMany({
        where:  { applicationId: id },
        select: { studentId: true },
      });
      const studentIds = inviteeStudentIds.map(i => i.studentId);
      const subs = await prisma.pushSubscription.findMany({
        where:  { studentId: { in: studentIds }, active: true },
        select: { endpoint: true, p256dh: true, auth: true },
      });
      if (subs.length > 0) {
        sendPushToSubscriptions(subs, {
          title: "📋 Nueva convocatoria de examen",
          body:  `"${existing.title}" — ${examDate}. Confirma tu participación.`,
          url:   "/portal/postulaciones",
          tag:   "exam-published",
        }).then(result =>
          logPushSent({ dojoId, type: "exam_published", title: "Nueva convocatoria de examen", body: existing.title, url: "/portal/postulaciones", result })
        ).catch(() => {});
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("POST /api/exam-applications/[id]/publish", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
