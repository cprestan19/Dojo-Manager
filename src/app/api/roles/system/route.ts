import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string; dojoId?: string | null };

// POST — creates or updates a system role permission override for the current dojo
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId } = session.user as SessionUser;
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId) return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });

  const body = await req.json();
  if (!body.roleName)   return NextResponse.json({ error: "roleName requerido" }, { status: 400 });
  if (!body.permissions) return NextResponse.json({ error: "permissions requerido" }, { status: 400 });

  const record = await prisma.dojoRolePermission.upsert({
    where:  { dojoId_roleName: { dojoId, roleName: body.roleName } },
    create: {
      dojoId,
      roleName:    body.roleName,
      roleLabel:   body.roleLabel  ?? body.roleName,
      roleColor:   body.roleColor  ?? "blue",
      isSystem:    true,
      permissions: body.permissions,
    },
    update: {
      roleLabel:   body.roleLabel   ?? undefined,
      roleColor:   body.roleColor   ?? undefined,
      permissions: body.permissions,
    },
  });

  return NextResponse.json(record, { status: 200 });
}
