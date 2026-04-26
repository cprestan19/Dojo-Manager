import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  const history = await prisma.beltHistory.findMany({
    where: studentId ? { studentId } : {},
    include: {
      kata:    true,
      student: { select: { firstName: true, lastName: true } },
    },
    orderBy: { changeDate: "desc" },
  });

  return NextResponse.json(history);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();

  const entry = await prisma.beltHistory.create({
    data: {
      studentId:  body.studentId,
      beltColor:  body.beltColor,
      changeDate: new Date(body.changeDate),
      kataId:     body.kataId ?? null,
      isRanking:  body.isRanking ?? false,
      notes:      body.notes ?? null,
    },
    include: { kata: true },
  });

  return NextResponse.json(entry, { status: 201 });
}
