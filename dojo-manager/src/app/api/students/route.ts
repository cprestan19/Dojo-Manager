import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  if (!dojoId) return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });

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
    // Select only fields needed by the student list UI.
    // photo is omitted here — base64 images load in the student profile page only.
    select: {
      id: true, studentCode: true, fullName: true, firstName: true, lastName: true,
      birthDate: true, gender: true, active: true, createdAt: true,
      cedula: true, nationality: true,
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

  return NextResponse.json(students);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  if (!dojoId) return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });

  try {
    const body = await req.json();

    const maxCodeResult = await prisma.student.aggregate({ _max: { studentCode: true } });
    const studentCode   = (maxCodeResult._max.studentCode ?? 999) + 1;

    const student = await prisma.student.create({
      data: {
        dojoId,
        studentCode,
        fullName:            String(body.fullName ?? (body.firstName + " " + (body.lastName ?? "")).trim()),
        firstName:           body.firstName,
        lastName:            body.lastName,
        cedula:              body.cedula              ?? null,
        fepakaId:            body.fepakaId    ? String(body.fepakaId).toUpperCase()    : null,
        ryoBukaiId:          body.ryoBukaiId  ? String(body.ryoBukaiId).toUpperCase()  : null,
        photo:               body.photo               ?? null,
        birthDate:           new Date(body.birthDate),
        gender:              body.gender,
        nationality:         body.nationality,
        condition:           body.condition           ?? null,
        bloodType:           body.bloodType           ?? null,
        hasPrivateInsurance: body.hasPrivateInsurance ?? false,
        insuranceName:       body.insuranceName       ?? null,
        insuranceNumber:     body.insuranceNumber     ?? null,
        motherName:          body.motherName          ?? null,
        motherPhone:         body.motherPhone         ?? null,
        motherEmail:         body.motherEmail         ?? null,
        fatherName:          body.fatherName          ?? null,
        fatherPhone:         body.fatherPhone         ?? null,
        fatherEmail:         body.fatherEmail         ?? null,
        address:             body.address             ?? null,
      },
    });

    return NextResponse.json(student, { status: 201 });
  } catch (err) {
    console.error("POST /api/students error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
