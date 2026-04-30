import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

type SessionUser = { role?: string };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { role } = session.user as SessionUser;
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { to } = await req.json();
  if (!to) return NextResponse.json({ error: "Destinatario requerido" }, { status: 400 });

  const cfg = await prisma.emailSettings.findUnique({ where: { id: "singleton" } });

  const missing: string[] = [];
  if (!cfg?.host)     missing.push("Servidor SMTP (host)");
  if (!cfg?.user)     missing.push("Correo electrónico (FROM)");
  if (!cfg?.password) missing.push("Contraseña / Clave de aplicación");

  if (missing.length)
    return NextResponse.json({
      error: `Completa los siguientes campos antes de probar: ${missing.join(", ")}`,
    }, { status: 400 });

  try {
    const t = nodemailer.createTransport({
      host:   cfg!.host,
      port:   cfg!.port,
      secure: cfg!.secure,
      auth:   { user: cfg!.user, pass: decrypt(cfg!.password) },
    });
    await t.verify();
    await t.sendMail({
      from:    `"${cfg!.fromName}" <${cfg!.user}>`,
      to,
      subject: "✅ Prueba de conexión — Dojo Master",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#1A1A2E;color:#F0F0F0;border-radius:12px;overflow:hidden;">
          <div style="background:#C0392B;padding:20px 24px;text-align:center;">
            <h1 style="margin:0;font-size:20px;color:white;font-family:serif;letter-spacing:2px;">DOJO MASTER</h1>
          </div>
          <div style="padding:28px 24px;">
            <h2 style="color:#4ADE80;margin:0 0 12px;">✅ Conexión SMTP exitosa</h2>
            <p style="color:#C8D0DA;margin:0;">
              Si recibes este mensaje, la configuración SMTP de <strong>${cfg!.host}</strong> está funcionando correctamente.
            </p>
          </div>
        </div>`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
