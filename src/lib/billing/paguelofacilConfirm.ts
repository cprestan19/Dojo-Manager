import prisma from "@/lib/prisma";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";
import { type PagueloFacilTransactionRecord } from "@/lib/billing/paguelofacil";
import { SubscriptionStatus, InvoiceStatus, PagueloFacilLinkStatus, type PagueloFacilTransaction } from "@prisma/client";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Formato exacto del campo "status" devuelto por MerchantTransactions no está
// confirmado en documentación pública — se acepta numérico o textual hasta
// validar contra una transacción real de sandbox (Fase 5 QA).
export function isApprovedStatus(status: string | number | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return s === "1" || s === "aprobada" || s === "approved";
}

export type ConfirmOutcome = "paid" | "failed" | "already_processed" | "not_found";

export interface ConfirmContext {
  source:      "webhook" | "manual_reprocess";
  actorUserId?: string  | null;
  actorEmail?:  string  | null;
  reason?:      string  | null;
}

/**
 * Único punto de verdad para decidir si una transacción de PagueloFacil se
 * confirma como pagada. Usado tanto por el callback automático (RETURN_URL)
 * como por el reproceso manual de sysadmin — ambos caminos deben aplicar
 * exactamente la misma comparación de monto/estado, nunca una versión
 * simplificada "a mano" desde el panel de administración.
 */
export async function applyConfirmationResult(
  tx:   PagueloFacilTransaction,
  real: PagueloFacilTransactionRecord | null,
  ctx:  ConfirmContext,
  // El callback automático solo puede partir de PENDING (protección de replay).
  // El reproceso manual de sysadmin además puede re-evaluar un intento que ya
  // quedó FAILED/EXPIRED — nunca uno ya USED (eso sí sería replay real).
  fromStatuses: PagueloFacilLinkStatus[] = [PagueloFacilLinkStatus.PENDING],
): Promise<ConfirmOutcome> {
  if (!fromStatuses.includes(tx.status)) {
    await logAudit({
      action: "PAGUELOFACIL_CONFIRM_REPLAY_IGNORED", module: AUDIT_MODULE.SYSADMIN,
      resourceType: "Invoice", resourceId: tx.invoiceId, dojoId: tx.dojoId,
      userId: ctx.actorUserId, userEmail: ctx.actorEmail,
      details: JSON.stringify({ source: ctx.source, previousStatus: tx.status }),
    });
    return "already_processed";
  }

  const approved      = !!real && isApprovedStatus(real.status);
  const amountPaid     = real?.totalPay ?? 0;
  const amountMatches = amountPaid >= tx.amountExpected;

  if (!approved || !amountMatches) {
    await prisma.pagueloFacilTransaction.updateMany({
      where: { id: tx.id, status: { in: fromStatuses } },
      data:  { status: PagueloFacilLinkStatus.FAILED, amountPaid, rawResponse: (real?.raw ?? {}) as object },
    });
    await logAudit({
      action: "PAGUELOFACIL_PAYMENT_FAILED", module: AUDIT_MODULE.SYSADMIN,
      resourceType: "Invoice", resourceId: tx.invoiceId, dojoId: tx.dojoId,
      userId: ctx.actorUserId, userEmail: ctx.actorEmail,
      details: JSON.stringify({
        source: ctx.source, reason: ctx.reason ?? null,
        approved, amountExpected: tx.amountExpected, amountPaid,
      }),
    });
    return "failed";
  }

  const { count } = await prisma.pagueloFacilTransaction.updateMany({
    where: { id: tx.id, status: { in: fromStatuses } },
    data: {
      status:      PagueloFacilLinkStatus.USED,
      amountPaid,
      confirmedAt: new Date(),
      rawResponse: (real?.raw ?? {}) as object,
    },
  });
  if (count === 0) return "already_processed"; // otra request ganó la carrera

  const invoice = await prisma.invoice.update({
    where: { id: tx.invoiceId },
    data:  { status: InvoiceStatus.PAID, paidAt: new Date() },
  });
  await logAudit({
    action: "INVOICE_PAID", module: AUDIT_MODULE.SYSADMIN,
    resourceType: "Invoice", resourceId: tx.invoiceId, dojoId: tx.dojoId,
    userId: ctx.actorUserId, userEmail: ctx.actorEmail,
    details: JSON.stringify({ gateway: "PAGUELOFACIL", source: ctx.source, reason: ctx.reason ?? null, amountPaid }),
  });

  const subscription = await prisma.subscription.findUnique({ where: { id: invoice.subscriptionId } });
  if (subscription) {
    const now = new Date();
    const end = subscription.cycle === "MONTHLY" ? addDays(now, 30) : addDays(now, 365);
    await prisma.subscription.update({
      where: { id: subscription.id },
      data:  { status: SubscriptionStatus.ACTIVE, currentPeriodStart: now, currentPeriodEnd: end },
    });
    await logAudit({
      action: "SUBSCRIPTION_ACTIVATED", module: AUDIT_MODULE.SYSADMIN,
      resourceType: "Subscription", resourceId: subscription.id, dojoId: tx.dojoId,
      userId: ctx.actorUserId, userEmail: ctx.actorEmail,
      details: JSON.stringify({ source: ctx.source }),
    });
  }

  return "paid";
}

// Extrae codOper de un rawResponse guardado previamente (nombres de campo
// observados en la documentación pública vienen en distintas convenciones).
export function extractCodOper(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const val = r.codOper ?? r.CodOper ?? r.Oper ?? null;
  return val != null ? String(val) : null;
}
