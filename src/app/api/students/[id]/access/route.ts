import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendStudentWelcome } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

function generatePassword(): string {
  const upper   = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower   = "abcdefghjkmnpqrstuvwxyz";
  const digits  = "23456789";
  const special = "@#$!";
  const all     = upper + lower + digits + special;
  const random  = (set: string) => set[Math.floor(Math.random() * set.length)];
  const chars   = [random(upper), random(lower), random(digits), random(special),
    ...Array.from({ length: 8 }, () => random(all))];
  return chars.sort(() => Math.random() - 0.5).join("");
}

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin")
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const student = await prisma.student.findUnique({
      where:  { id, ...(dojoId ? { dojoId } : {}) },
      select: {
        id: true, fullName: true, dojoId: true,
        motherEmail: true, fatherEmail: true,
        portalUser: { select: { id: true, active: true, email: true } },
      },
    });
    if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

    // Use || so empty strings are treated as missing
    const email = student.motherEmail?.trim() || student.fatherEmail?.trim() || null;
    if (!email)
      return NextResponse.json({ error: "El alumno no tiene correo registrado" }, { status: 400 });

    if (student.portalUser?.active)
      return NextResponse.json({ error: "El alumno ya tiene acceso activo" }, { status: 400 });

    const plainPassword = generatePassword();
    const hashed        = await bcrypt.hash(plainPassword, 12);

    // ── Create / restore portal access ──────────────────────────────
    // Always upsert by email so we handle every case without constraint errors:
    //
    // Case 1 — no portal user exists for this email → CREATE
    // Case 2 — a user with this email exists (linked or not) → UPDATE credentials
    // Case 3 — student had a different email before → old user stays inactive,
    //          new email gets a fresh/updated user linked to this student
    //
    // After upsert, make sure any previous portal user (different email) is deactivated.
    const previousUser = student.portalUser ?? null;

    // If the student already has a portal user with a DIFFERENT email,
    // release its studentId first — otherwise the upsert CREATE path
    // will hit a unique constraint on student_id.
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

    // ── Send welcome email ───────────────────────────────────────────
    let emailSent  = false;
    let emailError: string | null = null;
    try {
      const dojoRaw = await prisma.dojo.findUnique({
        where:  { id: student.dojoId },
        select: { name: true, email: true, phone: true, logo: true, slogan: true, ownerName: true },
      });
      const dojo = dojoRaw
        ? { ...dojoRaw, logo: dojoRaw.logo?.startsWith("http") ? dojoRaw.logo : null }
        : undefined;

      await sendStudentWelcome({
        to:           email,
        studentName:  student.fullName,
        loginEmail:   email,
        tempPassword: plainPassword,
        dojo,
      });
      emailSent = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err);
      console.error("[access] Welcome email failed:", emailError);
    }

    return NextResponse.json({
      ok: true, email, tempPassword: plainPassword,
      emailSent, emailError,
    }, { status: 201 });

  } catch (err) {
    console.error("[access] POST error:", err instanceof Error ? err.message : err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Error interno",
    }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin")
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const student = await prisma.student.findUnique({
      where:  { id, ...(dojoId ? { dojoId } : {}) },
      select: { portalUser: { select: { id: true } } },
    });
    if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    if (!student.portalUser) return NextResponse.json({ error: "Sin acceso activo" }, { status: 400 });

    await prisma.user.update({
      where: { id: student.portalUser.id },
      data:  { active: false },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[access] DELETE error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
