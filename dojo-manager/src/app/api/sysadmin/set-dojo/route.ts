import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role } = session.user as SessionUser;
  if (role !== "sysadmin")
    return NextResponse.json({ error: "Solo sysadmin" }, { status: 403 });

  const { dojoId } = await req.json();
  if (!dojoId) return NextResponse.json({ error: "dojoId requerido" }, { status: 400 });

  // Verify the dojo exists
  const dojo = await prisma.dojo.findUnique({
    where:  { id: dojoId },
    select: { id: true, name: true, slug: true },
  });
  if (!dojo) return NextResponse.json({ error: "Dojo no encontrado" }, { status: 404 });

  const res = NextResponse.json({ ok: true, dojo });

  // Set session-scoped cookie (cleared when browser closes)
  res.cookies.set("sx-dojo",      dojo.id,   { path: "/", sameSite: "lax", httpOnly: false });
  res.cookies.set("sx-dojo-name", dojo.name, { path: "/", sameSite: "lax", httpOnly: false });

  return res;
}
