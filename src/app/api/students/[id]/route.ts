import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const student = await prisma.student.findUnique({
    where: { id: params.id },
    include: {
      inscription: true,
      payments: { orderBy: { dueDate: "desc" } },
      beltHistory: {
        orderBy: { changeDate: "desc" },
        include: { kata: true },
      },
    },
  });

  if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  return NextResponse.json(student);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();

  const student = await prisma.student.update({
    where: { id: params.id },
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
      active:              body.active ?? true,
    },
  });

  // Upsert inscription
  if (body.inscription) {
    await prisma.inscription.upsert({
      where:  { studentId: params.id },
      create: {
        studentId:        params.id,
        inscriptionDate:  new Date(body.inscription.inscriptionDate),
        annualPaymentDate: body.inscription.annualPaymentDate ? new Date(body.inscription.annualPaymentDate) : null,
        annualAmount:     Number(body.inscription.annualAmount)  || 0,
        monthlyAmount:    Number(body.inscription.monthlyAmount) || 0,
        discountAmount:   Number(body.inscription.discountAmount) || 0,
        discountNote:     body.inscription.discountNote ?? null,
      },
      update: {
        inscriptionDate:  new Date(body.inscription.inscriptionDate),
        annualPaymentDate: body.inscription.annualPaymentDate ? new Date(body.inscription.annualPaymentDate) : null,
        annualAmount:     Number(body.inscription.annualAmount)  || 0,
        monthlyAmount:    Number(body.inscription.monthlyAmount) || 0,
        discountAmount:   Number(body.inscription.discountAmount) || 0,
        discountNote:     body.inscription.discountNote ?? null,
      },
    });
  }

  return NextResponse.json(student);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  await prisma.student.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
