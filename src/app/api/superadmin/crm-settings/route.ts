/**
 * GET/PUT /api/superadmin/crm-settings
 * Interruptor del envío real de WhatsApp del CRM "Primera Etapa" — apagado
 * por default (decisión del usuario: activarlo él mismo desde el panel).
 * Mientras whatsappSendEnabled sea false, POST .../send-pending no llama a Meta.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string };

async function guardSysadmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }), session: null };
  const { role } = session.user as SessionUser;
  if (role !== "sysadmin")
    return { error: NextResponse.json({ error: "Solo sysadmin puede acceder" }, { status: 403 }), session: null };
  return { error: null, session };
}

export async function GET(req: NextRequest) {
  const { error } = await guardSysadmin(req);
  if (error) return error;

  const cfg = await prisma.crmSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({ whatsappSendEnabled: cfg?.whatsappSendEnabled ?? false });
}

export async function PUT(req: NextRequest) {
  const { error, session } = await guardSysadmin(req);
  if (error) return error;

  const t0   = Date.now();
  const body = await req.json().catch(() => ({})) as { whatsappSendEnabled?: boolean };
  const enabled = Boolean(body.whatsappSendEnabled);

  const cfg = await prisma.crmSettings.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", whatsappSendEnabled: enabled },
    update: { whatsappSendEnabled: enabled },
  });

  const ctx = buildAuditCtx(session!, req, { startTime: t0 });
  await logAudit({
    ...ctx,
    action:       enabled ? "CRM_WHATSAPP_SEND_ENABLED" : "CRM_WHATSAPP_SEND_DISABLED",
    module:       AUDIT_MODULE.WHATSAPP,
    resourceType: "CrmSettings",
    resourceId:   "singleton",
    statusCode:   200,
  });

  return NextResponse.json({ whatsappSendEnabled: cfg.whatsappSendEnabled });
}
