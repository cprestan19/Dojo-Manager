import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { withPlanFeatureGuard } from "@/lib/billing/planFeatureGuard";
import { NAV_KEYS } from "@/lib/permissions";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string }> };

async function _PUT(req: NextRequest, routeCtx: unknown) {
  const { params } = routeCtx as Params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.storeProduct.findFirst({ where: { id, dojoId } });
  if (!existing) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

  const body = await req.json();
  const { name, description, price, imageUrl, sizes, currency, active } = body;

  if (!name?.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const updated = await prisma.storeProduct.update({
    where: { id },
    data: {
      name:        name.trim(),
      description: description?.trim() || null,
      price:       price !== undefined ? Number(price) : existing.price,
      currency:    currency || existing.currency,
      imageUrl:    imageUrl !== undefined ? (imageUrl || null) : existing.imageUrl,
      sizes:       Array.isArray(sizes) && sizes.length > 0 ? sizes : undefined,
      active:      typeof active === "boolean" ? active : existing.active,
    },
  });

  return NextResponse.json(updated);
}

export const PUT = withPlanFeatureGuard(NAV_KEYS.STORE, _PUT);

// DELETE no se gatea — siempre debe poder quitarse un producto ya creado,
// incluso si el dojo baja de plan (mismo criterio que revocar portal-access).
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.storeProduct.findFirst({ where: { id, dojoId } });
  if (!existing) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

  await prisma.storeProduct.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
