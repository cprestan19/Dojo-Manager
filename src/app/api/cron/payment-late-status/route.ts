import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/payment-late-status — pasa a "late" los pagos "pending" que ya
// superaron los días de tolerancia configurados por cada dojo (reminderToleranceDays,
// default 5). Solo actualiza el status — no envía correos ni toca reminderSent,
// eso lo sigue haciendo el botón manual "Enviar recordatorios" (PATCH /api/payments).
// Protegido por Authorization: Bearer CRON_SECRET
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const dojos = await prisma.dojo.findMany({
      where:  { active: true },
      select: { id: true, reminderToleranceDays: true },
    });

    let updated = 0;
    for (const dojo of dojos) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (dojo.reminderToleranceDays ?? 5));

      const result = await prisma.payment.updateMany({
        where: {
          student:  { dojoId: dojo.id },
          status:   "pending",
          paidDate: null,
          dueDate:  { lte: cutoff },
        },
        data: { status: "late" },
      });
      updated += result.count;
    }

    return NextResponse.json({ ok: true, dojosChecked: dojos.length, updated });
  } catch (err) {
    console.error("[cron/payment-late-status] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
