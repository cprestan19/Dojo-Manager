import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { encrypt, isEncrypted } from "@/lib/crypto";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string };

async function guardEmailAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }), session: null };
  const { role } = session.user as SessionUser;
  if (role !== "sysadmin")
    return { error: NextResponse.json({ error: "Sin permisos" }, { status: 403 }), session: null };
  return { error: null, session };
}

export async function GET(req: NextRequest) {
  const { error } = await guardEmailAdmin(req);
  if (error) return error;

  const cfg = await prisma.emailSettings.findUnique({ where: { id: "singleton" } });
  if (!cfg) return NextResponse.json({
    id: "singleton", host: "", port: 587, user: "",
    password: "", secure: false, fromName: "Dojo Master",
  });

  return NextResponse.json({ ...cfg, password: cfg.password ? "••••••••" : "" });
}

export async function PUT(req: NextRequest) {
  const { error, session } = await guardEmailAdmin(req);
  if (error) return error;

  const t0   = Date.now();
  const body = await req.json();

  const host = String(body.host ?? "").trim();
  const user = String(body.user ?? "").trim();

  if (host && !user)
    return NextResponse.json({ error: "El campo 'Correo electrónico (FROM)' es obligatorio" }, { status: 400 });

  const existing = await prisma.emailSettings.findUnique({ where: { id: "singleton" } });

  const rawPassword = body.password ?? "";
  let storedPassword: string;

  if (!rawPassword || rawPassword === "••••••••") {
    storedPassword = existing?.password ?? "";
  } else {
    storedPassword = isEncrypted(rawPassword) ? rawPassword : encrypt(rawPassword);
  }

  const passwordChanged = !(!rawPassword || rawPassword === "••••••••");

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

  const ctx = buildAuditCtx(session!, req, { startTime: t0 });
  await logAudit({
    ...ctx,
    action:       "EMAIL_SETTINGS_UPDATED",
    module:       AUDIT_MODULE.SETTINGS,
    resourceType: "EmailSettings",
    resourceId:   "singleton",
    statusCode:   200,
    details:      JSON.stringify({
      host,
      port:          Number(body.port ?? 587),
      user,
      secure:        Boolean(body.secure ?? false),
      fromName:      String(body.fromName ?? "").trim(),
      passwordChanged,
    }),
  });

  return NextResponse.json({ ...cfg, password: cfg.password ? "••••••••" : "" });
}
