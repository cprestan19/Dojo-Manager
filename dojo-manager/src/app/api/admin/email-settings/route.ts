import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { encrypt, isEncrypted } from "@/lib/crypto";

type SessionUser = { role?: string };

async function guardEmailAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { role } = session.user as SessionUser;
  if (role !== "sysadmin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  const err = await guardEmailAdmin(req);
  if (err) return err;

  const cfg = await prisma.emailSettings.findUnique({ where: { id: "singleton" } });
  if (!cfg) return NextResponse.json({
    id: "singleton", host: "", port: 587, user: "",
    password: "", secure: false, fromName: "Dojo Master",
  });

  return NextResponse.json({ ...cfg, password: cfg.password ? "••••••••" : "" });
}

export async function PUT(req: NextRequest) {
  const err = await guardEmailAdmin(req);
  if (err) return err;

  const body = await req.json();

  const host = String(body.host ?? "").trim();
  const user = String(body.user ?? "").trim();

  if (host && !user)
    return NextResponse.json({ error: "El campo 'Correo electrónico (FROM)' es obligatorio" }, { status: 400 });

  const existing = await prisma.emailSettings.findUnique({ where: { id: "singleton" } });

  const rawPassword = body.password ?? "";
  let storedPassword: string;

  if (!rawPassword || rawPassword === "••••••••") {
    // Keep existing encrypted password
    storedPassword = existing?.password ?? "";
  } else {
    // New password: encrypt it (but don't double-encrypt)
    storedPassword = isEncrypted(rawPassword) ? rawPassword : encrypt(rawPassword);
  }

  const cfg = await prisma.emailSettings.upsert({
    where:  { id: "singleton" },
    create: {
      id:       "singleton",
      host,
      port:     Number(body.port ?? 587),
      user,
      secure:   Boolean(body.secure ?? false),
      fromName: String(body.fromName ?? "Dojo Master").trim() || "Dojo Master",
      password: storedPassword,
    },
    update: {
      host,
      port:     Number(body.port ?? 587),
      user,
      secure:   Boolean(body.secure ?? false),
      fromName: String(body.fromName ?? "Dojo Master").trim() || "Dojo Master",
      password: storedPassword,
    },
  });

  return NextResponse.json({ ...cfg, password: cfg.password ? "••••••••" : "" });
}
