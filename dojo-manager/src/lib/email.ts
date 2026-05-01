/**
 * Módulo: Envío de correos electrónicos
 * Desarrollado por Cristhian Paul Prestán — 2025
 */
import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

async function createTransporter() {
  try {
    const cfg = await prisma.emailSettings.findUnique({ where: { id: "singleton" } });
    if (cfg?.host && cfg?.user && cfg?.password) {
      const plainPassword = decrypt(cfg.password);
      return nodemailer.createTransport({
        host:   cfg.host,
        port:   cfg.port,
        secure: cfg.secure,
        auth:   { user: cfg.user, pass: plainPassword },
      });
    }
  } catch { /* fall through to env vars */ }
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST,
    port:   Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

function fromAddress(dojo?: DojoMeta) {
  if (dojo?.email) return `"${dojo.name}" <${dojo.email}>`;
  return process.env.EMAIL_FROM ?? "Dojo Master <noreply@dojomaster.com>";
}

interface DojoMeta {
  name:      string;
  email?:    string | null;
  logo?:     string | null;
  phone?:    string | null;
  slogan?:   string | null;
  ownerName?: string | null;
}

function dojoHeader(dojo?: DojoMeta) {
  if (!dojo) {
    return `
      <div style="background:#C0392B;padding:24px;text-align:center;">
        <h1 style="margin:0;font-size:22px;color:white;font-family:serif;letter-spacing:4px;">DOJO MASTER</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Sistema de Administración de Karate</p>
      </div>`;
  }

  // Only embed Cloudinary URLs — never base64 (breaks email size limits on Gmail/SMTP).
  const logoUrl  = dojo.logo?.startsWith("http") ? dojo.logo : null;
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${dojo.name}" style="width:56px;height:56px;object-fit:contain;border-radius:10px;background:#fff;" />`
    : `<div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:bold;color:#fff;">${dojo.name[0]}</div>`;

  return `
    <div style="background:#C0392B;padding:20px 24px;display:flex;align-items:center;gap:16px;">
      ${logoHtml}
      <div>
        <h1 style="margin:0;font-size:20px;color:white;font-family:serif;letter-spacing:2px;">${dojo.name}</h1>
        ${dojo.slogan ? `<p style="margin:3px 0 0;color:rgba(255,255,255,0.85);font-size:12px;font-style:italic;">${dojo.slogan}</p>` : ""}
        ${dojo.phone  ? `<p style="margin:3px 0 0;color:rgba(255,255,255,0.7);font-size:11px;">📞 ${dojo.phone}</p>` : ""}
      </div>
    </div>`;
}

function emailFooter(dojo?: DojoMeta) {
  const dojoLine = dojo
    ? `${dojo.name}${dojo.ownerName ? " · " + dojo.ownerName : ""}${dojo.phone ? " · " + dojo.phone : ""}`
    : "Dojo Master";
  return `
    <div style="padding:20px 24px;background:#0F0F1A;border-top:1px solid #2A3550;">
      <p style="color:#8892A4;font-size:11px;margin:0;text-align:center;">
        ${dojoLine}<br/>
        <span style="font-size:10px;">Mensaje automático · No responda a este correo · Desarrollado por Dojo Master</span>
      </p>
    </div>`;
}

export async function sendPaymentReminder({
  to, studentName, guardianName, amount, dueDate, daysLate,
  toleranceDays = 5, interestPct = 10, dojo,
}: {
  to:            string;
  studentName:   string;
  guardianName?: string;
  amount:        number;
  dueDate:       string;
  daysLate:      number;
  toleranceDays?: number;
  interestPct?:   number;
  dojo?:         DojoMeta;
}) {
  const greeting = guardianName
    ? `Estimado/a <strong>${guardianName}</strong>, padre/tutor de <strong>${studentName}</strong>`
    : `Estimado padre / tutor de <strong>${studentName}</strong>`;

  const lateBlock = daysLate > 0
    ? `<p style="margin:0 0 16px;color:#C8D0DA;">
         Su pago presenta <strong style="color:#E74C3C;">${daysLate} día(s) de atraso</strong>.
       </p>`
    : `<p style="margin:0 0 16px;color:#C8D0DA;">Su pago está próximo a vencer.</p>`;

  const recargoMonto = ((amount * interestPct) / 100).toFixed(2);

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1A1A2E;color:#F0F0F0;border-radius:12px;overflow:hidden;">
      ${dojoHeader(dojo)}
      <div style="padding:32px 24px;">
        <h2 style="color:#E74C3C;margin:0 0 16px;font-size:18px;">⚠️ Recordatorio de Pago Pendiente</h2>
        <p style="font-size:15px;margin:0 0 12px;">${greeting},</p>
        <p style="margin:0 0 8px;color:#C8D0DA;">
          Le recordamos que tiene un pago pendiente de mensualidad de karate que requiere su atención.
        </p>
        ${lateBlock}

        <div style="background:#16213E;border:1px solid #2A3550;border-radius:8px;padding:20px;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#8892A4;font-size:13px;">Alumno</td>
                <td style="padding:6px 0;font-weight:bold;text-align:right;">${studentName}</td></tr>
            <tr><td style="padding:6px 0;color:#8892A4;font-size:13px;">Monto</td>
                <td style="padding:6px 0;font-weight:bold;color:#F39C12;text-align:right;">$${amount.toFixed(2)}</td></tr>
            <tr><td style="padding:6px 0;color:#8892A4;font-size:13px;">Fecha de vencimiento</td>
                <td style="padding:6px 0;text-align:right;">${dueDate}</td></tr>
          </table>
        </div>

        <div style="background:#1C2A14;border:1px solid #2E5C14;border-radius:8px;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 8px;color:#7FD44A;font-weight:bold;font-size:14px;">📅 Recuerde:</p>
          <p style="margin:0 0 6px;color:#C8D0DA;font-size:13px;">
            El pago debe cancelarse <strong>dentro de los primeros ${toleranceDays} días</strong> del vencimiento para evitar recargos.
          </p>
          <p style="margin:0;color:#E74C3C;font-size:13px;">
            Después de ese plazo se aplicará un recargo del <strong>${interestPct}%</strong>
            sobre la mensualidad (<strong>+$${recargoMonto}</strong>).
          </p>
        </div>

        <p style="color:#C8D0DA;margin:0;font-size:13px;">
          Para mayor información comuníquese directamente con el dojo.
        </p>
      </div>
      ${emailFooter(dojo)}
    </div>`;

  const subject = dojo
    ? `📋 Recordatorio de pago – ${studentName} – ${dojo.name}`
    : `📋 Recordatorio de pago – ${studentName} – Dojo Master`;

  const t = await createTransporter();
  await t.sendMail({ from: fromAddress(dojo), to, subject, html });
}

export async function sendPaymentReceipt({
  to, guardianName, studentName, studentCode, receiptNo,
  amount, paidDate, concept, dojo,
}: {
  to:           string;
  guardianName?: string;
  studentName:  string;
  studentCode:  number | null;
  receiptNo:    string;
  amount:       number;
  paidDate:     string;
  concept:      string;
  dojo?:        DojoMeta;
}) {
  const greeting = guardianName
    ? `Estimado/a <strong>${guardianName}</strong>`
    : "Estimado padre / tutor";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1A1A2E;color:#F0F0F0;border-radius:12px;overflow:hidden;">
      ${dojoHeader(dojo)}
      <div style="padding:32px 24px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h2 style="color:#F0F0F0;margin:0 0 4px;font-size:20px;letter-spacing:3px;font-family:serif;">RECIBO DE PAGO</h2>
          <p style="color:#8892A4;font-size:12px;margin:0;letter-spacing:1px;">N.º ${receiptNo}</p>
        </div>

        <p style="font-size:14px;margin:0 0 8px;">${greeting},</p>
        <p style="color:#C8D0DA;font-size:13px;margin:0 0 20px;">
          Se confirma el siguiente pago realizado:
        </p>

        <div style="background:#16213E;border:1px solid #2A3550;border-radius:8px;padding:20px;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;color:#8892A4;font-size:13px;">Alumno</td>
              <td style="padding:6px 0;font-weight:bold;text-align:right;">${studentName}</td>
            </tr>
            ${studentCode ? `
            <tr>
              <td style="padding:6px 0;color:#8892A4;font-size:13px;">Código</td>
              <td style="padding:6px 0;text-align:right;font-family:monospace;color:#F0F0F0;">#${studentCode}</td>
            </tr>` : ""}
            <tr>
              <td style="padding:6px 0;color:#8892A4;font-size:13px;">Concepto</td>
              <td style="padding:6px 0;text-align:right;">${concept}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#8892A4;font-size:13px;">Fecha de pago</td>
              <td style="padding:6px 0;text-align:right;">${paidDate}</td>
            </tr>
          </table>
        </div>

        <div style="background:#0D3B1F;border:2px solid #16A34A;border-radius:10px;padding:24px;text-align:center;margin-bottom:20px;">
          <p style="color:#86EFAC;font-size:11px;margin:0 0 6px;text-transform:uppercase;letter-spacing:2px;">Total Pagado</p>
          <p style="color:#4ADE80;font-size:32px;font-weight:bold;margin:0 0 12px;font-family:serif;">$${amount.toFixed(2)}</p>
          <span style="display:inline-block;background:#16A34A;color:#fff;padding:5px 20px;border-radius:20px;font-size:13px;font-weight:bold;letter-spacing:1px;">
            ✓ PAGADO
          </span>
        </div>

        <p style="color:#8892A4;font-size:11px;text-align:center;margin:0;">
          Guarde este correo como comprobante de pago.
        </p>
      </div>
      ${emailFooter(dojo)}
    </div>`;

  const subject = dojo
    ? `📄 Recibo de pago – ${studentName} – ${dojo.name}`
    : `📄 Recibo de pago – ${studentName}`;

  const t = await createTransporter();
  await t.sendMail({ from: fromAddress(dojo), to, subject, html });
}

export async function sendStudentWelcome({
  to, studentName, loginEmail, tempPassword, dojo,
}: {
  to:           string;
  studentName:  string;
  loginEmail:   string;
  tempPassword: string;
  dojo?:        DojoMeta;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dojomasteronline.com";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1A1A2E;color:#F0F0F0;border-radius:12px;overflow:hidden;">
      ${dojoHeader(dojo)}
      <div style="padding:32px 24px;">
        <h2 style="color:#F0F0F0;margin:0 0 16px;font-size:20px;">¡Bienvenido/a al Portal del Alumno!</h2>
        <p style="font-size:15px;margin:0 0 12px;">Hola <strong>${studentName}</strong>,</p>
        <p style="color:#C8D0DA;font-size:13px;margin:0 0 20px;">
          Se ha creado tu acceso al portal del alumno. Usa las siguientes credenciales para ingresar:
        </p>
        <div style="background:#16213E;border:1px solid #2A3550;border-radius:8px;padding:20px;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#8892A4;font-size:13px;">URL de acceso</td>
              <td style="padding:8px 0;text-align:right;">
                <a href="${appUrl}/login" style="color:#E74C3C;">${appUrl}/login</a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#8892A4;font-size:13px;">Correo</td>
              <td style="padding:8px 0;font-family:monospace;text-align:right;">${loginEmail}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#8892A4;font-size:13px;">Contraseña temporal</td>
              <td style="padding:8px 0;font-family:monospace;font-size:16px;font-weight:bold;color:#F39C12;text-align:right;">${tempPassword}</td>
            </tr>
          </table>
        </div>
        <div style="background:#1C2A14;border:1px solid #2E5C14;border-radius:8px;padding:14px;margin-bottom:20px;">
          <p style="margin:0;color:#7FD44A;font-size:13px;">
            ⚠️ <strong>Al ingresar por primera vez deberás cambiar tu contraseña.</strong>
          </p>
        </div>
        <p style="color:#8892A4;font-size:12px;text-align:center;margin:0;">
          Si no solicitaste este acceso, ignora este correo.
        </p>
      </div>
      ${emailFooter(dojo)}
    </div>`;

  const subject = dojo ? `🎓 Acceso al Portal — ${dojo.name}` : `🎓 Acceso al Portal — Dojo Master`;
  const t = await createTransporter();
  await t.sendMail({ from: fromAddress(dojo), to, subject, html });
}

export async function sendUserWelcome({
  to, name, loginEmail, tempPassword, roleLabel, dojo,
}: {
  to:           string;
  name:         string;
  loginEmail:   string;
  tempPassword: string;
  roleLabel:    string;
  dojo?:        DojoMeta;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dojomasteronline.com";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1A1A2E;color:#F0F0F0;border-radius:12px;overflow:hidden;">
      ${dojoHeader(dojo)}
      <div style="padding:32px 24px;">
        <h2 style="color:#F0F0F0;margin:0 0 8px;font-size:20px;">¡Bienvenido/a, ${name}!</h2>
        <p style="color:#C8D0DA;font-size:13px;margin:0 0 20px;">
          Se ha creado tu cuenta de acceso al sistema de gestión${dojo ? ` de <strong>${dojo.name}</strong>` : ""}.
          A continuación encontrarás tus credenciales de ingreso.
        </p>

        <div style="background:#16213E;border:1px solid #2A3550;border-radius:8px;padding:20px;margin-bottom:20px;">
          <p style="margin:0 0 14px;color:#8892A4;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Datos de acceso</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#8892A4;font-size:13px;">Portal</td>
              <td style="padding:8px 0;text-align:right;">
                <a href="${appUrl}/login" style="color:#E74C3C;font-size:13px;">${appUrl}/login</a>
              </td>
            </tr>
            <tr style="border-top:1px solid #2A3550;">
              <td style="padding:8px 0;color:#8892A4;font-size:13px;">Correo electrónico</td>
              <td style="padding:8px 0;font-family:monospace;font-size:13px;text-align:right;color:#F0F0F0;">${loginEmail}</td>
            </tr>
            <tr style="border-top:1px solid #2A3550;">
              <td style="padding:8px 0;color:#8892A4;font-size:13px;">Contraseña temporal</td>
              <td style="padding:8px 0;text-align:right;">
                <span style="font-family:monospace;font-size:18px;font-weight:bold;color:#F39C12;background:#2A2000;padding:4px 12px;border-radius:6px;">${tempPassword}</span>
              </td>
            </tr>
            <tr style="border-top:1px solid #2A3550;">
              <td style="padding:8px 0;color:#8892A4;font-size:13px;">Rol asignado</td>
              <td style="padding:8px 0;text-align:right;">
                <span style="background:#1E3A5F;color:#60A5FA;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:bold;">${roleLabel}</span>
              </td>
            </tr>
          </table>
        </div>

        <div style="background:#1C1A0A;border:1px solid #5C4A00;border-radius:8px;padding:16px;margin-bottom:20px;">
          <p style="margin:0;color:#FCD34D;font-size:13px;font-weight:bold;">⚠️ Importante — Primer inicio de sesión</p>
          <p style="margin:8px 0 0;color:#C8D0DA;font-size:13px;">
            Al ingresar por primera vez, el sistema te pedirá que <strong>cambies esta contraseña temporal</strong>
            por una de tu elección. Guarda esta información en un lugar seguro hasta entonces.
          </p>
        </div>

        <p style="color:#8892A4;font-size:11px;text-align:center;margin:0;">
          Si no esperabas este correo, contáctanos de inmediato.<br/>
          No compartas estas credenciales con nadie.
        </p>
      </div>
      ${emailFooter(dojo)}
    </div>`;

  const subject = dojo
    ? `🔑 Acceso creado — ${dojo.name}`
    : "🔑 Tu acceso a Dojo Master";

  const t = await createTransporter();
  await t.sendMail({ from: fromAddress(dojo), to, subject, html });
}

export async function sendPasswordReset({
  to, name, resetUrl, dojo,
}: {
  to:       string;
  name:     string;
  resetUrl: string;
  dojo?:    DojoMeta;
}) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1A1A2E;color:#F0F0F0;border-radius:12px;overflow:hidden;">
      ${dojoHeader(dojo)}
      <div style="padding:32px 24px;">
        <h2 style="color:#F0F0F0;margin:0 0 16px;font-size:20px;">Restablecer contraseña</h2>
        <p style="font-size:15px;margin:0 0 12px;">Hola <strong>${name}</strong>,</p>
        <p style="color:#C8D0DA;font-size:13px;margin:0 0 24px;">
          Recibimos una solicitud para restablecer tu contraseña. El enlace expira en <strong>30 minutos</strong>.
        </p>
        <div style="text-align:center;margin-bottom:24px;">
          <a href="${resetUrl}"
            style="display:inline-block;background:#C0392B;color:#fff;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:bold;text-decoration:none;">
            Restablecer contraseña
          </a>
        </div>
        <p style="color:#8892A4;font-size:11px;text-align:center;margin:0;">
          Si no solicitaste este cambio, ignora este correo.
        </p>
      </div>
      ${emailFooter(dojo)}
    </div>`;

  const subject = "🔐 Restablecer contraseña — Dojo Master";
  const t = await createTransporter();
  await t.sendMail({ from: fromAddress(dojo), to, subject, html });
}
