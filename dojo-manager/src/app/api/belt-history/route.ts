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

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  const history = await prisma.beltHistory.findMany({
    where: {
      student: { dojoId },
      ...(studentId ? { studentId } : {}),
    },
    select: {
      id: true, beltColor: true, changeDate: true, isRanking: true, notes: true, studentId: true,
      kata:    { select: { id: true, name: true, beltColor: true } },
      student: { select: { fullName: true, firstName: true, lastName: true } },
    },
    orderBy: { changeDate: "desc" },
  });

  return NextResponse.json(history);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  // NOTE: role needed for sysadmin context — check SessionUser type
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const body = await req.json();

  const student = await prisma.student.findUnique({
    where: { id: body.studentId, dojoId },
    select: { id: true },
  });
  if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

  const entry = await prisma.beltHistory.create({
    data: {
      studentId:  body.studentId,
      beltColor:  body.beltColor,
      changeDate: new Date(body.changeDate),
      kataId:     body.kataId    ?? null,
      isRanking:  body.isRanking ?? false,
      notes:      body.notes     ?? null,
    },
    select: {
      id: true, beltColor: true, changeDate: true, isRanking: true, notes: true, studentId: true,
      kata: { select: { id: true, name: true, beltColor: true } },
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
