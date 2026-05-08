import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) return NextResponse.json({ error: "Token y contraseña requeridos" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "La contraseña debe tener mínimo 8 caracteres" }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: {
      resetToken:       token,
      resetTokenExpiry: { gte: new Date() },
      active:           true,
    },
    select: { id: true },
  });

  if (!user) return NextResponse.json({ error: "Token inválido o expirado" }, { status: 400 });

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data:  {
      password:          hashed,
      mustChangePassword: false,
      resetToken:        null,
      resetTokenExpiry:  null,
    },
  });

  return NextResponse.json({ ok: true });
}
