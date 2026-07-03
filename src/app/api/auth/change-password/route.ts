import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";
import { notifyAdmin, buildPasswordChangedEmail, buildFirstPortalAccessEmail } from "@/lib/admin-notifications";

type SessionUser = { id?: string; email?: string; dojoId?: string | null; mustChangePassword?: boolean; role?: string };

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: userId, email, dojoId, mustChangePassword, role } = session.user as SessionUser;
  const body = await req.json();
  const { currentPassword, newPassword } = body as { currentPassword: string; newPassword: string };

  if (!currentPassword || !newPassword)
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });

  if (newPassword.length < 8)
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 400 });

  const hashed = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data:  { password: hashed, mustChangePassword: false },
  });

  const ip      = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
               ?? req.headers.get("x-real-ip")
               ?? "unknown";
  const country = req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? null;
  const city    = req.headers.get("x-vercel-ip-city")    ?? null;
  const region  = req.headers.get("x-vercel-ip-region")  ?? null;

  await logAudit({
    action:       "PASSWORD_CHANGED",
    module:       "AUTH",
    resourceType: "User",
    resourceId:   userId,
    userId,
    userEmail:    email,
    dojoId,
    ip,
    country,
    city,
    region,
    userAgent:    req.headers.get("user-agent"),
    statusCode:   200,
  });

  // Notificación al propietario de la plataforma (fire-and-forget)
  // Si mustChangePassword era true en la sesión → primer acceso al portal (alumno recién activado)
  const dojoName = dojoId
    ? (await prisma.dojo.findUnique({ where: { id: dojoId }, select: { name: true } }))?.name ?? null
    : null;

  if (mustChangePassword && role === "student") {
    notifyAdmin(
      `🎓 Primer acceso al portal — ${user.name ?? email} (${dojoName ?? dojoId ?? "?"})`,
      buildFirstPortalAccessEmail(user.name ?? "Sin nombre", email ?? "", dojoName),
    ).catch(() => {});
  } else {
    notifyAdmin(
      `🔐 Cambio de contraseña — ${user.name ?? email}`,
      buildPasswordChangedEmail(user.name ?? "Sin nombre", email ?? "", dojoName),
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
