import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { TopBar } from "@/components/layout/TopBar";
import { DojoBanner } from "@/components/dashboard/DojoBanner";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { HelpButton } from "@/components/ui/HelpButton";
import { BillingBanner } from "@/components/billing/BillingBanner";
import PageRefreshHandler from "@/components/ui/PageRefreshHandler";
import SystemNewsModal from "@/components/SystemNewsModal";
import ActivityPing from "@/components/ui/ActivityPing";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId } from "@/lib/sysadmin-context";

type ThemeId = "dark-saas" | "soft-neutral" | "executive-red";
const VALID: ThemeId[] = ["dark-saas", "soft-neutral", "executive-red"];

async function getDojoTheme(role: string | undefined, sessionDojoId: string | null | undefined, sxDojo: string | undefined): Promise<ThemeId> {
  try {
    const dojoId = getEffectiveDojoId(role, sessionDojoId, { cookies: { get: (k: string) => k === "sx-dojo" ? { value: sxDojo } : undefined } } as never);
    if (!dojoId) return "dark-saas";
    const dojo = await prisma.dojo.findUnique({
      where:  { id: dojoId },
      select: { themeId: true },
    });
    const t = dojo?.themeId as ThemeId;
    return VALID.includes(t) ? t : "dark-saas";
  } catch {
    return "dark-saas";
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role    = (session.user as { role?: string; dojoId?: string | null })?.role;
  const dojoId  = (session.user as { dojoId?: string | null })?.dojoId;

  const cookieStore = await cookies();
  const sxDojoName  = role === "sysadmin" ? (cookieStore.get("sx-dojo-name")?.value ?? null) : null;
  const sxDojo      = cookieStore.get("sx-dojo")?.value;
  const sxPreview   = role === "sysadmin" && cookieStore.get("sx-preview")?.value === "1";

  // Leer el theme del dojo desde DB (SSR — sin parpadeo)
  const theme = await getDojoTheme(role, dojoId, sxDojo);

  return (
    // data-theme aplicado en el wrapper del dashboard — aísla el theme por dojo
    // sin afectar el resto de la app (login, portal, páginas públicas)
    <DashboardShell theme={theme}>
      <PageRefreshHandler />
      <BillingBanner />
      <div id="dojo-shell" className="flex min-h-screen" data-theme={theme}>
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <MobileNav />
          {sxDojoName && <DojoBanner dojoName={sxDojoName} mode={sxPreview ? "preview" : "maintenance"} />}
          <TopBar />
          <main className="flex-1 overflow-auto bg-dojo-darker min-w-0">
            <div className="p-4 lg:p-8 min-w-0 overflow-x-hidden">{children}</div>
          </main>
          <HelpButton />
        </div>
      </div>
      <SystemNewsModal />
      <ActivityPing />
    </DashboardShell>
  );
}
