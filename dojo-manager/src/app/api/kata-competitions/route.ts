import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  // NOTE: role needed for sysadmin context — check SessionUser type
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const studentId = new URL(req.url).searchParams.get("studentId");

  const entries = await prisma.kataCompetition.findMany({
    where: {
      student: { dojoId },
      ...(studentId ? { studentId } : {}),
    },
    include: { kata: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  // NOTE: role needed for sysadmin context — check SessionUser type
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  try {
    const body = await req.json();

    const student = await prisma.student.findUnique({
      where: { id: body.studentId, dojoId },
      select: { id: true },
    });
    if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

    const entry = await prisma.kataCompetition.create({
      data: {
        studentId:  body.studentId,
        kataId:     body.kataId     || null,
        date:       new Date(body.date),
        tournament: body.tournament || null,
        result:     body.result     || null,
        notes:      body.notes      || null,
      },
      include: { kata: { select: { id: true, name: true } } },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
