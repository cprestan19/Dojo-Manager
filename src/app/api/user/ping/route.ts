import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string })?.id;
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });

  let page: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.page === "string" && body.page.startsWith("/")) page = body.page.slice(0, 200);
  } catch { /* ignore */ }

  try {
    await prisma.user.update({
      where: { id: uid },
      data:  {
        lastActiveAt:    new Date(),
        ...(page ? { lastVisitedPage: page } : {}),
      },
    });
  } catch { /* fire-and-forget */ }

  return NextResponse.json({ ok: true });
}
