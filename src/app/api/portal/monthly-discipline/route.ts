import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { calcMonthlyDiscipline } from "@/lib/monthly-discipline";

// GET /api/portal/monthly-discipline
// Returns DisciplineData[] — always an array (1 item if solo, N if family)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; studentId?: string | null };
    if (user.role !== "student" || !user.studentId) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const self = await prisma.student.findUnique({
      where:  { id: user.studentId },
      select: { id: true, familyId: true, dojoId: true },
    });
    if (!self) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    if (self.familyId) {
      const siblings = await prisma.student.findMany({
        where:   { familyId: self.familyId, dojoId: self.dojoId, active: true },
        select:  { id: true },
        orderBy: { fullName: "asc" },
      });
      const results = await Promise.all(siblings.map(s => calcMonthlyDiscipline(s.id)));
      return NextResponse.json(results);
    }

    const data = await calcMonthlyDiscipline(self.id);
    return NextResponse.json([data]);
  } catch (err) {
    console.error("GET /api/portal/monthly-discipline", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
