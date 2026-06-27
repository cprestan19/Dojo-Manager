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

  // Fetch candidate user by expiry + active — avoid full table scan
  // Then compare tokens with timingSafeEqual to prevent timing side-channel
  const candidate = await prisma.user.findFirst({
    where: {
      resetTokenExpiry: { gte: new Date() },
      active:           true,
      resetToken:       { not: null },
    },
    select: { id: true, resetToken: true },
  });

  let user: { id: string } | null = null;
  if (candidate?.resetToken) {
    try {
      const a = Buffer.from(candidate.resetToken, "utf8");
      const b = Buffer.from(token,                 "utf8");
      if (a.length === b.length && timingSafeEqual(a, b)) user = { id: candidate.id };
    } catch {
      // length mismatch handled by null user below
    }
  }

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
