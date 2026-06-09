import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { grantComplimentary, revokeComplimentary, grantFreeMonth } from "@/lib/billing/subscription";

type SessionUser = { role?: string; email?: string };

// POST /api/billing/admin/grant
// Body: { dojoId, action: "complimentary"|"revoke"|"free_month", months?: number, note?: string }
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, email } = session.user as SessionUser;
    if (role !== "sysadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const body = await req.json().catch(() => null) as {
      dojoId:  string;
      action:  "complimentary" | "revoke" | "free_month";
      months?: number;
      note?:   string;
    } | null;

    if (!body?.dojoId || !body?.action) {
      return NextResponse.json({ error: "dojoId y action son requeridos" }, { status: 400 });
    }

    const { dojoId, action, months = 1, note } = body;
    const grantedBy = email ?? "sysadmin";

    if (!["complimentary", "revoke", "free_month"].includes(action)) {
      return NextResponse.json({ error: "action inválida" }, { status: 400 });
    }

    if (months < 1 || months > 24) {
      return NextResponse.json({ error: "months debe ser entre 1 y 24" }, { status: 400 });
    }

    let sub;
    switch (action) {
      case "complimentary":
        sub = await grantComplimentary(dojoId, grantedBy, note);
        break;
      case "revoke":
        sub = await revokeComplimentary(dojoId, grantedBy);
        break;
      case "free_month":
        sub = await grantFreeMonth(dojoId, grantedBy, months, note);
        break;
    }

    return NextResponse.json({ ok: true, status: sub.status, dojoId });
  } catch (err) {
    console.error("POST /api/billing/admin/grant error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
