import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { dojoId?: string | null };

async function resolveEntry(id: string, dojoId: string) {
  return prisma.kataCompetition.findUnique({
    where: { id },
    select: { id: true, student: { select: { dojoId: true } } },
  }).then(e => (e?.student.dojoId === dojoId ? e : null));
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  if (!dojoId) return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });
  if (!await resolveEntry(id, dojoId)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  try {
    const body  = await req.json();
    const entry = await prisma.kataCompetition.update({
      where: { id },
      data: {
        kataId:     body.kataId     || null,
        date:       new Date(body.date),
        tournament: body.tournament || null,
        result:     body.result     || null,
        notes:      body.notes      || null,
      },
      include: { kata: { select: { id: true, name: true } } },
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
  if (!dojoId) return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });
  if (!await resolveEntry(id, dojoId)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.kataCompetition.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
