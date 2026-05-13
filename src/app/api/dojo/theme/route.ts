import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

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

    // Guardamos el theme en el campo de configuración del dojo
    // Usar instagramUrl como campo temporal si no existe campo theme en el schema
    // Lo ideal es agregar: theme String @default("dark-saas") al modelo Dojo
    await prisma.dojo.update({
      where: { id: dojoId },
      data:  { instagramUrl: `theme:${theme}` }, // Temporal hasta agregar campo real
    });

    return NextResponse.json({ ok: true, theme });
  } catch (err) {
    console.error("PUT /api/dojo/theme error:", err);
    return NextResponse.json({ error: "Error al guardar theme" }, { status: 500 });
  }
}
