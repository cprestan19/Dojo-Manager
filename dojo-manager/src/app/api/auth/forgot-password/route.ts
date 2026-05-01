import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { sendPasswordReset } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email requerido" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where:  { email: email.toLowerCase().trim() },
    select: { id: true, name: true, email: true, active: true, dojoId: true },
  });

  if (!user || !user.active) {
    return NextResponse.json({ ok: true });
  }

  const token   = crypto.randomBytes(32).toString("hex");
  const expiry  = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data:  { resetToken: token, resetTokenExpiry: expiry },
  });

  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dojomasteronline.com";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  try {
    const dojo = user.dojoId ? await prisma.dojo.findUnique({
      where:  { id: user.dojoId },
      select: { name: true, email: true, phone: true, logo: true, slogan: true, ownerName: true },
    }) : null;

    await sendPasswordReset({
      to:       user.email,
      name:     user.name,
      resetUrl,
      dojo:     dojo ?? undefined,
    });
  } catch (err) {
    console.error("Reset email error:", err);
  }

  return NextResponse.json({ ok: true });
}
