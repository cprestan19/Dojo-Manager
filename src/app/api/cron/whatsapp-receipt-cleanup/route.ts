import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deleteFile } from "@/lib/imagekit";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

// Cuántos días se conserva el recibo PDF en ImageKit después de creado —
// tiempo de sobra para que WhatsApp lo entregue y el usuario lo abra; pasado
// esto ya no aporta (el mensaje sigue en el chat, solo el adjunto expira).
const RETENTION_DAYS = 30;

// GET /api/cron/whatsapp-receipt-cleanup — borra de ImageKit los recibos PDF
// de confirmacion_pago_dojomaster (folder "receipts") más viejos que
// RETENTION_DAYS y limpia receiptPublicId en WhatsAppNotification. No toca
// las filas en sí (templateVars.headerDocument.link queda como referencia
// histórica, aunque el archivo ya no exista).
// Protegido por Authorization: Bearer CRON_SECRET
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const pending = await prisma.whatsAppNotification.findMany({
      where: { receiptPublicId: { not: null }, createdAt: { lte: cutoff } },
      select: { id: true, receiptPublicId: true },
    });

    let deleted = 0;
    let failed  = 0;

    for (const row of pending) {
      try {
        // receiptPublicId siempre no-null acá (filtrado en el where), el
        // "as string" evita el narrowing que Prisma no infiere del select.
        await deleteFile(row.receiptPublicId as string);
        await prisma.whatsAppNotification.update({
          where: { id: row.id },
          data:  { receiptPublicId: null },
        });
        deleted++;
      } catch (err) {
        // No bloquea el resto del batch — se reintenta en la próxima corrida.
        console.error("[cron/whatsapp-receipt-cleanup] error borrando recibo:", row.id, err);
        failed++;
      }
    }

    if (deleted > 0 || failed > 0) {
      await logAudit({
        action: "WHATSAPP_RECEIPT_CLEANUP", module: AUDIT_MODULE.WHATSAPP,
        resourceType: "WhatsAppNotification", statusCode: 200,
        details: JSON.stringify({ checked: pending.length, deleted, failed }),
      });
    }

    return NextResponse.json({ ok: true, checked: pending.length, deleted, failed });
  } catch (err) {
    console.error("[cron/whatsapp-receipt-cleanup] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
