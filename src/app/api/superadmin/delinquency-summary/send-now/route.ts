/**
 * POST /api/superadmin/delinquency-summary/send-now
 *
 * Envío manual, bajo demanda, del resumen de morosidad a TODOS los dojos
 * activos con opt-in de WhatsApp — recalcula mora + recaudado del MES EN
 * CURSO para cada uno (computeDelinquencySummary usa la fecha de hoy, nunca
 * un mes guardado) y llama a sendDojoDelinquencySummary(dojo, stats) por
 * dojo, una llamada independiente por cada uno.
 *
 * Aislamiento entre dojos: cada iteración del for calcula sus propias stats
 * a partir del dojoId de ESE dojo (filtrado en la consulta vía student.dojoId,
 * nunca en JS), y se las pasa a sendDojoDelinquencySummary junto con el
 * nombre/teléfono de ESE mismo dojo — nunca se reutiliza ni se cachea nada
 * entre vueltas del loop. sendDojoDelinquencySummary ya manda también una
 * copia al número de soporte (SUPPORT_PHONE) con los datos de ese dojo en
 * particular — mismo mecanismo que el cron de morosidad diario.
 *
 * Requiere CrmSettings.delinquencySummaryManualEnabled=true — apagado por
 * default, se prende desde /dashboard/superadmin/clientes.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { computeDelinquencySummary, sendDojoDelinquencySummary } from "@/lib/whatsapp/delinquencySummary";

type SessionUser = { role?: string };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role } = session.user as SessionUser;
  if (role !== "sysadmin") {
    return NextResponse.json({ error: "Solo sysadmin puede disparar esto" }, { status: 403 });
  }

  const settings = await prisma.crmSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.delinquencySummaryManualEnabled) {
    return NextResponse.json({
      error: "Envío manual desactivado — actívalo desde /dashboard/superadmin/clientes antes de disparar esto.",
    }, { status: 400 });
  }

  const t0 = Date.now();

  const dojos = await prisma.dojo.findMany({
    where:  { active: true, whatsappOptIn: true },
    select: { id: true, name: true, phone: true, whatsappOptIn: true },
    orderBy: { name: "asc" },
  });

  let sent = 0, optOut = 0, noPhone = 0, failed = 0;
  const detail: { dojo: string; result: string }[] = [];

  for (const dojo of dojos) {
    const stats  = await computeDelinquencySummary(dojo.id);
    const result = await sendDojoDelinquencySummary(dojo, stats);
    if (result.sent) {
      sent++;
      detail.push({ dojo: dojo.name, result: "enviado" });
    } else if (result.reason === "OPT_OUT") {
      optOut++;
      detail.push({ dojo: dojo.name, result: "opt-out" });
    } else if (result.reason === "NO_PHONE") {
      noPhone++;
      detail.push({ dojo: dojo.name, result: "sin teléfono" });
    } else {
      failed++;
      detail.push({ dojo: dojo.name, result: "falló el envío" });
    }
  }

  const ctx = buildAuditCtx(session, req, { startTime: t0 });
  await logAudit({
    ...ctx,
    action:       "CRM_DELINQUENCY_SUMMARY_MANUAL_SEND",
    module:       AUDIT_MODULE.WHATSAPP,
    resourceType: "CrmSettings",
    resourceId:   "singleton",
    statusCode:   200,
    details:      JSON.stringify({ totalDojos: dojos.length, sent, optOut, noPhone, failed }),
  });

  return NextResponse.json({
    ok: true,
    totalDojos: dojos.length,
    sent, optOut, noPhone, failed,
    detail,
  });
}
