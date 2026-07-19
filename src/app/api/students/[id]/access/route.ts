import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { sendStudentWelcome } from "@/lib/email";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { checkGuardianEmailConflict } from "@/lib/portal-email-guard";
import { withPlanFeatureGuard } from "@/lib/billing/planFeatureGuard";
import { NAV_KEYS } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

function generatePassword(): string {
  const upper   = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower   = "abcdefghjkmnpqrstuvwxyz";
  const digits  = "23456789";
  const special = "@#$!";
  const all     = upper + lower + digits + special;
  const pick    = (set: string) => set[randomInt(set.length)];
  const chars   = [pick(upper), pick(lower), pick(digits), pick(special),
    ...Array.from({ length: 8 }, () => pick(all))];
  // Fisher-Yates con CSPRNG
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function _POST(req: NextRequest, routeCtx: unknown) {
  try {
    const { id } = await (routeCtx as Params).params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin")
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const student = await prisma.student.findUnique({
      where:  { id, dojoId },
      select: {
        id: true, fullName: true, dojoId: true,
        motherEmail: true, fatherEmail: true,
        primaryGuardian: true,
        portalUser: { select: { id: true, active: true, email: true } },
      },
    });
    if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

    // Usar el email del acudiente principal si está definido; si no, fallback materno → paterno
    // Siempre en minúsculas para coincidir con el lookup de auth.ts (credentials.email.toLowerCase())
    const primaryEmail = student.primaryGuardian === "mother"
      ? student.motherEmail?.trim()
      : student.primaryGuardian === "father"
      ? student.fatherEmail?.trim()
      : null;
    const rawEmail = primaryEmail || student.motherEmail?.trim() || student.fatherEmail?.trim() || null;
    const email = rawEmail ? rawEmail.toLowerCase() : null;
    if (!email)
      return NextResponse.json({ error: "El alumno no tiene correo registrado" }, { status: 400 });

    if (student.portalUser?.active)
      return NextResponse.json({ error: "El alumno ya tiene acceso activo" }, { status: 400 });

    // El correo del acudiente no puede pertenecer a una cuenta que no sea de alumno
    // (admin/user/sysadmin) — evita secuestrar cuentas de staff vía upsert por email.
    const emailConflict = await checkGuardianEmailConflict(email);
    if (emailConflict) return NextResponse.json({ error: emailConflict }, { status: 409 });

    const plainPassword = generatePassword();
    const hashed        = await bcrypt.hash(plainPassword, 12);

    const previousUser = student.portalUser ?? null;
    if (previousUser && previousUser.email !== email) {
      await prisma.user.update({
        where: { id: previousUser.id },
        data:  { active: false, studentId: null },
      });
    }

    await prisma.user.upsert({
      where:  { email },
      create: {
        email,
        password:           hashed,
        name:               student.fullName,
        role:               "student",
        dojoId:             student.dojoId,
        studentId:          id,
        mustChangePassword: true,
        active:             true,
      },
      update: {
        password:           hashed,
        name:               student.fullName,
        role:               "student",
        dojoId:             student.dojoId,
        studentId:          id,
        mustChangePassword: true,
        active:             true,
      },
    });

    // ── Enviar correo de bienvenida ───────────────────────────────────
    let emailSent  = false;
    let emailError: string | null = null;
    try {
      const dojoRaw = await prisma.dojo.findUnique({
        where:  { id: student.dojoId },
        select: { name: true, slug: true, email: true, phone: true, logo: true, slogan: true, ownerName: true },
      });
      const dojo = dojoRaw
        ? { ...dojoRaw, logo: dojoRaw.logo?.startsWith("http") ? dojoRaw.logo : null }
        : undefined;

      await sendStudentWelcome({ to: email, studentName: student.fullName, loginEmail: email, tempPassword: plainPassword, dojo });
      emailSent = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err);
      console.error("[access] Welcome email failed:", emailError);
    }

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "PORTAL_ACCESS_GRANTED",
      module:       AUDIT_MODULE.PORTAL,
      resourceType: "Student",
      resourceId:   id,
      targetEmail:  email,
      statusCode:   201,
      details:      JSON.stringify({ studentName: student.fullName, email, emailSent, emailError }),
    });

    return NextResponse.json({
      ok: true, email,
      // tempPassword se devuelve UNA SOLA VEZ para que el admin pueda
      // compartirla manualmente si el correo falla. No se guarda en BD.
      tempPassword: plainPassword,
      emailSent, emailError,
    }, { status: 201 });

  } catch (err) {
    console.error("[access] POST error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}

export const POST = withPlanFeatureGuard(NAV_KEYS.PORTAL_ACCESS, _POST);

// DELETE (revocar) no se gatea por plan — siempre debe poder quitarse el
// acceso a un alumno, incluso si el dojo ya no tiene el plan que lo otorgó.
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin")
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const student = await prisma.student.findUnique({
      where:  { id, dojoId },
      select: { portalUser: { select: { id: true } } },
    });
    if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    if (!student.portalUser) return NextResponse.json({ error: "Sin acceso activo" }, { status: 400 });

    await prisma.user.update({
      where: { id: student.portalUser.id },
      data:  { active: false },
    });

    const ctx2 = buildAuditCtx(session, req as NextRequest, { dojoId });
    await logAudit({
      ...ctx2,
      action:       "PORTAL_ACCESS_REVOKED",
      module:       AUDIT_MODULE.PORTAL,
      resourceType: "Student",
      resourceId:   id,
      targetId:     student.portalUser.id,
      statusCode:   200,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[access] DELETE error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
