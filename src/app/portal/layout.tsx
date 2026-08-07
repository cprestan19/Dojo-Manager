import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import PortalNav from "./PortalNav";
import TermsGate from "./TermsGate";
import SystemNewsModal from "@/components/SystemNewsModal";
import ActivityPing from "@/components/ui/ActivityPing";
import { PageTransition } from "@/components/portal/PageTransition";
import { hasFeature, hasTournamentsAccess } from "@/lib/billing/featureGate";
import { NAV_KEYS } from "@/lib/permissions";
import { PortalTimeZoneProvider } from "@/lib/context/PortalTimeZoneContext";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { PortalCurrencyProvider } from "@/lib/context/PortalCurrencyContext";
import { DEFAULT_CURRENCY } from "@/lib/currency";

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
      dojo: { select: { name: true, logo: true, timezone: true, currency: true } },
      beltHistory: { orderBy: { changeDate: "desc" }, take: 1, select: { beltColor: true } },
    },
  });

  if (!student) redirect("/login");

  const [portalEnabled, hasStore, hasTournaments] = await Promise.all([
    hasFeature(student.dojoId, NAV_KEYS.PORTAL_ACCESS),
    hasFeature(student.dojoId, NAV_KEYS.STORE),
    hasTournamentsAccess(student.dojoId),
  ]);
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

  // Solo vale la pena que el portal haga polling de "tatamis en vivo" si el
  // dojo tiene Torneo Pro Y este alumno específico está inscrito como
  // participante en un torneo activo/listo — evita consultar cada 30s en
  // dojos que nunca usan Torneo Pro o alumnos sin torneo en curso.
  let canHaveLiveTatami = false;
  if (hasTournaments) {
    const activeParticipation = await prisma.tournamentParticipant.findFirst({
      where: {
        studentId:  student.id,
        tournament: { dojoId: student.dojoId, status: { in: ["active", "ready"] } },
      },
      select: { id: true },
    });
    canHaveLiveTatami = !!activeParticipation;
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
    <PortalTimeZoneProvider timezone={student.dojo.timezone ?? DEFAULT_TIMEZONE}>
      <PortalCurrencyProvider currency={student.dojo.currency ?? DEFAULT_CURRENCY}>
        <div className="min-h-[100dvh] w-full flex flex-col bg-dojo-darker">
          <PortalNav student={student} hasStore={hasStore} canHaveLiveTatami={canHaveLiveTatami} />
          <SystemNewsModal />
          <ActivityPing />
          <main className="flex-1 overflow-x-hidden overflow-y-auto min-w-0">
            {/* pb-24 = espacio para la barra de navegación inferior fija (64px) + margen */}
            <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
        </div>
      </PortalCurrencyProvider>
    </PortalTimeZoneProvider>
  );
}
