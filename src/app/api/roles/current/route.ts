import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  resolvePermissions, DEFAULT_PERMISSIONS, ALL_DOJO_KEYS,
  NAV_KEYS, SYSADMIN_NO_DOJO_PERMS,
} from "@/lib/permissions";
import type { NavKey } from "@/lib/permissions";
import { getEffectivePlanFeatures, hasTournamentsAccess } from "@/lib/billing/featureGate";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId } = session.user as SessionUser;

  if (role === "sysadmin") {
    const sxDojo    = req.cookies.get("sx-dojo")?.value;
    const isPreview = req.cookies.get("sx-preview")?.value === "1";

    // Vista previa: exactamente lo que vería el admin real de ese dojo —
    // permisos personalizados del rol (DojoRolePermission) intersecados con
    // lo que su plan efectivamente incluye. No es "modo mantenimiento": aquí
    // el sysadmin renuncia a su acceso total para visualizar el dashboard tal
    // cual lo ve el cliente.
    if (sxDojo && isPreview) {
      const record = await prisma.dojoRolePermission.findUnique({
        where:  { dojoId_roleName: { dojoId: sxDojo, roleName: "admin" } },
        select: { permissions: true },
      });
      const rolePerms    = resolvePermissions("admin", record);
      const planFeatures = await getEffectivePlanFeatures(sxDojo);
      const perms = new Set([...rolePerms].filter(k => planFeatures.has(k)));
      const tournamentsAccess = await hasTournamentsAccess(sxDojo);
      return NextResponse.json({ permissions: [...perms] as NavKey[], isPreview: true, hasTournamentsAccess: tournamentsAccess });
    }

    // Modo mantenimiento (dojo activo, sin preview) → acceso total + gestión de dojos
    if (sxDojo) {
      return NextResponse.json({ permissions: [...ALL_DOJO_KEYS, NAV_KEYS.DOJOS] as NavKey[], isPreview: false, hasTournamentsAccess: true });
    }
    // Sin dojo activo → solo gestión de plataforma
    return NextResponse.json({ permissions: SYSADMIN_NO_DOJO_PERMS, isPreview: false, hasTournamentsAccess: false });
  }

  if (!dojoId) {
    const fallback = DEFAULT_PERMISSIONS[role ?? "user"] ?? DEFAULT_PERMISSIONS.user;
    return NextResponse.json({ permissions: fallback, isPreview: false, hasTournamentsAccess: false });
  }

  const record = await prisma.dojoRolePermission.findUnique({
    where:  { dojoId_roleName: { dojoId, roleName: role ?? "user" } },
    select: { permissions: true },
  });

  const rolePerms   = resolvePermissions(role ?? "user", record);
  const planFeatures = await getEffectivePlanFeatures(dojoId);
  // Lo que el rol permitiría ∩ lo que el plan del dojo efectivamente incluye.
  // COMPLIMENTARY y planes legado (featureKeys=null) devuelven ALL_DOJO_KEYS,
  // así que esta intersección no cambia nada para ellos.
  const perms = new Set([...rolePerms].filter(k => planFeatures.has(k)));
  // Torneo Pro tiene su propio interruptor histórico (Dojo.tournamentPro) que
  // coexiste con el plan — se expone aparte porque NAV_KEYS.TOURNAMENTS no
  // participa del set de permisos estándar (ver comentario en permissions.ts).
  const tournamentsAccess = await hasTournamentsAccess(dojoId);

  // no-store: esta respuesta cambia por usuario/plan y el navegador no varía
  // el caché HTTP por cookie de sesión — con max-age podía servirle a un
  // usuario la respuesta cacheada de OTRO usuario/rol en el mismo navegador
  // (ej. sysadmin probando varias cuentas de prueba seguidas).
  return NextResponse.json(
    { permissions: [...perms] as NavKey[], isPreview: false, hasTournamentsAccess: tournamentsAccess },
    { headers: { "Cache-Control": "no-store" } },
  );
}
