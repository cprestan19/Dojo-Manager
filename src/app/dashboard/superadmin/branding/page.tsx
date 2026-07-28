import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PlatformBrandingForm } from "@/components/superadmin/PlatformBrandingForm";

export default async function PlatformBrandingPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;

  if (role !== "sysadmin") redirect("/dashboard");

  return <PlatformBrandingForm />;
}
