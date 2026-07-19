import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getTransactionByCodOper } from "@/lib/billing/paguelofacil";
import { applyConfirmationResult, extractCodOper } from "@/lib/billing/paguelofacilConfirm";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";
import { PaymentGateway, PagueloFacilLinkStatus } from "@prisma/client";

type SessionUser = { id?: string; email?: string | null; role?: string };

/**
 * Reproceso manual de un pago PagueloFacil que quedó FAILED/EXPIRED — nunca
 * fuerza el estado a mano: siempre re-consulta contra PagueloFacil (mismo
 * camino de verificación que el callback automático) antes de confirmar.
 * Requiere rol sysadmin y motivo escrito — mismo patrón que BRACKET_REOPENED.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as SessionUser;
    if (user.role !== "sysadmin")
      return NextResponse.json({ error: "Solo sysadmin puede reprocesar un pago" }, { status: 403 });

    const body = await req.json().catch(() => ({})) as { invoiceId?: string; reason?: string; codOper?: string };
    const invoiceId = body.invoiceId?.trim() ?? "";
    const reason     = body.reason?.trim()    ?? "";
    if (!invoiceId) return NextResponse.json({ error: "invoiceId es requerido" }, { status: 400 });
    if (!reason)    return NextResponse.json({ error: "El motivo de reproceso es obligatorio" }, { status: 400 });

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.gateway !== PaymentGateway.PAGUELOFACIL)
      return NextResponse.json({ error: "Factura de PagueloFacil no encontrada" }, { status: 404 });

    let tx = await prisma.pagueloFacilTransaction.findFirst({
      where:   { invoiceId },
      orderBy: { createdAt: "desc" },
    });
    if (!tx) return NextResponse.json({ error: "No hay transacción de PagueloFacil asociada a esta factura" }, { status: 404 });

    if (tx.status === PagueloFacilLinkStatus.USED) {
      return NextResponse.json({ error: "Esta factura ya está pagada — no requiere reproceso" }, { status: 400 });
    }

    // Antes se bloqueaba reprocesar un PENDING todavía vigente ("espera a que
    // expire") — pero el cliente puede haber pagado y el navegador nunca
    // volvió por el RETURN_URL (cerró la pestaña, el sandbox no redirigió,
    // etc.), dejando la factura huérfana sin forma de confirmarla hasta que
    // el link expirara. El sysadmin puede forzar la re-consulta contra
    // PagueloFacil en cualquier momento — siempre se verifica el estado real
    // (nunca se fuerza el estado a mano), así que no hay riesgo de marcar
    // como pagado algo que no lo esté.
    if (tx.status === PagueloFacilLinkStatus.PENDING) {
      // updateMany condicionado al status actual (no un update ciego por id)
      // para no pisar una confirmación real que el callback automático
      // (RETURN_URL) esté aplicando en paralelo justo en este momento. Si
      // perdemos la carrera, se relee el estado real en vez de asumir EXPIRED.
      await prisma.pagueloFacilTransaction.updateMany({
        where: { id: tx.id, status: PagueloFacilLinkStatus.PENDING },
        data:  { status: PagueloFacilLinkStatus.EXPIRED },
      });
      tx = await prisma.pagueloFacilTransaction.findUniqueOrThrow({ where: { id: tx.id } });
    }

    const codOper = body.codOper?.trim() || extractCodOper(tx.rawResponse);
    if (!codOper) {
      return NextResponse.json({
        error: "No hay código de operación (codOper) guardado para re-verificar. " +
               "Búscalo en el panel de PagueloFacil para esta transacción y provéelo en el campo codOper.",
      }, { status: 400 });
    }

    let real;
    try {
      real = await getTransactionByCodOper(codOper);
    } catch (err) {
      console.error("[pf-reprocess] getTransactionByCodOper error:", err);
      return NextResponse.json({ error: "No se pudo consultar el estado en PagueloFacil, intenta de nuevo" }, { status: 502 });
    }

    const outcome = await applyConfirmationResult(
      tx, real,
      { source: "manual_reprocess", actorUserId: user.id ?? null, actorEmail: user.email ?? null, reason },
      [PagueloFacilLinkStatus.FAILED, PagueloFacilLinkStatus.EXPIRED],
    );

    await logAudit({
      action: "PAGUELOFACIL_REPROCESS_REQUESTED", module: AUDIT_MODULE.SYSADMIN,
      resourceType: "Invoice", resourceId: invoiceId, dojoId: tx.dojoId,
      userId: user.id, userEmail: user.email,
      details: JSON.stringify({ reason, codOper, outcome }),
    });

    return NextResponse.json({ outcome });
  } catch (err) {
    console.error("POST /api/billing/admin/paguelofacil/reprocess error:", err);
    return NextResponse.json({ error: "Error al reprocesar el pago" }, { status: 500 });
  }
}
