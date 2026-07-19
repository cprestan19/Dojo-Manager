import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendNewsPushAsync } from "@/lib/push";

function isSysadmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "sysadmin";
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isSysadmin(session)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  try {
    const before = await prisma.systemNews.findUnique({ where: { id }, select: { status: true } });

    const { version, title, items, audience, targetDojoId, publishedAt, status, testUserEmail } = await req.json();
    const updated = await prisma.systemNews.update({
      where: { id },
      data: {
        version:       version.trim(),
        title:         title.trim(),
        items,
        audience,
        targetDojoId:  targetDojoId?.trim() || null,
        status:        status ?? "draft",
        testUserEmail: testUserEmail?.trim()?.toLowerCase() || null,
        publishedAt:   new Date(publishedAt),
      },
    });

    const userId    = (session!.user as { id?: string })?.id ?? null;
    const userEmail = session!.user?.email ?? null;
    await logAudit({ action: "SYSTEM_NEWS_UPDATED", userId, userEmail, details: `${id}: ${title}` });

    // Solo envía push si esta edición es la que recién publica (evita reenviar
    // en cada edición menor de una novedad ya publicada).
    if (before?.status !== "published" && updated.status === "published") {
      const first = (updated.items as { text: string }[])[0]?.text ?? "";
      sendNewsPushAsync(
        updated.audience, updated.targetDojoId,
        { title: `Actualización DojoMasterOnline: ${updated.title}`, body: first.slice(0, 150), url: "/dashboard", tag: "system-news" },
        { sentBy: userId ?? undefined, sourceId: updated.id },
      );
    }

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
