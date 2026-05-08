import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import PortalNav from "./PortalNav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const user    = session?.user as { role?: string; studentId?: string | null } | undefined;

  if (!session || user?.role !== "student" || !user?.studentId) {
    redirect("/login");
  }

  const student = await prisma.student.findUnique({
    where:  { id: user.studentId },
    select: {
      id: true, fullName: true, photo: true,
      dojo: { select: { name: true, logo: true } },
      beltHistory: { orderBy: { changeDate: "desc" }, take: 1, select: { beltColor: true } },
    },
  });

  if (!student) redirect("/login");

  return (
    <div className="min-h-[100dvh] flex flex-col bg-dojo-darker">
      <PortalNav student={student} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
