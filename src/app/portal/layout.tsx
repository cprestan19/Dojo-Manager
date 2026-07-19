import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import PortalNav from "./PortalNav";
import TermsGate from "./TermsGate";
import SystemNewsModal from "@/components/SystemNewsModal";
import ActivityPing from "@/components/ui/ActivityPing";
import { hasFeature } from "@/lib/billing/featureGate";
import { NAV_KEYS } from "@/lib/permissions";

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

  const portalEnabled = await hasFeature(student.dojoId, NAV_KEYS.PORTAL_ACCESS);
  if (!portalEnabled) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-dojo-darker px-6">
        <div className="card max-w-sm text-center py-10">
          <p className="text-dojo-white font-semibold mb-2">Portal no disponible</p>
          <p className="text-dojo-muted text-sm">
            El plan actual de tu academia no incluye el portal de alumnos. Consulta con tu academia para más información.
          </p>
        </div>
      </div>
    );
  }

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
    <div className="min-h-[100dvh] w-full flex flex-col bg-dojo-darker">
      <PortalNav student={student} />
      <SystemNewsModal />
      <ActivityPing />
      <main className="flex-1 overflow-x-hidden overflow-y-auto min-w-0">
        {/* pb-24 = espacio para la barra de navegación inferior fija (64px) + margen */}
        <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
          {children}
        </div>
      </main>
    </div>
  );
}
