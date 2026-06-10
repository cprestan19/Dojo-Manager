import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveDojoId } from "@/lib/sysadmin-context";
import { dojoHasPaidFeatures } from "@/lib/billing/features";

type RouteHandler = (req: NextRequest, ctx: unknown) => Promise<NextResponse> | NextResponse;

/**
 * Bloquea handlers de funciones exclusivas de planes pagos (Torneos, Tienda,
 * Página pública) cuando el dojo está en el Plan Bronce gratuito.
 */
export function withPaidPlanGuard(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx: unknown) => {
    const session = await getServerSession(authOptions);
    if (!session) return handler(req, ctx); // Let the route handle auth

    const { role, dojoId: sessionDojoId } = session.user as {
      role?: string;
      dojoId?: string | null;
    };

    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return handler(req, ctx);

    if (!(await dojoHasPaidFeatures(dojoId))) {
      return NextResponse.json(
        {
          error:   "PLAN_FEATURE_LOCKED",
          message: "Esta función no está disponible en el Plan Bronce. Adquiere el Plan Silver o Gold para habilitarla.",
        },
        { status: 403 },
      );
    }

    return handler(req, ctx);
  };
}
