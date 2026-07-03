import { redirect } from "next/navigation";

// Redirige al log unificado en superadmin
export default function AuditLogPage() {
  redirect("/dashboard/superadmin/audit-logs");
}
