import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/queries";

type SessionUser = { role?: string; dojoId?: string | null };
const VALID_THEMES = ["dark-saas", "soft-neutral", "executive-red"] as const;

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  try {
    const { theme } = await req.json() as { theme?: string };
    if (!theme || !VALID_THEMES.includes(theme as typeof VALID_THEMES[number]))
      return NextResponse.json({ error: "Theme inválido" }, { status: 400 });

    await prisma.dojo.update({
      where: { id: dojoId },
      data:  { themeId: theme },
    });

    // Invalidar caché del dojo para que el SSR aplique el nuevo theme
    revalidateTag(CACHE_TAGS.dojo(dojoId));

    return NextResponse.json({ ok: true, theme });
  } catch (err) {
    console.error("PUT /api/dojo/theme error:", err);
    return NextResponse.json({ error: "Error al guardar theme" }, { status: 500 });
  }
}
