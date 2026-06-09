import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveDojoId } from "@/lib/sysadmin-context";
import { isDojoReadOnly } from "@/lib/billing/subscription";

type RouteHandler = (req: NextRequest, ctx: unknown) => Promise<NextResponse> | NextResponse;

const BYPASS_PATHS = ["/api/auth", "/api/billing", "/api/webhooks", "/api/cron"];

export function withReadOnlyGuard(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx: unknown) => {
    // Only guard mutating methods
    if (req.method === "GET") return handler(req, ctx);

    // Skip billing/auth/webhook paths
    const pathname = req.nextUrl.pathname;
    if (BYPASS_PATHS.some(p => pathname.includes(p))) return handler(req, ctx);

    const session = await getServerSession(authOptions);
    if (!session) return handler(req, ctx); // Let the route handle auth

    const { role, dojoId: sessionDojoId } = session.user as {
      role?: string;
      dojoId?: string | null;
    };

    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return handler(req, ctx);

    const readOnly = await isDojoReadOnly(dojoId);
    if (readOnly) {
      return NextResponse.json(
        {
          error:   "READ_ONLY",
          message: "Tu suscripción requiere atención para continuar.",
        },
        { status: 403 },
      );
    }

    return handler(req, ctx);
  };
}
