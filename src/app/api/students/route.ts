import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const active = searchParams.get("active");

  const students = await prisma.student.findMany({
    where: {
      ...(active !== null ? { active: active === "true" } : {}),
      OR: search
        ? [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName:  { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: {
      beltHistory: { orderBy: { changeDate: "desc" }, take: 1, include: { kata: true } },
      inscription: true,
      payments: { where: { status: { in: ["pending", "late"] } }, orderBy: { dueDate: "asc" }, take: 1 },
    },
    orderBy: { lastName: "asc" },
  });

  return NextResponse.json(students);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();

  const student = await prisma.student.create({
    data: {
      firstName:           body.firstName,
      lastName:            body.lastName,
      photo:               body.photo ?? null,
      birthDate:           new Date(body.birthDate),
      gender:              body.gender,
      nationality:         body.nationality,
      allergy1:            body.allergy1 ?? null,
      allergy2:            body.allergy2 ?? null,
      hasPrivateInsurance: body.hasPrivateInsurance ?? false,
      insuranceName:       body.insuranceName ?? null,
      motherName:          body.motherName ?? null,
      motherPhone:         body.motherPhone ?? null,
      motherEmail:         body.motherEmail ?? null,
      fatherName:          body.fatherName ?? null,
      fatherPhone:         body.fatherPhone ?? null,
      fatherEmail:         body.fatherEmail ?? null,
      auxContactName:      body.auxContactName ?? null,
      auxContactPhone:     body.auxContactPhone ?? null,
      address:             body.address ?? null,
    },
  });

  return NextResponse.json(student, { status: 201 });
}
