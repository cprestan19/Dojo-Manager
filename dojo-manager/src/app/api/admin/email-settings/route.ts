import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { encrypt, decrypt, isEncrypted } from "@/lib/crypto";

type SessionUser = { role?: string };

async function guardSysadmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { role } = session.user as SessionUser;
  if (role !== "sysadmin") return NextResponse.json({ error: "Solo sysadmin" }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  const err = await guardSysadmin(req);
  if (err) return err;

  const cfg = await prisma.emailSettings.findUnique({ where: { id: "singleton" } });
  if (!cfg) return NextResponse.json({ id: "singleton", host: "", port: 587, user: "", password: "", secure: false, fromName: "DojoManager" });

  return NextResponse.json({ ...cfg, password: cfg.password ? "••••••••" : "" });
  // Nota: la contraseña nunca se retorna en texto plano al cliente
}

export async function PUT(req: NextRequest) {
  const err = await guardSysadmin(req);
  if (err) return err;

  const body = await req.json();

  const existing = await prisma.emailSettings.findUnique({ where: { id: "singleton" } });

  const data = {
    host:     String(body.host     ?? ""),
    port:     Number(body.port     ?? 587),
    user:     String(body.user     ?? ""),
    secure:   Boolean(body.secure  ?? false),
    fromName: String(body.fromName ?? "DojoManager"),
    password: body.password && body.password !== "••••••••"
      ? encrypt(String(body.password))
      : (existing?.password ?? ""),
  };

  const cfg = await prisma.emailSettings.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });

  return NextResponse.json({ ...cfg, password: "••••••••" });
}
