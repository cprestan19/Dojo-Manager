import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

async function resolveEntry(id: string, dojoId: string) {
  const entry = await prisma.beltHistory.findUnique({
    where: { id },
    select: { id: true, student: { select: { dojoId: true } } },
  });
  if (!entry || entry.student.dojoId !== dojoId) return null;
  return entry;
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  // NOTE: role needed for sysadmin context — check SessionUser type
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  if (!await resolveEntry(id, dojoId))
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  try {
    const body = await req.json();
    const entry = await prisma.beltHistory.update({
      where: { id },
      data: {
        beltColor:  body.beltColor,
        changeDate: new Date(body.changeDate),
        kataId:     body.kataId    || null,
        isRanking:  body.isRanking ?? false,
        notes:      body.notes     || null,
      },
    });
    return NextResponse.json(entry);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  // NOTE: role needed for sysadmin context — check SessionUser type
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  if (!await resolveEntry(id, dojoId))
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.beltHistory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
