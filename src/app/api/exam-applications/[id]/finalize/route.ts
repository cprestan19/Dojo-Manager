import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { sendPushToSubscriptions, logPushSent, sendPushToDojoAdminOnlyAsync } from "@/lib/push";
import { hasFeature } from "@/lib/billing/featureGate";
import { NAV_KEYS } from "@/lib/permissions";
import { issueCertificate } from "@/lib/certificateIssuance";

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

    const updated = await prisma.examApplication.update({ where: { id }, data: { status: "FINALIZED" } });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_APPLICATION_FINALIZED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamApplication",
      resourceId:   id,
      statusCode:   200,
    });

    // Actualizar la cinta automáticamente para los aprobados — recién acá,
    // porque "Finalizar" es la confirmación del Sensei principal (nunca antes,
    // aunque ya hubiera notas o el checkbox "Aprobó" estuviera marcado).
    // beltAwarded:false filtra a los que YA se procesaron en una corrida
    // anterior (si esta postulación se reabrió y se vuelve a finalizar) —
    // nunca se les duplica la cinta.
    const passedInvitees = await prisma.examApplicationInvitee.findMany({
      where:  { applicationId: id, attended: true, passed: true, beltAwarded: false },
      select: { id: true, studentId: true, beltToPresent: true },
    });
    if (passedInvitees.length > 0) {
      await prisma.beltHistory.createMany({
        data: passedInvitees.map(inv => ({
          studentId:  inv.studentId,
          beltColor:  inv.beltToPresent,
          changeDate: existing.examDate,
          notes:      `Examen: ${existing.title}`,
        })),
      });
      await prisma.examApplicationInvitee.updateMany({
        where: { id: { in: passedInvitees.map(i => i.id) } },
        data:  { beltAwarded: true },
      });
      await logAudit({
        ...ctx,
        action:       "BELT_ADDED",
        module:       AUDIT_MODULE.BELTS,
        resourceType: "BeltHistory",
        statusCode:   200,
        details:      JSON.stringify({ applicationId: id, autoFromExam: true, studentIds: passedInvitees.map(i => i.studentId) }),
      });
    }

    // Certificado automático a los aprobados — solo si el plan del dojo
    // incluye Diplomas/Certificados. Si el plan lo incluye pero no hay una
    // plantilla activa configurada, se avisa al admin en vez de fallar en
    // silencio (pedido explícito: "es importante que salga un aviso...que
    // indique revisar su plantilla de diploma").
    if (passedInvitees.length > 0 && await hasFeature(dojoId, NAV_KEYS.CERTIFICADOS)) {
      const template = await prisma.certificateTemplate.findFirst({ where: { dojoId, active: true } });
      if (!template) {
        sendPushToDojoAdminOnlyAsync(dojoId, {
          title: "⚠️ Revisa tu plantilla de diploma",
          body:  `"${existing.title}" tuvo alumnos aprobados, pero no se les pudo enviar el certificado — no hay una plantilla de diploma activa configurada.`,
          url:   "/dashboard/settings/certificados",
        }, { type: "certificate_template_missing" });
      } else {
        const alreadyIssued = await prisma.generatedCertificate.findMany({
          where:  { inviteeId: { in: passedInvitees.map(i => i.id) }, dojoId },
          select: { inviteeId: true },
        });
        const alreadyIssuedIds = new Set(alreadyIssued.map(c => c.inviteeId));

        for (const inv of passedInvitees.filter(i => !alreadyIssuedIds.has(i.id))) {
          try {
            const cert = await prisma.generatedCertificate.create({
              data: {
                dojoId,
                studentId:  inv.studentId,
                inviteeId:  inv.id,
                templateId: template.id,
                title:      `Diploma ${existing.title}`,
                beltColor:  inv.beltToPresent,
                issuedDate: existing.examDate,
                status:     "DRAFT",
              },
            });
            const result = await issueCertificate(cert.id, dojoId);
            if (!result.ok) console.error(`[finalize] certificado ${cert.id} no se pudo emitir:`, result.error);
          } catch (err) {
            console.error(`[finalize] error generando certificado para invitee ${inv.id}:`, err);
          }
        }

        await logAudit({
          ...ctx,
          action:       "CERTIFICATES_AUTO_ISSUED",
          module:       AUDIT_MODULE.SETTINGS,
          resourceType: "GeneratedCertificate",
          statusCode:   200,
          details:      JSON.stringify({ applicationId: id, count: passedInvitees.length - alreadyIssuedIds.size }),
        });
      }
    }

    // Push personalizado a cada alumno con su resultado — fire-and-forget.
    // resultNotifiedAt:null filtra a quien ya se notificó en una corrida
    // anterior (postulación reabierta y vuelta a finalizar) — nunca se le
    // reenvía el mismo resultado.
    const pushSettings = await prisma.pushSettings.findUnique({ where: { dojoId }, select: { enabled: true, notifyExamResult: true } }).catch(() => null);
    if (pushSettings?.enabled && pushSettings.notifyExamResult) {
      const invitees = await prisma.examApplicationInvitee.findMany({
        where:  { applicationId: id, attended: true, resultNotifiedAt: null },
        select: { id: true, studentId: true, passed: true },
      });
      for (const inv of invitees) {
        const subs = await prisma.pushSubscription.findMany({
          where:  { studentId: inv.studentId, active: true },
          select: { endpoint: true, p256dh: true, auth: true },
        });
        await prisma.examApplicationInvitee.update({ where: { id: inv.id }, data: { resultNotifiedAt: new Date() } });
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
