import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { formatStudentName } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "sysadmin")
    return NextResponse.json({ error: "Solo sysadmin" }, { status: 403 });

  void req;

  const students = await prisma.student.findMany({
    select: { id: true, fullName: true, firstName: true, lastName: true },
  });

  let fixed = 0;
  for (const s of students) {
    const newFull  = formatStudentName(s.fullName);
    const newFirst = s.firstName ? formatStudentName(s.firstName) : s.firstName;
    const newLast  = s.lastName  ? formatStudentName(s.lastName)  : s.lastName;

    if (newFull !== s.fullName || newFirst !== s.firstName || newLast !== s.lastName) {
      await prisma.student.update({
        where: { id: s.id },
        data: {
          fullName: newFull,
          ...(newFirst !== s.firstName ? { firstName: newFirst } : {}),
          ...(newLast  !== s.lastName  ? { lastName: newLast }   : {}),
        },
      });
      fixed++;
    }
  }

  return NextResponse.json({
    ok: true,
    message: `${fixed} alumnos corregidos de ${students.length} totales.`,
    total: students.length,
    fixed,
  });
}
