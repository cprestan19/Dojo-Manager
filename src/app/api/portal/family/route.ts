import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/portal/family — devuelve los miembros de la familia del alumno en sesión.
// Si no tiene familia, devuelve solo el alumno actual (array de 1 elemento).
export async function GET() {
  const session = await getServerSession(authOptions);
  const user    = session?.user as { role?: string; studentId?: string | null } | undefined;

  if (!user || user.role !== "student" || !user.studentId)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const me = await prisma.student.findUnique({
    where:  { id: user.studentId },
    select: { id: true, fullName: true, familyId: true, dojoId: true },
  });
  if (!me) return NextResponse.json([], { status: 200 });

  if (!me.familyId) {
    return NextResponse.json([{ id: me.id, fullName: me.fullName, isMe: true }]);
  }

  const members = await prisma.student.findMany({
    where:   { familyId: me.familyId, dojoId: me.dojoId, active: true },
    select:  { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json(members.map(m => ({ ...m, isMe: m.id === me.id })));
}
