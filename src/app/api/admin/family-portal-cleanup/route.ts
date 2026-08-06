import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getFamilyPrincipal } from "@/lib/family";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string };

async function guardSysadmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }), session: null };
  const { role } = session.user as SessionUser;
  if (role !== "sysadmin")
    return { error: NextResponse.json({ error: "Sin permisos" }, { status: 403 }), session: null };
  return { error: null, session };
}

interface FamilyReport {
  dojoId: string;
  dojoName: string;
  familyId: string;
  principal: string;
  toRevoke: { studentId: string; fullName: string; userId: string; email: string }[];
}

/**
 * Recorre todos los dojos buscando alumnos con familyId + portalUser activo
 * y determina, por familia, cuáles accesos deben revocarse porque el alumno
 * NO es el familiar principal (hermano activo más antiguo del grupo).
 *
 * Migración one-time tras introducir la regla "solo el principal tiene
 * acceso al portal" — antes de esta regla, hermanos con correos distintos
 * podían activar acceso propio sin restricción (caso real: familia Prieto).
 */
async function buildReport(): Promise<FamilyReport[]> {
  const studentsWithAccess = await prisma.student.findMany({
    where: { active: true, familyId: { not: null }, portalUser: { active: true } },
    select: {
      id: true, fullName: true, dojoId: true, familyId: true,
      dojo: { select: { name: true } },
      portalUser: { select: { id: true, email: true } },
    },
  });

  const byFamily = new Map<string, typeof studentsWithAccess>();
  for (const s of studentsWithAccess) {
    const key = `${s.dojoId}::${s.familyId}`;
    if (!byFamily.has(key)) byFamily.set(key, []);
    byFamily.get(key)!.push(s);
  }

  const report: FamilyReport[] = [];
  for (const [key, group] of byFamily) {
    const [dojoId, familyId] = key.split("::");
    const principal = await getFamilyPrincipal(dojoId, familyId);
    const toRevoke = group.filter(s => !principal || s.id !== principal.id);
    if (toRevoke.length === 0) continue;

    report.push({
      dojoId,
      dojoName: group[0].dojo.name,
      familyId,
      principal: principal?.fullName ?? "(sin alumno activo en la familia)",
      toRevoke: toRevoke.map(s => ({
        studentId: s.id, fullName: s.fullName,
        userId: s.portalUser!.id, email: s.portalUser!.email,
      })),
    });
  }
  return report;
}

// GET — vista previa (solo lectura). Sysadmin puede revisar antes de ejecutar.
export async function GET() {
  const { error } = await guardSysadmin();
  if (error) return error;

  const report = await buildReport();
  const totalToRevoke = report.reduce((acc, r) => acc + r.toRevoke.length, 0);
  return NextResponse.json({ dryRun: true, families: report.length, totalToRevoke, report });
}

// POST — ejecuta la revocación real. Requiere { confirm: true } en el body.
// Puede acotarse a una sola familia con { dojoId, familyId } — recomendado
// para revisar y ejecutar de familia en familia en vez de todas a la vez.
export async function POST(req: NextRequest) {
  const { error, session } = await guardSysadmin();
  if (error) return error;

  const body = await req.json().catch(() => ({})) as { confirm?: boolean; dojoId?: string; familyId?: string };
  if (body.confirm !== true) {
    return NextResponse.json({ error: "Se requiere { confirm: true } para ejecutar la revocación" }, { status: 400 });
  }

  let report = await buildReport();
  if (body.dojoId && body.familyId) {
    report = report.filter(f => f.dojoId === body.dojoId && f.familyId === body.familyId);
    if (report.length === 0) {
      return NextResponse.json({ error: "No hay cambios pendientes para esa familia (ya está al día o no existe)" }, { status: 404 });
    }
  }

  const ctx = buildAuditCtx(session, req);

  // Un solo update para todos los usuarios a revocar en vez de uno por
  // usuario dentro del loop. El audit log SÍ se mantiene uno por usuario —
  // cada revocación necesita su propio registro trazable.
  const targetUserIds = report.flatMap(f => f.toRevoke.map(t => t.userId));
  if (targetUserIds.length > 0) {
    await prisma.user.updateMany({ where: { id: { in: targetUserIds } }, data: { active: false } });
  }

  let revokedCount = 0;
  for (const family of report) {
    for (const target of family.toRevoke) {
      revokedCount++;
      await logAudit({
        ...ctx,
        action:       "PORTAL_ACCESS_REVOKED",
        module:       AUDIT_MODULE.PORTAL,
        resourceType: "Student",
        resourceId:   target.studentId,
        targetId:     target.userId,
        dojoId:       family.dojoId,
        statusCode:   200,
        details:      JSON.stringify({
          reason: "family_portal_cleanup", familyId: family.familyId,
          studentName: target.fullName, email: target.email,
          keptPrincipal: family.principal,
        }),
      });
    }
  }

  return NextResponse.json({ ok: true, families: report.length, revokedCount });
}
