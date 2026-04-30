import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { CreateStudentSchema, validationError } from "@/lib/validation";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const active = searchParams.get("active");

  const students = await prisma.student.findMany({
    where: {
      dojoId,
      ...(active !== null ? { active: active === "true" } : {}),
      ...(search ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName:  { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    },
    select: {
      id: true, studentCode: true, fullName: true, firstName: true, lastName: true,
      birthDate: true, gender: true, active: true, createdAt: true,
      cedula: true, nationality: true, photo: true,
      beltHistory: {
        orderBy: { changeDate: "desc" },
        take: 1,
        select: { beltColor: true },
      },
      inscription: {
        select: { monthlyAmount: true, annualAmount: true, inscriptionDate: true },
      },
      payments: {
        where: { status: { in: ["pending", "late"] } },
        orderBy: { dueDate: "asc" },
        take: 1,
        select: { id: true, status: true, amount: true, dueDate: true, type: true },
      },
    },
    orderBy: { lastName: "asc" },
  });

  // Strip any legacy base64 photos — only return Cloudinary URLs
  const sanitized = students.map(s => ({
    ...s,
    photo: s.photo?.startsWith("http") ? s.photo : null,
  }));
  return NextResponse.json(sanitized);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  try {
    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

    const parsed = CreateStudentSchema.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const body = parsed.data;

    const maxCodeResult = await prisma.student.aggregate({ _max: { studentCode: true } });
    const studentCode   = (maxCodeResult._max.studentCode ?? 999) + 1;

    const student = await prisma.student.create({
      data: {
        dojoId,
        studentCode,
        fullName:            body.fullName,
        firstName:           body.firstName,
        lastName:            body.lastName,
        cedula:              body.cedula              ?? null,
        fepakaId:            body.fepakaId    ? body.fepakaId.toUpperCase()    : null,
        ryoBukaiId:          body.ryoBukaiId  ? body.ryoBukaiId.toUpperCase()  : null,
        photo:               body.photo               ?? null,
        birthDate:           new Date(body.birthDate),
        gender:              body.gender,
        nationality:         body.nationality,
        condition:           body.condition           ?? null,
        bloodType:           body.bloodType || null,
        hasPrivateInsurance: body.hasPrivateInsurance ?? false,
        insuranceName:       body.insuranceName       ?? null,
        insuranceNumber:     body.insuranceNumber     ?? null,
        motherName:          body.motherName          ?? null,
        motherPhone:         body.motherPhone         ?? null,
        motherEmail:         body.motherEmail || null,
        fatherName:          body.fatherName          ?? null,
        fatherPhone:         body.fatherPhone         ?? null,
        fatherEmail:         body.fatherEmail || null,
        address:             body.address             ?? null,
      },
    });

    return NextResponse.json(student, { status: 201 });
  } catch (err) {
    console.error("POST /api/students error:", err);
    return NextResponse.json({ error: "Error interno al crear el alumno" }, { status: 500 });
  }
}
