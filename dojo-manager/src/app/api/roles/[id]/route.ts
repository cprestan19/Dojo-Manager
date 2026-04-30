import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId } = session.user as SessionUser;
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId) return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });

  const body = await req.json();

  // Upsert: PUT for system roles creates the override record; for custom roles updates it
  const existing = await prisma.dojoRolePermission.findFirst({ where: { id, dojoId } });

  if (existing) {
    const updated = await prisma.dojoRolePermission.update({
      where: { id },
      data: {
        roleLabel:   body.roleLabel   ?? existing.roleLabel,
        roleColor:   body.roleColor   ?? existing.roleColor,
        permissions: body.permissions ?? existing.permissions,
      },
    });
    return NextResponse.json(updated);
  }

  // For system roles that have no DB record yet — create override
  if (body.roleName && body.permissions) {
    const created = await prisma.dojoRolePermission.upsert({
      where: { dojoId_roleName: { dojoId, roleName: body.roleName } },
      create: {
        dojoId,
        roleName:    body.roleName,
        roleLabel:   body.roleLabel ?? body.roleName,
        roleColor:   body.roleColor ?? "blue",
        isSystem:    body.isSystem ?? false,
        permissions: body.permissions,
      },
      update: {
        roleLabel:   body.roleLabel   ?? undefined,
        roleColor:   body.roleColor   ?? undefined,
        permissions: body.permissions,
      },
    });
    return NextResponse.json(created);
  }

  return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId } = session.user as SessionUser;
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId) return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });

  const existing = await prisma.dojoRolePermission.findFirst({ where: { id, dojoId } });
  if (!existing) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  // Don't allow deleting system role overrides via this route — use PUT to reset
  if (existing.isSystem)
    return NextResponse.json({ error: "No se pueden eliminar roles del sistema" }, { status: 400 });

  // Check if any users have this custom role
  const usersWithRole = await prisma.user.count({ where: { dojoId, role: existing.roleName } });
  if (usersWithRole > 0)
    return NextResponse.json({
      error: `${usersWithRole} usuario(s) tienen asignado este rol. Reasígnalos antes de eliminar.`
    }, { status: 409 });

  await prisma.dojoRolePermission.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
