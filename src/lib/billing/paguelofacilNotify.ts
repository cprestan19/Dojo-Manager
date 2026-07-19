import prisma from "@/lib/prisma";
import { sendEmail, escHtml } from "@/lib/email";

async function getDojoAdminEmails(dojoId: string): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where:  { dojoId, role: "admin", active: true },
    select: { email: true },
  });
  return admins.map(a => a.email);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "long", year: "numeric" });
}

/** Enviado una sola vez, al activar un dojo nuevo — nunca menciona "gratis" ni "trial". */
export async function sendPagueloFacilWelcomeEmail(
  dojoId: string, planName: string, amount: number, firstChargeDate: Date,
): Promise<void> {
  const emails = await getDojoAdminEmails(dojoId);
  if (emails.length === 0) return;

  const html = `
    <p>Hola,</p>
    <p>Tu cuenta de DojoMasterOnline (plan <strong>${escHtml(planName)}</strong>) ya está activa.</p>
    <p>A partir del <strong>${fmtDate(firstChargeDate)}</strong> se generará el cobro de tu suscripción por
    <strong>US$ ${amount.toFixed(2)}</strong>, y te enviaremos a este correo el enlace para completarlo.</p>
  `;

  await Promise.allSettled(
    emails.map(to => sendEmail({ to, subject: "Bienvenido a DojoMasterOnline", html })),
  );
}

/** Notificación de cada renovación — enlace de pago para el ciclo vigente. */
export async function sendPagueloFacilPaymentLinkEmail(
  dojoId: string, planName: string, amount: number, payUrl: string,
): Promise<void> {
  const emails = await getDojoAdminEmails(dojoId);
  if (emails.length === 0) return;

  const html = `
    <p>Hola,</p>
    <p>Tu suscripción a DojoMasterOnline (plan <strong>${escHtml(planName)}</strong>) tiene un pago pendiente de
    <strong>US$ ${amount.toFixed(2)}</strong>.</p>
    <p><a href="${payUrl}">Pagar ahora con PagueloFacil</a></p>
    <p>Si el enlace expira, se generará uno nuevo automáticamente.</p>
  `;

  await Promise.allSettled(
    emails.map(to => sendEmail({ to, subject: "Pago pendiente — DojoMasterOnline", html })),
  );
}
