import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DEFAULT_PERMISSIONS, ALL_DOJO_KEYS, NAV_KEYS } from "@/lib/permissions";

type SessionUser = { role?: string; dojoId?: string | null };

// Built-in role definitions returned for display
const SYSTEM_ROLES = [
  {
    roleName:    "sysadmin",
    roleLabel:   "Super Admin",
    roleColor:   "red",
    isSystem:    true,
    permissions: [...ALL_DOJO_KEYS, NAV_KEYS.DOJOS],
    description: "Acceso global a todos los dojos y configuración de plataforma",
  },
  {
    roleName:    "admin",
    roleLabel:   "Administrador",
    roleColor:   "blue",
    isSystem:    true,
    permissions: ALL_DOJO_KEYS,
    description: "Gestión completa del dojo — alumnos, pagos, usuarios y configuración",
  },
  {
    roleName:    "user",
    roleLabel:   "Usuario",
    roleColor:   "green",
    isSystem:    true,
    permissions: DEFAULT_PERMISSIONS.user,
    description: "Acceso básico personalizable según la configuración del dojo",
  },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId } = session.user as SessionUser;
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (role !== "sysadmin" && !dojoId)
    return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });

  const targetDojoId = dojoId ?? "__global__";

  // Fetch customized system roles and any custom roles for this dojo
  const dbRecords = dojoId
    ? await prisma.dojoRolePermission.findMany({ where: { dojoId }, orderBy: { createdAt: "asc" } })
    : [];

  // Merge: for system roles, apply DB overrides if they exist
  const systemWithOverrides = SYSTEM_ROLES.map(sr => {
    const override = dbRecords.find(r => r.roleName === sr.roleName);
    return {
      id:          override?.id ?? null,
      roleName:    sr.roleName,
      roleLabel:   override?.roleLabel   ?? sr.roleLabel,
      roleColor:   override?.roleColor   ?? sr.roleColor,
      isSystem:    true,
      permissions: override?.permissions ?? sr.permissions,
      description: sr.description,
      isCustomized: !!override,
    };
  });

  // Custom (non-system) roles
  const customRoles = dbRecords
    .filter(r => !SYSTEM_ROLES.find(s => s.roleName === r.roleName))
    .map(r => ({
      id:          r.id,
      roleName:    r.roleName,
      roleLabel:   r.roleLabel,
      roleColor:   r.roleColor,
      isSystem:    false,
      permissions: r.permissions,
      description: null,
      isCustomized: true,
    }));

  // Suppress sysadmin row for non-sysadmin viewers
  const result = role === "sysadmin"
    ? [...systemWithOverrides, ...customRoles]
    : [...systemWithOverrides.filter(r => r.roleName !== "sysadmin"), ...customRoles];

  return NextResponse.json({ roles: result, dojoId: targetDojoId });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId } = session.user as SessionUser;
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId) return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });

  const body = await req.json();
  if (!body.roleName?.trim()) return NextResponse.json({ error: "Nombre del rol requerido" }, { status: 400 });
  if (!body.roleLabel?.trim()) return NextResponse.json({ error: "Etiqueta del rol requerida" }, { status: 400 });

  // Prevent creating roles with system names
  const systemNames = ["sysadmin", "admin", "user", "student"];
  if (systemNames.includes(body.roleName.toLowerCase()))
    return NextResponse.json({ error: "Ese nombre está reservado para roles del sistema" }, { status: 400 });

  const cleanName = body.roleName.trim().toLowerCase().replace(/\s+/g, "_");

  // Duplicate check
  const existing = await prisma.dojoRolePermission.findUnique({
    where: { dojoId_roleName: { dojoId, roleName: cleanName } },
  });
  if (existing) return NextResponse.json({ error: `Ya existe un rol con el identificador "${cleanName}"` }, { status: 409 });

  try {
    const record = await prisma.dojoRolePermission.create({
      data: {
        dojoId,
        roleName:    cleanName,
        roleLabel:   body.roleLabel.trim(),
        roleColor:   body.roleColor ?? "blue",
        isSystem:    false,
        permissions: Array.isArray(body.permissions) ? body.permissions : (DEFAULT_PERMISSIONS.user as unknown[]),
      },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    console.error("Error creating role:", err);
    return NextResponse.json({ error: "Error interno al crear el rol" }, { status: 500 });
  }
}
