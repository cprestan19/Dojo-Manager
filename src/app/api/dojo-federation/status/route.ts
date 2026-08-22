import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

// GET /api/dojo-federation/status — estado de vinculación del dojo actual,
// visto tanto como posible HIJO (su propio padre, si tiene) como posible
// PADRE (lista de sus propios hijos). Cada dojo solo ve SU PROPIA fila —
// nunca datos de un tercer dojo no relacionado. DTO mínimo: nombre + estado
// + fechas, nunca ids internos de la otra parte más allá de lo necesario
// para que el frontend renderice.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const [asChild, asParent] = await Promise.all([
      prisma.dojoParentLink.findUnique({
        where:  { childDojoId: dojoId },
        select: {
          status: true, requestedAt: true, acceptedAt: true, revokedAt: true,
          parent: { select: { name: true } },
        },
      }),
      prisma.dojoParentLink.findMany({
        where:  { parentDojoId: dojoId },
        select: {
          status: true, requestedAt: true, acceptedAt: true, revokedAt: true,
          child: { select: { name: true } },
        },
        orderBy: { requestedAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      asChild: asChild ? {
        status:         asChild.status,
        parentDojoName: asChild.parent.name,
        requestedAt:    asChild.requestedAt,
        acceptedAt:     asChild.acceptedAt,
        revokedAt:      asChild.revokedAt,
      } : null,
      asParent: asParent.map(l => ({
        status:        l.status,
        childDojoName: l.child.name,
        requestedAt:   l.requestedAt,
        acceptedAt:    l.acceptedAt,
        revokedAt:     l.revokedAt,
      })),
    });
  } catch (err) {
    console.error("GET /api/dojo-federation/status", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
