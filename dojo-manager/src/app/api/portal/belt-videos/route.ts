import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string; dojoId?: string | null; studentId?: string | null };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId, studentId } = session.user as SessionUser;
  if (role !== "student") return NextResponse.json({ error: "Solo alumnos" }, { status: 403 });
  if (!dojoId || !studentId) return NextResponse.json({ error: "Sesión inválida" }, { status: 403 });

  // Get the unique belt colors this student has earned
  const beltRows = await prisma.beltHistory.findMany({
    where:  { studentId },
    select: { beltColor: true },
    distinct: ["beltColor"],
  });

  const earnedBelts = beltRows.map(r => r.beltColor);

  if (earnedBelts.length === 0) return NextResponse.json([]);

  // Return only active videos for belts the student has earned
  const videos = await prisma.beltVideo.findMany({
    where: {
      dojoId,
      active:    true,
      beltColor: { in: earnedBelts },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, beltColor: true, title: true,
      description: true, videoUrl: true, order: true,
    },
  });

  return NextResponse.json({ videos, earnedBelts });
}
