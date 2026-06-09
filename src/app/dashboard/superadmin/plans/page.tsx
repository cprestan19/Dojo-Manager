import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PlanManager } from "@/components/billing/PlanManager";

export default async function PlansPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;

  if (role !== "sysadmin") redirect("/dashboard");

  return <PlanManager />;
}
