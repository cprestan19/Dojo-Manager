import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

function isSysadmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "sysadmin";
}

// GET — lista todas (solo sysadmin)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isSysadmin(session)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const news = await prisma.systemNews.findMany({
    orderBy: { publishedAt: "desc" },
  });
  return NextResponse.json(news);
}

// POST — crea una nueva novedad (solo sysadmin)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isSysadmin(session)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const { version, title, items, audience, publishedAt, status, testUserEmail } = await req.json();

    if (!version?.trim() || !title?.trim() || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Versión, título e ítems son obligatorios" }, { status: 400 });
    }

    const news = await prisma.systemNews.create({
      data: {
        version:       version.trim(),
        title:         title.trim(),
        items,
        audience:      audience ?? "all",
        status:        status ?? "draft",
        testUserEmail: testUserEmail?.trim()?.toLowerCase() || null,
        publishedAt:   publishedAt ? new Date(publishedAt) : new Date(),
      },
    });

    const userId    = (session!.user as { id?: string })?.id ?? null;
    const userEmail = session!.user?.email ?? null;
    await logAudit({ action: "SYSTEM_NEWS_CREATED", userId, userEmail, details: `v${version}: ${title}` });

    return NextResponse.json(news, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/system/news]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
