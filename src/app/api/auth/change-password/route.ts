import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";

type SessionUser = { id?: string; email?: string; dojoId?: string | null };

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: userId, email, dojoId } = session.user as SessionUser;
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

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
          ?? req.headers.get("x-real-ip")
          ?? "unknown";

  await logAudit({
    action:    "PASSWORD_CHANGED",
    userId,
    userEmail: email,
    dojoId,
    ip,
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
