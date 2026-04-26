import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { StudentsClient, type StudentRow } from "./StudentsClient";

type SessionUser = { dojoId?: string | null };

export default async function StudentsPage() {
  const session = await getServerSession(authOptions);
  const { dojoId } = (session?.user as SessionUser) ?? {};
  if (!dojoId) redirect("/login");

  const raw = await prisma.student.findMany({
    where: { dojoId, active: true },
    select: {
      id: true, fullName: true, firstName: true, lastName: true,
      birthDate: true, gender: true, nationality: true, active: true,
      beltHistory: {
        orderBy: { changeDate: "desc" },
        take: 1,
        select: { beltColor: true },
      },
      payments: {
        where: { status: { in: ["pending", "late"] } },
        orderBy: { dueDate: "asc" },
        take: 1,
        select: { status: true, dueDate: true },
      },
    },
    orderBy: { lastName: "asc" },
  });

  // Serializar Date → string antes de pasar al Client Component
  const students: StudentRow[] = raw.map(s => ({
    ...s,
    birthDate: s.birthDate.toISOString(),
    payments:  s.payments.map(p => ({ ...p, dueDate: p.dueDate.toISOString() })),
  }));

  return <StudentsClient initialStudents={students} />;
}
