import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;
  const body   = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const existing = await prisma.dojoOrganization.findUnique({ where: { id } });
  if (!existing || existing.dojoId !== dojoId)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const org = await prisma.dojoOrganization.update({
    where: { id },
    data: {
      ...(body.name    !== undefined && { name:    body.name.trim() || existing.name }),
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl?.trim() || null }),
      ...(body.order   !== undefined && { order:   Number(body.order) }),
    },
  });

  return NextResponse.json(org);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.dojoOrganization.findUnique({ where: { id } });
  if (!existing || existing.dojoId !== dojoId)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.dojoOrganization.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
