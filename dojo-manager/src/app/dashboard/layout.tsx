import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { TopBar } from "@/components/layout/TopBar";
import { DojoBanner } from "@/components/dashboard/DojoBanner";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role;

  // Sysadmin in dojo-maintenance mode shows a banner
  const cookieStore = await cookies();
  const sxDojoName  = role === "sysadmin"
    ? (cookieStore.get("sx-dojo-name")?.value ?? null)
    : null;

  return (
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
  );
}
