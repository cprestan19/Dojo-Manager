import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

const VALID_STATUSES = ["PENDING", "CONTACTED", "COMPLETED", "CANCELLED"];

// PUT /api/store-requests/[id] — actualizar estado (no se gatea por plan:
// siempre debe poder cerrarse/cancelarse una solicitud ya recibida, incluso
// si el dojo baja de plan luego de recibirla)
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { status?: string };
  if (!body.status || !VALID_STATUSES.includes(body.status))
    return NextResponse.json({ error: "status inválido" }, { status: 400 });

  const existing = await prisma.storePurchaseRequest.findFirst({ where: { id, dojoId } });
  if (!existing) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });

  const updated = await prisma.storePurchaseRequest.update({
    where: { id },
    data:  { status: body.status },
  });

  return NextResponse.json(updated);
}
