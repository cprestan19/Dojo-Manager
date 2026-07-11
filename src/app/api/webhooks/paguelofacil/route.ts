import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";
import { verifyReturnToken, getTransactionByCodOper } from "@/lib/billing/paguelofacil";
import { applyConfirmationResult } from "@/lib/billing/paguelofacilConfirm";
import { PagueloFacilLinkStatus } from "@prisma/client";

function billingRedirect(req: NextRequest, status: string): NextResponse {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  return NextResponse.redirect(`${appUrl}/dashboard/billing?paguelofacil=${status}`);
}

/**
 * Retorno del navegador tras el pago (RETURN_URL del Enlace de Pago).
 * El PagueloFacil "webhook" opcional de servidor a servidor no viene firmado, y
 * estos query params los controla el navegador del cliente — nunca son la fuente
 * de verdad. La única confirmación válida es re-consultar el `Oper` (codOper)
 * contra MerchantTransactions con el accessToken del comercio.
 */
export async function GET(req: NextRequest) {
  try {
    const sp        = req.nextUrl.searchParams;
    const invoiceId = sp.get("invoiceId") ?? "";
    const dojoId    = sp.get("dojoId")    ?? "";
    const attemptId = sp.get("attemptId") ?? "";
    const token     = sp.get("token")     ?? "";
    const codOper   = sp.get("Oper")      ?? "";

    if (!invoiceId || !dojoId || !attemptId || !token) {
      await logAudit({
        action: "PAGUELOFACIL_CALLBACK_MALFORMED", module: AUDIT_MODULE.SYSADMIN,
        details: JSON.stringify({ params: Object.fromEntries(sp.entries()) }),
      });
      return billingRedirect(req, "invalid");
    }

    // ── 1. Verificar que el retorno no fue falsificado (HMAC atado al intento) ──
    if (!verifyReturnToken(invoiceId, dojoId, attemptId, token)) {
      await logAudit({
        action: "PAGUELOFACIL_CALLBACK_SPOOF_SUSPECTED", module: AUDIT_MODULE.SYSADMIN,
        resourceType: "Invoice", resourceId: invoiceId, dojoId,
        details: JSON.stringify({ attemptId, reason: "token HMAC inválido" }),
      });
      return billingRedirect(req, "invalid");
    }

    // ── 2. Cargar la transacción y verificar pertenencia al dojo ─────────────
    const tx = await prisma.pagueloFacilTransaction.findUnique({
      where: { invoiceId_attemptId: { invoiceId, attemptId } },
      include: { invoice: true },
    });
    if (!tx || tx.dojoId !== dojoId) {
      await logAudit({
        action: "PAGUELOFACIL_CALLBACK_NOT_FOUND", module: AUDIT_MODULE.SYSADMIN,
        resourceType: "Invoice", resourceId: invoiceId, dojoId,
        details: JSON.stringify({ attemptId }),
      });
      return billingRedirect(req, "invalid");
    }

    // ── 3. Protección de replay — solo se procesa una vez ────────────────────
    if (tx.status !== PagueloFacilLinkStatus.PENDING) {
      await logAudit({
        action: "PAGUELOFACIL_CALLBACK_REPLAY_IGNORED", module: AUDIT_MODULE.SYSADMIN,
        resourceType: "Invoice", resourceId: invoiceId, dojoId,
        details: JSON.stringify({ attemptId, previousStatus: tx.status }),
      });
      return billingRedirect(req, tx.status === PagueloFacilLinkStatus.USED ? "success" : "already-processed");
    }

    // ── 4. Expiración ─────────────────────────────────────────────────────────
    if (tx.expiresAt < new Date()) {
      await prisma.pagueloFacilTransaction.update({
        where: { id: tx.id },
        data:  { status: PagueloFacilLinkStatus.EXPIRED },
      });
      await logAudit({
        action: "PAGUELOFACIL_LINK_EXPIRED", module: AUDIT_MODULE.SYSADMIN,
        resourceType: "Invoice", resourceId: invoiceId, dojoId,
      });
      return billingRedirect(req, "expired");
    }

    // ── 5. Re-consultar el estado real contra PagueloFacil (fuente de verdad) ──
    if (!codOper) {
      await logAudit({
        action: "PAGUELOFACIL_CALLBACK_MISSING_OPER", module: AUDIT_MODULE.SYSADMIN,
        resourceType: "Invoice", resourceId: invoiceId, dojoId,
      });
      return billingRedirect(req, "pending");
    }

    let real;
    try {
      real = await getTransactionByCodOper(codOper);
    } catch (err) {
      console.error("[pf-webhook] getTransactionByCodOper error:", err);
      // No se pudo verificar — nunca se marca como pagado sin confirmación real.
      await logAudit({
        action: "PAGUELOFACIL_VERIFY_ERROR", module: AUDIT_MODULE.SYSADMIN,
        resourceType: "Invoice", resourceId: invoiceId, dojoId,
        details: JSON.stringify({ codOper, error: err instanceof Error ? err.message : String(err) }),
      });
      return billingRedirect(req, "pending");
    }

    // ── 6. Confirmar (o rechazar) — único punto de verdad compartido con el reproceso manual ──
    const outcome = await applyConfirmationResult(tx, real, { source: "webhook" });
    if (outcome === "paid" || outcome === "already_processed") return billingRedirect(req, "success");
    return billingRedirect(req, "failed");
  } catch (err) {
    console.error("[pf-webhook] error:", err);
    return billingRedirect(req, "error");
  }
}
