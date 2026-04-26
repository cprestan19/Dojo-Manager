import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS, getCachedKatas } from "@/lib/queries";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  if (!dojoId) return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });

  const activeOnly = new URL(req.url).searchParams.get("active") === "1";

  if (activeOnly) {
    const katas = await getCachedKatas(dojoId);
    return NextResponse.json(katas);
  }

  const katas = await prisma.kata.findMany({
    where:   { dojoId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(katas);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId } = session.user as SessionUser;
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId) return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });

  const body = await req.json();
  const kata = await prisma.kata.create({
    data: {
      dojoId,
      name:        body.name,
      beltColor:   body.beltColor,
      order:       Number(body.order) || 0,
      description: body.description ?? null,
    },
  });
  revalidateTag(CACHE_TAGS.katas(dojoId));
  return NextResponse.json(kata, { status: 201 });
}
