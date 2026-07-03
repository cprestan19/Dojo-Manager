import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

function isSysadmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "sysadmin";
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isSysadmin(session)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  try {
    const { version, title, items, audience, publishedAt, status, testUserEmail } = await req.json();
    const updated = await prisma.systemNews.update({
      where: { id },
      data: {
        version:       version.trim(),
        title:         title.trim(),
        items,
        audience,
        status:        status ?? "draft",
        testUserEmail: testUserEmail?.trim()?.toLowerCase() || null,
        publishedAt:   new Date(publishedAt),
      },
    });

    const userId    = (session!.user as { id?: string })?.id ?? null;
    const userEmail = session!.user?.email ?? null;
    await logAudit({ action: "SYSTEM_NEWS_UPDATED", userId, userEmail, details: `${id}: ${title}` });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

// PATCH — publicar borrador para todos los usuarios
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isSysadmin(session)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  try {
    const updated = await prisma.systemNews.update({
      where: { id },
      data:  { status: "published", testUserEmail: null },
    });

    const userId    = (session!.user as { id?: string })?.id ?? null;
    const userEmail = session!.user?.email ?? null;
    await logAudit({ action: "SYSTEM_NEWS_PUBLISHED", userId, userEmail, details: id });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Error al publicar" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isSysadmin(session)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  try {
    await prisma.systemNews.delete({ where: { id } });

    const userId    = (session!.user as { id?: string })?.id ?? null;
    const userEmail = session!.user?.email ?? null;
    await logAudit({ action: "SYSTEM_NEWS_DELETED", userId, userEmail, details: id });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
