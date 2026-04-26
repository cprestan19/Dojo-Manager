import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId } = session.user as SessionUser;
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  // sysadmin can see users from all dojos; admin only sees their dojo
  const users = await prisma.user.findMany({
    where: role === "sysadmin" ? {} : { dojoId: dojoId ?? undefined },
    select: { id: true, name: true, email: true, role: true, active: true, dojoId: true, createdAt: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId } = session.user as SessionUser;
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json();

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });

  const hashed = await bcrypt.hash(body.password, 12);

  // admin creates users in their own dojo; sysadmin can specify dojoId
  const targetDojoId = role === "sysadmin" ? (body.dojoId ?? null) : dojoId;

  const user = await prisma.user.create({
    data: { name: body.name, email: body.email, password: hashed, role: body.role ?? "user", dojoId: targetDojoId },
    select: { id: true, name: true, email: true, role: true, active: true, dojoId: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
