import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session   = await getServerSession(authOptions);
  const user      = session?.user as { role?: string; studentId?: string | null } | undefined;

  if (!user || user.role !== "student" || !user.studentId)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom");
  const dateTo   = searchParams.get("dateTo");

  const rows = await prisma.attendance.findMany({
    where: {
      studentId: user.studentId,
      ...((dateFrom || dateTo) ? {
        markedAt: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
        },
      } : {}),
    },
    select: {
      id: true, type: true, markedAt: true, corrected: true,
      schedule: { select: { id: true, name: true } },
    },
    orderBy: { markedAt: "desc" },
    take: 500,
  });

  return NextResponse.json(rows);
}
