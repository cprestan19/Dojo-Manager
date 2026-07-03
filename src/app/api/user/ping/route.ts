import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PATCH() {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string })?.id;
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    await prisma.user.update({ where: { id: uid }, data: { lastActiveAt: new Date() } });
  } catch { /* fire-and-forget — no bloquear al usuario */ }

  return NextResponse.json({ ok: true });
}
