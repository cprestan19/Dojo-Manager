import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Params = { params: Promise<{ slug: string }> };

// Endpoint público — devuelve branding del dojo para la pantalla de login
export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;

  const dojo = await prisma.dojo.findUnique({
    where: { slug, active: true },
    select: { name: true, logo: true, slug: true },
  });

  if (!dojo) return NextResponse.json({ error: "Dojo no encontrado" }, { status: 404 });
  return NextResponse.json(dojo);
}
