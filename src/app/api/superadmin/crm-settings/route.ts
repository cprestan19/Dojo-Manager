/**
 * GET/PUT /api/superadmin/crm-settings
 * Interruptores del CRM "Primera Etapa", ambos apagados por default —
 * el usuario los activa él mismo desde el panel:
 *  - whatsappSendEnabled: envío real de los templates de activación/riesgo.
 *    Mientras esté en false, POST .../send-pending no llama a Meta.
 *  - supportBotEnabled: chatbot de soporte (menú de ayuda + escalamiento).
 *    Mientras esté en false, el webhook no le contesta nada automático a
 *    nadie, aunque toquen "Sí, ayúdame" o escriban "soporte".
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string };

async function guardSysadmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }), session: null };
  const { role } = session.user as SessionUser;
  if (role !== "sysadmin")
    return { error: NextResponse.json({ error: "Solo sysadmin puede acceder" }, { status: 403 }), session: null };
  return { error: null, session };
}

export async function GET() {
  const { error } = await guardSysadmin();
  if (error) return error;

  const cfg = await prisma.crmSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({
    whatsappSendEnabled: cfg?.whatsappSendEnabled ?? false,
    supportBotEnabled:   cfg?.supportBotEnabled ?? false,
    delinquencySummaryManualEnabled: cfg?.delinquencySummaryManualEnabled ?? false,
  });
}

export async function PUT(req: NextRequest) {
  const { error, session } = await guardSysadmin();
  if (error) return error;

  const t0   = Date.now();
  const body = await req.json().catch(() => ({})) as {
    whatsappSendEnabled?: boolean;
    supportBotEnabled?: boolean;
    delinquencySummaryManualEnabled?: boolean;
  };

  const existing = await prisma.crmSettings.findUnique({ where: { id: "singleton" } });
  const whatsappSendEnabled = body.whatsappSendEnabled ?? existing?.whatsappSendEnabled ?? false;
  const supportBotEnabled   = body.supportBotEnabled   ?? existing?.supportBotEnabled   ?? false;
  const delinquencySummaryManualEnabled =
    body.delinquencySummaryManualEnabled ?? existing?.delinquencySummaryManualEnabled ?? false;

  const cfg = await prisma.crmSettings.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", whatsappSendEnabled, supportBotEnabled, delinquencySummaryManualEnabled },
    update: { whatsappSendEnabled, supportBotEnabled, delinquencySummaryManualEnabled },
  });

  const ctx = buildAuditCtx(session!, req, { startTime: t0 });
  if (body.whatsappSendEnabled !== undefined) {
    await logAudit({
      ...ctx,
      action:       body.whatsappSendEnabled ? "CRM_WHATSAPP_SEND_ENABLED" : "CRM_WHATSAPP_SEND_DISABLED",
      module:       AUDIT_MODULE.WHATSAPP,
      resourceType: "CrmSettings",
      resourceId:   "singleton",
      statusCode:   200,
    });
  }
  if (body.supportBotEnabled !== undefined) {
    await logAudit({
      ...ctx,
      action:       body.supportBotEnabled ? "CRM_SUPPORT_BOT_ENABLED" : "CRM_SUPPORT_BOT_DISABLED",
      module:       AUDIT_MODULE.WHATSAPP,
      resourceType: "CrmSettings",
      resourceId:   "singleton",
      statusCode:   200,
    });
  }
  if (body.delinquencySummaryManualEnabled !== undefined) {
    await logAudit({
      ...ctx,
      action:       body.delinquencySummaryManualEnabled ? "CRM_DELINQUENCY_SUMMARY_MANUAL_ENABLED" : "CRM_DELINQUENCY_SUMMARY_MANUAL_DISABLED",
      module:       AUDIT_MODULE.WHATSAPP,
      resourceType: "CrmSettings",
      resourceId:   "singleton",
      statusCode:   200,
    });
  }

  return NextResponse.json({
    whatsappSendEnabled: cfg.whatsappSendEnabled,
    supportBotEnabled:   cfg.supportBotEnabled,
    delinquencySummaryManualEnabled: cfg.delinquencySummaryManualEnabled,
  });
}
