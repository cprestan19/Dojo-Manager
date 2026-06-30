import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { SubscriptionStatus } from "@prisma/client";
import { sendEmail } from "@/lib/email";

const PANAMA_TZ = "America/Panama";

function panamaDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PANAMA_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("es-PA", {
    timeZone: PANAMA_TZ, day: "2-digit", month: "long", year: "numeric",
  }).format(d);
}

function buildEmailHtml(dojoName: string, daysLeft: number, endsAt: Date): string {
  const expiryStr = formatDate(endsAt);
  const urgency   = daysLeft === 0 ? "hoy" : daysLeft === 1 ? "mañana" : `en ${daysLeft} días`;
  const color     = daysLeft === 0 ? "#CC0000" : daysLeft === 1 ? "#e67e22" : "#f39c12";

  return `<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;padding:20px 0;">
<tr><td>
<table width="600" cellpadding="0" cellspacing="0" align="center"
       style="background:#1a1a1a;border-radius:12px;overflow:hidden;max-width:600px;">
  <tr><td style="background:${color};padding:24px 32px;text-align:center;">
    <p style="margin:0;color:#fff;font-size:11px;letter-spacing:3px;text-transform:uppercase;">DojoManager</p>
    <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800;">⚠️ Acceso especial por vencer</h1>
  </td></tr>
  <tr><td style="padding:28px 32px;">
    <p style="color:#ddd;font-size:15px;margin:0 0 16px;">Hola, <strong>${dojoName}</strong>:</p>
    <p style="color:#ddd;font-size:15px;margin:0 0 20px;">
      Tu acceso especial a DojoManager <strong style="color:${color};">vence ${urgency}</strong> (${expiryStr}).
    </p>
    <div style="background:#2a2a00;border-left:4px solid ${color};padding:14px 18px;border-radius:6px;margin-bottom:20px;">
      <p style="margin:0;color:#FFD700;font-size:14px;font-weight:700;">
        ${daysLeft === 0
          ? "🔴 Tu acceso expira hoy. Contacta al administrador para renovarlo."
          : daysLeft === 1
            ? "🟠 Te queda 1 día de acceso. Contacta al administrador para renovarlo."
            : `🟡 Te quedan ${daysLeft} días. Contacta al administrador si necesitas más tiempo.`
        }
      </p>
    </div>
    <p style="color:#aaa;font-size:13px;margin:0;">
      Comunícate con el equipo de soporte de DojoManager para renovar tu acceso.
    </p>
  </td></tr>
  <tr><td style="padding:14px 32px;text-align:center;border-top:1px solid #333;">
    <p style="margin:0;color:#555;font-size:10px;">DojoManager — Sistema de gestión de dojos</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// GET /api/cron/notify-expiring-access
// Envía correo diario a dojos SPECIAL_ACCESS que vencen en ≤ 2 días.
// Protegido por x-cron-secret o ?secret=
export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("x-cron-secret")
      ?? req.nextUrl.searchParams.get("secret");

    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now    = new Date();
    const cutoff = new Date(now.getTime() + 2 * 86_400_000);

    const subs = await prisma.subscription.findMany({
      where: {
        status:      SubscriptionStatus.SPECIAL_ACCESS,
        trialEndsAt: { lte: cutoff },
      },
      include: {
        dojo: {
          select: {
            id:    true,
            name:  true,
            users: { where: { role: "admin" }, select: { email: true } },
          },
        },
      },
    });

    const todayPA = panamaDay(now);
    let sent = 0, skipped = 0;

    for (const sub of subs) {
      const dojo     = sub.dojo;
      const daysLeft = Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / 86_400_000));
      const emails   = dojo.users.map(u => u.email).filter(Boolean);

      if (emails.length === 0) { skipped++; continue; }

      // Un solo correo por dojo por día (hora Panamá)
      const alreadySentToday = await prisma.specialAccessEmailLog.findFirst({
        where: {
          dojoId: dojo.id,
          status: "sent",
          sentAt: {
            gte: new Date(`${todayPA}T00:00:00-05:00`),
            lt:  new Date(`${todayPA}T23:59:59-05:00`),
          },
        },
      });

      if (alreadySentToday) { skipped++; continue; }

      const subject = `⚠️ Tu acceso especial vence ${
        daysLeft === 0 ? "hoy" : daysLeft === 1 ? "mañana" : `en ${daysLeft} días`
      } — ${dojo.name}`;
      const html = buildEmailHtml(dojo.name, daysLeft, sub.trialEndsAt);

      let emailError: string | undefined;
      for (const email of emails) {
        try {
          await sendEmail({ to: email, subject, html });
        } catch (err) {
          emailError = err instanceof Error ? err.message : String(err);
        }
      }

      await prisma.specialAccessEmailLog.create({
        data: {
          dojoId:   dojo.id,
          email:    emails.join(", "),
          daysLeft,
          status:   emailError ? "failed" : "sent",
          error:    emailError ?? null,
        },
      });

      if (emailError) { skipped++; } else { sent++; }
    }

    return NextResponse.json({ ok: true, sent, skipped, total: subs.length });
  } catch (err) {
    console.error("[cron/notify-expiring-access] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
