/**
 * POST /api/students/bulk-portal-access
 * Activa el acceso al portal para múltiples alumnos en una sola llamada.
 * Body: { studentIds?: string[] }
 *   - Si se omite studentIds → procesa TODOS los alumnos del dojo sin portal activo
 *   - Si se provee → solo esos alumnos (validando que pertenezcan al dojo)
 *
 * Usa exactamente la misma lógica que POST /api/students/[id]/access.
 * No modifica ningún archivo existente.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { sendStudentWelcome } from "@/lib/email";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { checkGuardianEmailConflict, checkExistingStudentPortalUser } from "@/lib/portal-email-guard";
import { getFamilyPrincipal } from "@/lib/family";
import { withPlanFeatureGuard } from "@/lib/billing/planFeatureGuard";
import { NAV_KEYS } from "@/lib/permissions";

type SessionUser = { role?: string; dojoId?: string | null };

/** Igual al generatePassword() del endpoint individual */
function generatePassword(): string {
  const upper   = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower   = "abcdefghjkmnpqrstuvwxyz";
  const digits  = "23456789";
  const special = "@#$!";
  const all     = upper + lower + digits + special;
  const pick    = (set: string) => set[randomInt(set.length)];
  const chars   = [pick(upper), pick(lower), pick(digits), pick(special),
    ...Array.from({ length: 8 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export interface BulkAccessResult {
  studentId:   string;
  fullName:    string;
  email:       string | null;
  status:      "activated" | "skipped_no_email" | "skipped_already_active" | "skipped_staff_conflict" | "skipped_family_conflict" | "skipped_not_principal" | "error";
  emailSent:   boolean;
  errorDetail: string | null;
}

async function _POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { studentIds?: string[] };

  // Obtener alumnos del dojo (con o sin lista específica)
  const whereFilter = body.studentIds?.length
    ? { id: { in: body.studentIds }, dojoId, active: true }
    : { dojoId, active: true };

  const students = await prisma.student.findMany({
    where:  whereFilter,
    select: {
      id: true, fullName: true, dojoId: true,
      motherEmail: true, fatherEmail: true, familyId: true,
      portalUser: { select: { id: true, active: true, email: true } },
    },
    orderBy: { fullName: "asc" },
  });

  // Cache de principal por familyId para no repetir la consulta por cada hermano
  const effectiveDojoId: string = dojoId;
  const familyPrincipalCache = new Map<string, Awaited<ReturnType<typeof getFamilyPrincipal>>>();
  async function resolveFamilyPrincipal(familyId: string) {
    if (!familyPrincipalCache.has(familyId)) {
      familyPrincipalCache.set(familyId, await getFamilyPrincipal(effectiveDojoId, familyId));
    }
    return familyPrincipalCache.get(familyId)!;
  }

  // Cargar datos del dojo UNA sola vez (para el correo)
  const dojoRaw = await prisma.dojo.findUnique({
    where:  { id: dojoId },
    select: { name: true, email: true, phone: true, logo: true, slogan: true, ownerName: true },
  });
  const dojoMeta = dojoRaw
    ? { ...dojoRaw, logo: dojoRaw.logo?.startsWith("http") ? dojoRaw.logo : null }
    : undefined;

  const results: BulkAccessResult[] = [];
  const ctx = buildAuditCtx(session, req, { dojoId });

  // Pase secuencial previo: si dos hermanos comparten el mismo correo de
  // acudiente y ambos se procesaran en el mismo lote paralelo, ambos harían
  // upsert(User) por el mismo email al mismo tiempo (condición de carrera —
  // el segundo en escribir se queda con la cuenta). Se reclama cada correo
  // en orden antes de paralelizar, para que solo el primer hermano de cada
  // correo compartido llegue al procesamiento real.
  const claimedEmails = new Map<string, string>(); // email -> fullName del primero
  const toProcess: typeof students = [];
  for (const student of students) {
    if (student.portalUser?.active) { toProcess.push(student); continue; }
    const rawEmail = (student.motherEmail?.trim() || student.fatherEmail?.trim() || null)?.toLowerCase() ?? null;
    if (rawEmail && claimedEmails.has(rawEmail)) {
      results.push({ studentId: student.id, fullName: student.fullName,
        email: rawEmail, status: "skipped_family_conflict", emailSent: false,
        errorDetail: `Correo ya reclamado en este mismo lote por ${claimedEmails.get(rawEmail)}` });
      continue;
    }
    if (rawEmail) claimedEmails.set(rawEmail, student.fullName);
    toProcess.push(student);
  }

  // Procesar en lotes de 5 para no saturar SMTP ni el pool de BD
  const BATCH = 5;
  for (let i = 0; i < toProcess.length; i += BATCH) {
    const batch = toProcess.slice(i, i + BATCH);

    await Promise.all(batch.map(async student => {
      // Ya tiene portal activo → skip
      if (student.portalUser?.active) {
        results.push({ studentId: student.id, fullName: student.fullName,
          email: student.portalUser.email, status: "skipped_already_active",
          emailSent: false, errorDetail: null });
        return;
      }

      // Siempre en minúsculas para coincidir con el lookup de auth.ts (credentials.email.toLowerCase())
      const rawEmail = student.motherEmail?.trim() || student.fatherEmail?.trim() || null;
      const email = rawEmail ? rawEmail.toLowerCase() : null;

      // Sin email → skip (no se puede crear acceso)
      if (!email) {
        results.push({ studentId: student.id, fullName: student.fullName,
          email: null, status: "skipped_no_email",
          emailSent: false, errorDetail: "Sin email registrado" });
        return;
      }

      try {
        // Solo el familiar principal (hermano activo más antiguo del familyId)
        // puede tener acceso propio al portal.
        if (student.familyId) {
          const principal = await resolveFamilyPrincipal(student.familyId);
          if (principal && principal.id !== student.id) {
            results.push({ studentId: student.id, fullName: student.fullName,
              email, status: "skipped_not_principal", emailSent: false,
              errorDetail: `Solo ${principal.fullName} (familiar principal) puede tener acceso` });
            return;
          }
        }

        // El correo del acudiente no puede pertenecer a una cuenta que no sea de alumno
        // (admin/user/sysadmin) — evita secuestrar cuentas de staff vía upsert por email.
        const emailConflict = await checkGuardianEmailConflict(email);
        if (emailConflict) {
          results.push({ studentId: student.id, fullName: student.fullName,
            email, status: "skipped_staff_conflict", emailSent: false,
            errorDetail: emailConflict });
          return;
        }

        // Familia con correo compartido: si un hermano de una ejecución
        // anterior ya tiene el acceso activo con este correo, no reasignarlo.
        const siblingConflict = await checkExistingStudentPortalUser(email, student.id);
        if (siblingConflict) {
          results.push({ studentId: student.id, fullName: student.fullName,
            email, status: "skipped_family_conflict", emailSent: false,
            errorDetail: `Ya tiene acceso activo ${siblingConflict.fullName} con este correo` });
          return;
        }

        const plainPassword = generatePassword();
        const hashed        = await bcrypt.hash(plainPassword, 12);

        // Desactivar usuario anterior si el email cambió
        const prev = student.portalUser;
        if (prev && prev.email !== email) {
          await prisma.user.update({
            where: { id: prev.id },
            data:  { active: false, studentId: null },
          });
        }

        await prisma.user.upsert({
          where:  { email },
          create: { email, password: hashed, name: student.fullName, role: "student",
                    dojoId: student.dojoId, studentId: student.id,
                    mustChangePassword: true, active: true },
          update: { password: hashed, name: student.fullName, role: "student",
                    dojoId: student.dojoId, studentId: student.id,
                    mustChangePassword: true, active: true },
        });

        // Enviar correo
        let emailSent  = false;
        let emailError: string | null = null;
        try {
          await sendStudentWelcome({
            to: email, studentName: student.fullName,
            loginEmail: email, tempPassword: plainPassword, dojo: dojoMeta,
          });
          emailSent = true;
        } catch (err) {
          emailError = err instanceof Error ? err.message : String(err);
        }

        // Audit log por alumno
        await logAudit({
          ...ctx,
          action:       "PORTAL_ACCESS_GRANTED",
          module:       AUDIT_MODULE.PORTAL,
          resourceType: "Student",
          resourceId:   student.id,
          targetEmail:  email,
          statusCode:   201,
          details:      JSON.stringify({ studentName: student.fullName, email, emailSent, bulk: true }),
        });

        results.push({
          studentId: student.id, fullName: student.fullName, email,
          status: "activated", emailSent,
          errorDetail: emailError,
        });
      } catch (err) {
        results.push({
          studentId: student.id, fullName: student.fullName, email,
          status: "error", emailSent: false,
          errorDetail: err instanceof Error ? err.message : "Error desconocido",
        });
      }
    }));
  }

  // Resumen
  const activated    = results.filter(r => r.status === "activated").length;
  const emailsSent   = results.filter(r => r.emailSent).length;
  const noEmail      = results.filter(r => r.status === "skipped_no_email").length;
  const alreadyActive = results.filter(r => r.status === "skipped_already_active").length;
  const staffConflict = results.filter(r => r.status === "skipped_staff_conflict").length;
  const familyConflict = results.filter(r => r.status === "skipped_family_conflict").length;
  const notPrincipal = results.filter(r => r.status === "skipped_not_principal").length;
  const errors       = results.filter(r => r.status === "error").length;

  return NextResponse.json({
    ok: true,
    summary: { activated, emailsSent, noEmail, alreadyActive, staffConflict, familyConflict, notPrincipal, errors, total: results.length },
    results,
  });
}

export const POST = withPlanFeatureGuard(NAV_KEYS.PORTAL_ACCESS, _POST);
