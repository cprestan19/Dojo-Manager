import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { TopBar } from "@/components/layout/TopBar";
import { DojoBanner } from "@/components/dashboard/DojoBanner";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role;

  const cookieStore = await cookies();
  const sxDojoName  = role === "sysadmin"
    ? (cookieStore.get("sx-dojo-name")?.value ?? null)
    : null;

  return (
    // DashboardShell provides:
    //  1. AppContextProvider — dojo info + permissions fetched ONCE per session
    //  2. DashboardErrorBoundary — catches any client-side crash, shows recover UI
    <DashboardShell>
      <div className="flex min-h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <MobileNav />
          {sxDojoName && <DojoBanner dojoName={sxDojoName} />}
          <TopBar />
          <main className="flex-1 overflow-auto bg-dojo-darker min-w-0">
            <div className="p-4 lg:p-8 min-w-0 overflow-x-hidden">{children}</div>
          </main>
        </div>
      </div>
    </DashboardShell>
  );
}
