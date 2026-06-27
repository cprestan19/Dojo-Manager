import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { PasswordSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) return NextResponse.json({ error: "Token y contraseña requeridos" }, { status: 400 });

  const pwResult = PasswordSchema.safeParse(password);
  if (!pwResult.success) return NextResponse.json({ error: pwResult.error.errors[0]?.message ?? "Contraseña inválida" }, { status: 400 });

  // Buscar por token en DB (UUID de 122 bits — no enumerable por timing).
  // timingSafeEqual como capa adicional contra comparaciones en memoria.
  const candidate = await prisma.user.findFirst({
    where: {
      resetToken:       token,
      resetTokenExpiry: { gte: new Date() },
      active:           true,
    },
    select: { id: true, resetToken: true },
  });

  let verified = false;
  if (candidate?.resetToken) {
    try {
      const a = Buffer.from(candidate.resetToken, "utf8");
      const b = Buffer.from(token,                "utf8");
      verified = a.length === b.length && timingSafeEqual(a, b);
    } catch {
      verified = false;
    }
  }

  if (!verified) return NextResponse.json({ error: "Token inválido o expirado" }, { status: 400 });

  const user = candidate!;

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
