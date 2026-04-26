import prisma from "@/lib/prisma";

export interface AuditParams {
  action: string;
  userId?:    string | null;
  userEmail?: string | null;
  dojoId?:    string | null;
  dojoSlug?:  string | null;
  ip?:        string | null;
  userAgent?: string | null;
  details?:   string | null;
}

export async function logAudit(params: AuditParams) {
  try {
    await prisma.auditLog.create({ data: params });
  } catch { /* never let audit failure break normal flow */ }
}

export function getIp(req: Request | { headers: Record<string, string | string[] | undefined> }): string {
  const headers = req instanceof Request ? req.headers : {
    get: (k: string) => {
      const v = (req.headers as Record<string, string | string[] | undefined>)[k];
      return Array.isArray(v) ? v[0] : v ?? null;
    },
  };
  const forwarded = headers instanceof Headers
    ? headers.get("x-forwarded-for")
    : (req.headers as Record<string, string | undefined>)["x-forwarded-for"];
  return (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : null) ?? "unknown";
}
