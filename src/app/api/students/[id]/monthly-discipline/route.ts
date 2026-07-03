import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { calcMonthlyDiscipline } from "@/lib/monthly-discipline";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user   = session.user as { role?: string; dojoId?: string | null; studentId?: string | null };
    const { id } = await params;

    if (user.role === "student") {
      // Students can only query their own discipline
      if (user.studentId !== id) {
        return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
      }
    } else {
      const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
      if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

      const check = await prisma.student.findUnique({
        where:  { id },
        select: { dojoId: true },
      });
      if (!check)                return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      if (check.dojoId !== dojoId) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const data = await calcMonthlyDiscipline(id);
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/students/[id]/monthly-discipline", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
