import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST,
  port:   Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendPaymentReminder({
  to,
  studentName,
  amount,
  dueDate,
  daysLate,
}: {
  to: string;
  studentName: string;
  amount: number;
  dueDate: string;
  daysLate: number;
}) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1A1A2E; color: #F0F0F0; border-radius: 12px; overflow: hidden;">
      <div style="background: #C0392B; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; color: white;">⚠️ Aviso de Pago Pendiente</h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8);">DojoManager – Sistema de Karate</p>
      </div>
      <div style="padding: 32px;">
        <p style="font-size: 16px;">Estimado padre/tutor de <strong>${studentName}</strong>,</p>
        <p>Le informamos que existe un pago pendiente con <strong>${daysLate} día(s) de atraso</strong>.</p>
        <div style="background: #16213E; border: 1px solid #2A3550; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px;"><strong>Alumno:</strong> ${studentName}</p>
          <p style="margin: 0 0 8px;"><strong>Monto:</strong> $${amount.toFixed(2)}</p>
          <p style="margin: 0;"><strong>Fecha de vencimiento:</strong> ${dueDate}</p>
        </div>
        <p>Por favor regularice su situación a la brevedad posible.</p>
        <p style="color: #8892A4; font-size: 12px; margin-top: 32px;">
          Este es un mensaje automático del sistema DojoManager. Por favor no responda a este correo.
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: `⚠️ Pago atrasado – ${studentName} – DojoManager`,
    html,
  });
}
