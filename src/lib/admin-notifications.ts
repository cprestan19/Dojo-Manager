import { sendEmail } from "@/lib/email";

const ADMIN_EMAIL = process.env.PLATFORM_OWNER_EMAIL ?? "soporte@dojomasteronline.com";

function wrap(title: string, rows: [string, string][], extra?: string): string {
  return `
    <div style="font-family:Arial,sans-serif;padding:24px;max-width:520px;background:#fff;border-radius:12px;border:1px solid #e5e5e5;">
      <h2 style="color:#C0392B;margin:0 0 16px;font-size:18px;">${title}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${rows.map(([k, v]) => `
          <tr>
            <td style="padding:7px 0;color:#888;font-weight:bold;width:130px;vertical-align:top;">${k}</td>
            <td style="padding:7px 0;color:#111;">${v ?? "—"}</td>
          </tr>`).join("")}
      </table>
      ${extra ? `<div style="margin-top:16px;padding:12px 16px;background:#fef2f2;border-radius:8px;font-size:13px;color:#7f1d1d;">${extra}</div>` : ""}
      <p style="margin:20px 0 0;font-size:11px;color:#bbb;">© Dojo Master — notificación automática del sistema</p>
    </div>`;
}

export async function notifyAdmin(subject: string, html: string): Promise<void> {
  try {
    await sendEmail({ to: ADMIN_EMAIL, subject, html });
  } catch (err) {
    console.error("[admin-notify] Failed to send:", subject, err);
  }
}

export function buildDojoCreatedEmail(dojoName: string, adminEmail: string, createdBy: string): string {
  return wrap("🏯 Nuevo dojo creado", [
    ["Dojo",      dojoName],
    ["Admin",     adminEmail],
    ["Creado por", createdBy],
    ["Fecha",     new Date().toLocaleString("es-PA", { timeZone: "America/Panama" })],
  ]);
}

export function buildDojoSelfRegisteredEmail(senseiName: string, dojoName: string, email: string, phone: string, country: string, studentCount: string): string {
  return wrap("🥋 Nuevo dojo auto-registrado", [
    ["Sensei",   senseiName],
    ["Dojo",     dojoName],
    ["Email",    email],
    ["WhatsApp", phone],
    ["País",     country],
    ["Alumnos",  studentCount],
    ["Fecha",    new Date().toLocaleString("es-PA", { timeZone: "America/Panama" })],
  ], `<strong>Acción recomendada:</strong> Contactar al sensei para ofrecer ayuda en la configuración.`);
}

export function buildStudentCreatedEmail(studentName: string, dojoName: string, dojoId: string, createdBy: string): string {
  return wrap("👤 Nuevo alumno dado de alta", [
    ["Alumno",     studentName],
    ["Dojo",       dojoName],
    ["Dojo ID",    dojoId],
    ["Creado por", createdBy],
    ["Fecha",      new Date().toLocaleString("es-PA", { timeZone: "America/Panama" })],
  ]);
}

export function buildStudentDeletedEmail(studentName: string, dojoName: string, deletedBy: string): string {
  return wrap("🗑️ Alumno eliminado", [
    ["Alumno",       studentName],
    ["Dojo",         dojoName],
    ["Eliminado por", deletedBy],
    ["Fecha",        new Date().toLocaleString("es-PA", { timeZone: "America/Panama" })],
  ]);
}

export function buildPasswordChangedEmail(userName: string, userEmail: string, dojoName: string | null): string {
  return wrap("🔐 Cambio de contraseña", [
    ["Usuario", userName],
    ["Email",   userEmail],
    ["Dojo",    dojoName ?? "Sistema global"],
    ["Fecha",   new Date().toLocaleString("es-PA", { timeZone: "America/Panama" })],
  ]);
}

export function buildPendingStudentEmail(studentName: string, dojoName: string, cedula: string, ip: string): string {
  return wrap("📋 Nueva solicitud de auto-registro", [
    ["Alumno",  studentName],
    ["Dojo",    dojoName],
    ["Cédula",  cedula],
    ["IP",      ip],
    ["Fecha",   new Date().toLocaleString("es-PA", { timeZone: "America/Panama" })],
  ], `Esta solicitud requiere aprobación del administrador del dojo.`);
}
