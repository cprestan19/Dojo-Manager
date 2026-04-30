import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null; id?: string };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId, id: sessionUserId } = session.user as SessionUser;
    if (role !== "sysadmin" && role !== "admin")
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    // Admin can only modify users in their own dojo
    if (role === "admin" && target.dojoId !== dojoId)
      return NextResponse.json({ error: "Sin permisos sobre este usuario" }, { status: 403 });

    // Read body ONCE
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
    }

    // Prevent removing the last sysadmin
    if (target.role === "sysadmin") {
      const sysadminCount = await prisma.user.count({ where: { role: "sysadmin", active: true } });
      if (sysadminCount <= 1 && (body.active === false || (body.role !== undefined && body.role !== "sysadmin")))
        return NextResponse.json({ error: "No puedes desactivar o cambiar el último sysadmin" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.name  !== undefined) data.name  = String(body.name).trim();
    if (body.email !== undefined) {
      const newEmail = String(body.email).trim().toLowerCase();
      const existing = await prisma.user.findFirst({ where: { email: newEmail, NOT: { id } } });
      if (existing) return NextResponse.json({ error: "Email ya registrado por otro usuario" }, { status: 409 });
      data.email = newEmail;
    }
    if (body.role   !== undefined) data.role   = body.role;
    if (body.active !== undefined) data.active = body.active;
    if (body.photo  !== undefined) data.photo  = body.photo ?? null;
    if (body.mustChangePassword !== undefined) data.mustChangePassword = body.mustChangePassword;
    if (body.password) {
      const pwd = String(body.password);
      if (pwd.length < 8)
        return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
      data.password = await bcrypt.hash(pwd, 12);
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, name: true, email: true, role: true, active: true,
        photo: true, dojoId: true, createdAt: true,
        dojo: { select: { name: true, slug: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/users/[id] error:", err);
    const message = err instanceof Error ? err.message : "Error interno al actualizar el usuario";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId, id: sessionUserId } = session.user as SessionUser;
    if (role !== "sysadmin" && role !== "admin")
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    if (id === sessionUserId)
      return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (role === "admin" && target.dojoId !== dojoId)
      return NextResponse.json({ error: "Sin permisos sobre este usuario" }, { status: 403 });

    if (target.role === "sysadmin") {
      const count = await prisma.user.count({ where: { role: "sysadmin" } });
      if (count <= 1)
        return NextResponse.json({ error: "No puedes eliminar el último sysadmin" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/users/[id] error:", err);
    const message = err instanceof Error ? err.message : "Error interno al eliminar el usuario";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
