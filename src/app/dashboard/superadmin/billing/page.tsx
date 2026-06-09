import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SuperadminBillingDashboard } from "@/components/billing/SuperadminBillingDashboard";

export default async function SuperadminBillingPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "sysadmin") redirect("/dashboard");

  return <SuperadminBillingDashboard />;
}
