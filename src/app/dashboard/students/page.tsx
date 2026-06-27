// Cachear 30 segundos — la lista de alumnos no necesita ser en tiempo real
export const revalidate = 30;

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { StudentsClient, type StudentRow } from "./StudentsClient";

type SessionUser = { dojoId?: string | null; role?: string };

export default async function StudentsPage() {
  const session = await getServerSession(authOptions);
  const { dojoId, role } = (session?.user as SessionUser) ?? {};
  if (!dojoId) redirect("/login");

  const raw = await prisma.student.findMany({
    where: { dojoId, active: true },
    select: {
      id: true, fullName: true, firstName: true, lastName: true,
      birthDate: true, gender: true, nationality: true, active: true,
      photo: true,  // URL Cloudinary para avatar
      familyId: true,
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
      portalUser: { select: { active: true } },
    },
    orderBy: { lastName: "asc" },
  });

  // Serializar Date → string antes de pasar al Client Component
  const students: StudentRow[] = raw.map(s => ({
    ...s,
    birthDate: s.birthDate.toISOString(),
    payments:  s.payments.map(p => ({ ...p, dueDate: p.dueDate.toISOString() })),
  }));

  const canEdit = role === "admin" || role === "sysadmin";
  return <StudentsClient initialStudents={students} canEdit={canEdit} />;
}
