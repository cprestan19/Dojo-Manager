import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendStudentWelcome } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

function generatePassword(): string {
  const upper  = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower  = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "@#$!";
  const all    = upper + lower + digits + special;
  const random = (set: string) => set[Math.floor(Math.random() * set.length)];
  const chars  = [random(upper), random(lower), random(digits), random(special),
    ...Array.from({ length: 8 }, () => random(all))];
  return chars.sort(() => Math.random() - 0.5).join("");
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const student = await prisma.student.findUnique({
    where:   { id, ...(dojoId ? { dojoId } : {}) },
    select: {
      id: true, fullName: true, dojoId: true,
      motherEmail: true, fatherEmail: true,
      portalUser: { select: { id: true, active: true, email: true } },
    },
  });
  if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  if (!student.motherEmail && !student.fatherEmail)
    return NextResponse.json({ error: "El alumno no tiene correo registrado" }, { status: 400 });

  const email = student.motherEmail ?? student.fatherEmail!;

  if (student.portalUser?.active) {
    return NextResponse.json({ error: "El alumno ya tiene acceso activo" }, { status: 400 });
  }

  const plainPassword = generatePassword();
  const hashed        = await bcrypt.hash(plainPassword, 12);

  const user = await prisma.user.upsert({
    where:  { studentId: id },
    create: {
      email,
      password:          hashed,
      name:              student.fullName,
      role:              "student",
      dojoId:            student.dojoId,
      studentId:         id,
      mustChangePassword: true,
      active:            true,
    },
    update: {
      email,
      password:          hashed,
      name:              student.fullName,
      mustChangePassword: true,
      active:            true,
    },
  });

  let emailSent   = false;
  let emailError: string | null = null;

  try {
    const dojo = await prisma.dojo.findUnique({
      where:  { id: student.dojoId },
      select: { name: true, email: true, phone: true, logo: true, slogan: true, ownerName: true },
    });
    await sendStudentWelcome({
      to:            email,
      studentName:   student.fullName,
      loginEmail:    email,
      tempPassword:  plainPassword,
      dojo:          dojo ?? undefined,
    });
    emailSent = true;
  } catch (err) {
    emailError = err instanceof Error ? err.message : String(err);
    console.error("Welcome email error:", emailError);
  }

  return NextResponse.json({
    ok:           true,
    email,
    tempPassword: plainPassword,
    userId:       user.id,
    emailSent,
    emailError,   // null if sent OK, message if failed
  }, { status: 201 });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const student = await prisma.student.findUnique({
    where:   { id, ...(dojoId ? { dojoId } : {}) },
    select: {
      id: true, fullName: true, dojoId: true,
      motherEmail: true, fatherEmail: true,
      portalUser: { select: { id: true, active: true, email: true } },
    },
  });
  if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  if (!student.portalUser) return NextResponse.json({ error: "Sin acceso activo" }, { status: 400 });

  await prisma.user.update({
    where: { id: student.portalUser.id },
    data:  { active: false },
  });

  return NextResponse.json({ ok: true });
}
