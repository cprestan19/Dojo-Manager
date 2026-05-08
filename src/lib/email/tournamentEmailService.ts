import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

const PANAMA_TZ = "America/Panama";

function formatPanamaDate(date: Date | null | undefined): string {
  if (!date) return "Por confirmar";
  return new Intl.DateTimeFormat("es-PA", {
    timeZone: PANAMA_TZ,
    day:      "2-digit",
    month:    "2-digit",
    year:     "numeric",
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   true,
  }).format(date);
}

/** Crea un transporter SMTP replicando el patrón de src/lib/email.ts */
async function makeTransporter() {
  try {
    const cfg = await prisma.emailSettings.findUnique({ where: { id: "singleton" } });
    if (cfg?.host && cfg?.user && cfg?.password) {
      const pass = decrypt(cfg.password);
      return {
        transporter: nodemailer.createTransport({
          host: cfg.host, port: cfg.port, secure: cfg.secure,
          auth: { user: cfg.user, pass },
        }),
        from: `"${cfg.fromName || "Dojo Master"}" <${cfg.user}>`,
      };
    }
  } catch { /* fallback */ }

  const user = process.env.EMAIL_USER ?? "";
  return {
    transporter: nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: { user, pass: process.env.EMAIL_PASS },
    }),
    from: process.env.EMAIL_FROM ?? `"Dojo Master" <${user}>`,
  };
}

function buildEmailHtml(params: {
  tournamentName: string;
  dojoName:       string;
  date:           Date;
  location:       string;
  brackets: Array<{ name: string; tatami: number | null; scheduledAt: Date | null }>;
}): string {
  const { tournamentName, dojoName, date, location, brackets } = params;

  const bracketRows = brackets.map(b => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #333;color:#ddd;font-size:13px;">${b.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #333;text-align:center;color:#ddd;font-size:13px;">
        ${b.tatami ? `Tatami ${b.tatami}` : "—"}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #333;color:#ddd;font-size:13px;">
        ${formatPanamaDate(b.scheduledAt)}
      </td>
    </tr>`).join("");

  return `
<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;padding:20px 0;">
<tr><td>
<table width="600" cellpadding="0" cellspacing="0" align="center"
       style="background:#1a1a1a;border-radius:12px;overflow:hidden;max-width:600px;">

  <tr><td style="background:#CC0000;padding:24px 32px;text-align:center;">
    <p style="margin:0;color:#fff;font-size:11px;letter-spacing:3px;text-transform:uppercase;">${dojoName}</p>
    <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800;">🥋 ${tournamentName}</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Programa Oficial Confirmado</p>
  </td></tr>

  <tr><td style="padding:20px 32px;">
    <table width="100%">
      <tr>
        <td style="padding:4px 0;">
          <span style="color:#aaa;font-size:11px;text-transform:uppercase;">Fecha</span><br>
          <span style="color:#fff;font-size:15px;">${formatPanamaDate(date)}</span>
        </td>
        <td style="padding:4px 0;">
          <span style="color:#aaa;font-size:11px;text-transform:uppercase;">Lugar</span><br>
          <span style="color:#fff;font-size:15px;">${location}</span>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 32px 20px;">
    <p style="color:#FFD700;font-size:11px;font-weight:700;letter-spacing:2px;
              text-transform:uppercase;margin:0 0 10px;">Programa por Categoría</p>
    <table width="100%" style="border-collapse:collapse;background:#222;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#333;">
          <th style="padding:9px 12px;color:#aaa;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:1px;">Categoría</th>
          <th style="padding:9px 12px;color:#aaa;font-size:10px;text-align:center;text-transform:uppercase;letter-spacing:1px;">Tatami</th>
          <th style="padding:9px 12px;color:#aaa;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:1px;">Horario</th>
        </tr>
      </thead>
      <tbody>${bracketRows}</tbody>
    </table>
  </td></tr>

  <tr><td style="padding:0 32px 20px;">
    <div style="background:#2a2a00;border-left:3px solid #FFD700;padding:10px 14px;border-radius:4px;">
      <p style="margin:0;color:#FFD700;font-size:13px;">
        ⏰ Presentarse <strong>30 minutos antes</strong> del horario indicado para pesaje y acreditación.
      </p>
    </div>
  </td></tr>

  <tr><td style="padding:14px 32px;text-align:center;border-top:1px solid #333;">
    <p style="margin:0;color:#555;font-size:10px;">${dojoName} — DojoManager</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

/** Envía correos de confirmación del torneo a todos los participantes (async, no bloquea). */
export async function sendTournamentConfirmationEmails(tournamentId: string): Promise<void> {
  try {
    // Queries separadas para evitar problemas de inferencia de tipos con include múltiple
    const tournament = await prisma.tournament.findUnique({
      where:  { id: tournamentId },
      select: {
        name: true, date: true, location: true, dojoId: true,
      },
    });
    if (!tournament) return;

    const dojo = await prisma.dojo.findUnique({
      where:  { id: tournament.dojoId },
      select: { name: true },
    });

    const brackets = await prisma.tournamentBracket.findMany({
      where:   { tournamentId },
      orderBy: { order: "asc" },
      select:  { name: true },
    });

    const participants = await prisma.tournamentParticipant.findMany({
      where:   { tournamentId },
      include: {
        student: {
          select: {
            motherEmail: true,
            fatherEmail: true,
            portalUser:  { select: { email: true } },
          },
        },
      },
    });

    // Recopilar emails únicos
    const emailSet = new Set<string>();
    for (const p of participants) {
      const s = p.student;
      if (s.portalUser?.email) emailSet.add(s.portalUser.email);
      if (s.motherEmail)       emailSet.add(s.motherEmail);
      if (s.fatherEmail)       emailSet.add(s.fatherEmail);
    }

    if (emailSet.size === 0) return;

    const { transporter, from } = await makeTransporter();
    const subject = `🥋 ${tournament.name} — Programa Oficial Confirmado`;
    const html    = buildEmailHtml({
      tournamentName: tournament.name,
      dojoName:       dojo?.name ?? "Dojo",
      date:           tournament.date,
      location:       tournament.location,
      brackets:       brackets.map(b => ({
        name:        b.name,
        tatami:      null as number | null,
        scheduledAt: null as Date | null,
      })),
    });

    for (const email of emailSet) {
      try {
        await transporter.sendMail({ from, to: email, subject, html });
        await prisma.tournamentEmailLog.create({
          data: { tournamentId, email, status: "sent" },
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        await prisma.tournamentEmailLog.create({
          data: { tournamentId, email, status: "failed", error },
        });
      }
    }
  } catch (err) {
    console.error("[sendTournamentConfirmationEmails] Error:", err);
  }
}
