import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const orgs = await prisma.dojoOrganization.findMany({
    where:   { dojoId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(orgs);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.name?.trim())
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const org = await prisma.dojoOrganization.create({
    data: {
      dojoId,
      name:    body.name.trim(),
      logoUrl: body.logoUrl?.trim() || null,
      order:   typeof body.order === "number" ? body.order : 0,
    },
  });

  return NextResponse.json(org, { status: 201 });
}
