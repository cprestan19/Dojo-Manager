import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug requerido" }, { status: 400 });

  const dojo = await prisma.dojo.findUnique({
    where:  { slug, active: true },
    select: { id: true },
  });
  if (!dojo) return NextResponse.json({ error: "Dojo no encontrado" }, { status: 404 });

  const products = await prisma.storeProduct.findMany({
    where:   { dojoId: dojo.id, active: true },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, name: true, description: true,
      price: true, currency: true, imageUrl: true, sizes: true,
    },
  });

  return NextResponse.json(products);
}
