import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/queries";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

async function resolveKata(id: string, dojoId: string) {
  const kata = await prisma.kata.findUnique({
    where: { id },
    select: { id: true, dojoId: true },
  });
  if (!kata || kata.dojoId !== dojoId) return null;
  return kata;
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  if (!await resolveKata(id, dojoId))
    return NextResponse.json({ error: "Kata no encontrado" }, { status: 404 });

  try {
    const body = await req.json();
    const kata = await prisma.kata.update({
      where: { id },
      data: {
        name:        body.name,
        beltColor:   body.beltColor,
        order:       Number(body.order) || 0,
        description: body.description ?? null,
        active:      body.active ?? true,
      },
    });
    revalidateTag(CACHE_TAGS.katas(dojoId));
    return NextResponse.json(kata);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002")
      return NextResponse.json({ error: "Ya existe un kata con ese nombre en este dojo." }, { status: 409 });
    console.error("katas [id] error:", err);
    return NextResponse.json({ error: "Error interno al procesar la kata" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  if (!await resolveKata(id, dojoId))
    return NextResponse.json({ error: "Kata no encontrado" }, { status: 404 });

  try {
    await prisma.kata.delete({ where: { id } });
    revalidateTag(CACHE_TAGS.katas(dojoId));
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("katas [id] error:", err);
    return NextResponse.json({ error: "Error interno al procesar la kata" }, { status: 500 });
  }
}
