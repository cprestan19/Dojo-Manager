import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  grantComplimentary,
  revokeComplimentary,
  grantFreeMonth,
  grantSpecialAccess,
  extendSpecialAccess,
  changeSubscriptionPlan,
  SubscriptionUserError,
} from "@/lib/billing/subscription";

type SessionUser = { role?: string; email?: string };

// POST /api/billing/admin/grant
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, email } = session.user as SessionUser;
    if (role !== "sysadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const body = await req.json().catch(() => null) as {
      dojoId:     string;
      action:     "complimentary" | "revoke" | "free_month" | "special_access" | "extend_special_access" | "change_plan";
      months?:    number;
      note?:      string;
      endsAt?:    string;   // ISO date — para special_access / extend_special_access
      planId?:    string;   // requerido para special_access
    } | null;

    if (!body?.dojoId || !body?.action) {
      return NextResponse.json({ error: "dojoId y action son requeridos" }, { status: 400 });
    }

    const { dojoId, action, months = 1, note, endsAt, planId } = body;
    const grantedBy = email ?? "sysadmin";

    const validActions = ["complimentary", "revoke", "free_month", "special_access", "extend_special_access", "change_plan"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: "action inválida" }, { status: 400 });
    }

    let sub;

    switch (action) {
      case "complimentary":
        sub = await grantComplimentary(dojoId, grantedBy, note, planId);
        break;

      case "revoke":
        sub = await revokeComplimentary(dojoId, grantedBy);
        break;

      case "free_month":
        if (months < 1 || months > 24) {
          return NextResponse.json({ error: "months debe ser entre 1 y 24" }, { status: 400 });
        }
        sub = await grantFreeMonth(dojoId, grantedBy, months, note);
        break;

      case "special_access": {
        if (!endsAt || !planId) {
          return NextResponse.json({ error: "endsAt y planId son requeridos para special_access" }, { status: 400 });
        }
        const ends = new Date(endsAt);
        if (isNaN(ends.getTime()) || ends <= new Date()) {
          return NextResponse.json({ error: "endsAt debe ser una fecha futura válida" }, { status: 400 });
        }
        sub = await grantSpecialAccess(dojoId, grantedBy, ends, planId, note);
        break;
      }

      case "extend_special_access": {
        if (!endsAt) {
          return NextResponse.json({ error: "endsAt es requerido para extend_special_access" }, { status: 400 });
        }
        const ends = new Date(endsAt);
        if (isNaN(ends.getTime()) || ends <= new Date()) {
          return NextResponse.json({ error: "endsAt debe ser una fecha futura válida" }, { status: 400 });
        }
        sub = await extendSpecialAccess(dojoId, grantedBy, ends);
        break;
      }

      case "change_plan":
        if (!planId) {
          return NextResponse.json({ error: "planId es requerido para change_plan" }, { status: 400 });
        }
        sub = await changeSubscriptionPlan(dojoId, planId, grantedBy, note);
        break;
    }

    return NextResponse.json({ ok: true, status: sub.status, dojoId });
  } catch (err) {
    console.error("POST /api/billing/admin/grant error:", err);
    const message = err instanceof SubscriptionUserError ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: err instanceof SubscriptionUserError ? 400 : 500 });
  }
}
