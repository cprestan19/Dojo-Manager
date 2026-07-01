import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import PortalNav from "./PortalNav";
import TermsGate from "./TermsGate";

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
      dojoId: true,
      dojo: { select: { name: true, logo: true } },
      beltHistory: { orderBy: { changeDate: "desc" }, take: 1, select: { beltColor: true } },
    },
  });

  if (!student) redirect("/login");

  // ── Verificar si el alumno necesita aceptar los términos del dojo ──
  const [termsPolicy, termsAcceptance] = await Promise.all([
    prisma.dojoTermsPolicy.findUnique({ where: { dojoId: student.dojoId } }),
    prisma.termsAcceptance.findUnique({
      where: { studentId_dojoId: { studentId: user.studentId, dojoId: student.dojoId } },
    }),
  ]);

  const needsAcceptance =
    !!termsPolicy &&
    termsPolicy.enabled &&
    (!termsAcceptance || termsAcceptance.version < termsPolicy.version);

  if (needsAcceptance) {
    return (
      <TermsGate
        content={termsPolicy!.content}
        version={termsPolicy!.version}
        dojoName={student.dojo.name}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-dojo-darker overflow-x-hidden">
      <PortalNav student={student} />
      <main className="flex-1 overflow-x-hidden overflow-y-auto min-w-0">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
