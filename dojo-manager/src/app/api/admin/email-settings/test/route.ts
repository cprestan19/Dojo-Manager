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
  if (role !== "sysadmin") return NextResponse.json({ error: "Solo sysadmin" }, { status: 403 });

  const { to } = await req.json();
  if (!to) return NextResponse.json({ error: "Destinatario requerido" }, { status: 400 });

  const cfg = await prisma.emailSettings.findUnique({ where: { id: "singleton" } });
  if (!cfg?.host || !cfg?.user || !cfg?.password)
    return NextResponse.json({ error: "Configure el servidor SMTP primero" }, { status: 400 });

  try {
    const t = nodemailer.createTransport({
      host:   cfg.host,
      port:   cfg.port,
      secure: cfg.secure,
      auth:   { user: cfg.user, pass: decrypt(cfg.password) },
    });
    await t.verify();
    await t.sendMail({
      from:    `"${cfg.fromName}" <${cfg.user}>`,
      to,
      subject: "✅ Prueba de conexión — DojoManager",
      text:    "Si recibes este mensaje, la configuración SMTP está funcionando correctamente.",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
