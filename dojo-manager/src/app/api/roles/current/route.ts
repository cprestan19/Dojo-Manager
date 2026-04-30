import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  resolvePermissions, DEFAULT_PERMISSIONS, ALL_DOJO_KEYS,
  NAV_KEYS, SYSADMIN_NO_DOJO_PERMS,
} from "@/lib/permissions";
import type { NavKey } from "@/lib/permissions";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId } = session.user as SessionUser;

  if (role === "sysadmin") {
    const sxDojo = req.cookies.get("sx-dojo")?.value;
    // With active dojo context → full dojo permissions + dojos management
    if (sxDojo) {
      return NextResponse.json({ permissions: [...ALL_DOJO_KEYS, NAV_KEYS.DOJOS] as NavKey[] });
    }
    // Without context → only platform management
    return NextResponse.json({ permissions: SYSADMIN_NO_DOJO_PERMS });
  }

  if (!dojoId) {
    const fallback = DEFAULT_PERMISSIONS[role ?? "user"] ?? DEFAULT_PERMISSIONS.user;
    return NextResponse.json({ permissions: fallback });
  }

  const record = await prisma.dojoRolePermission.findUnique({
    where:  { dojoId_roleName: { dojoId, roleName: role ?? "user" } },
    select: { permissions: true },
  });

  const perms = resolvePermissions(role ?? "user", record);
  return NextResponse.json({ permissions: [...perms] as NavKey[] });
}
