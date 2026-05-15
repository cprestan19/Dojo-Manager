import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const products = await prisma.storeProduct.findMany({
    where:   { dojoId },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const body = await req.json();
  const { name, description, price, imageUrl, sizes, currency } = body;

  if (!name?.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  if (price === undefined || isNaN(Number(price)) || Number(price) < 0)
    return NextResponse.json({ error: "El precio es inválido" }, { status: 400 });

  const product = await prisma.storeProduct.create({
    data: {
      dojoId,
      name:        name.trim(),
      description: description?.trim() || null,
      price:       Number(price),
      currency:    currency || "USD",
      imageUrl:    imageUrl || null,
      sizes:       Array.isArray(sizes) && sizes.length > 0 ? sizes : undefined,
      active:      true,
    },
  });

  return NextResponse.json(product, { status: 201 });
}
