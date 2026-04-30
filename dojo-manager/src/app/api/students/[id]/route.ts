import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

export async function GET( req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  // NOTE: role needed for sysadmin context — check SessionUser type
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const student = await prisma.student.findUnique({
    where: { id, dojoId },
    include: {
      portalUser: { select: { id: true, active: true, email: true } },
      inscription: true,
      payments: {
        orderBy: { dueDate: "desc" },
        take: 24,
      },
      beltHistory: {
        orderBy: { changeDate: "desc" },
        take: 50,
        select: {
          id: true, beltColor: true, changeDate: true, isRanking: true, notes: true,
          kata: { select: { id: true, name: true, beltColor: true } },
        },
      },
      kataCompetitions: {
        orderBy: { date: "desc" },
        take: 50,
        include: { kata: { select: { id: true, name: true } } },
      },
      dojo: { select: { name: true, phone: true, slug: true } },
    },
  });

  if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  return NextResponse.json(student);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  // NOTE: role needed for sysadmin context — check SessionUser type
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  try {
    const body = await req.json();

    const student = await prisma.student.update({
      where: { id, dojoId },
      data: {
        fullName:            String(body.fullName ?? (body.firstName + " " + (body.lastName ?? "")).trim()),
        firstName:           body.firstName,
        lastName:            body.lastName,
        cedula:              body.cedula ?? null,
        fepakaId:            body.fepakaId    ? String(body.fepakaId).toUpperCase()    : null,
        ryoBukaiId:          body.ryoBukaiId  ? String(body.ryoBukaiId).toUpperCase()  : null,
        photo:               body.photo ?? null,
        birthDate:           new Date(body.birthDate),
        gender:              body.gender,
        nationality:         body.nationality,
        condition:           body.condition ?? null,
        bloodType:           body.bloodType ?? null,
        hasPrivateInsurance: body.hasPrivateInsurance ?? false,
        insuranceName:       body.insuranceName ?? null,
        insuranceNumber:     body.insuranceNumber ?? null,
        motherName:          body.motherName ?? null,
        motherPhone:         body.motherPhone ?? null,
        motherEmail:         body.motherEmail ?? null,
        fatherName:          body.fatherName ?? null,
        fatherPhone:         body.fatherPhone ?? null,
        fatherEmail:         body.fatherEmail ?? null,
        address:             body.address ?? null,
        active:              body.active ?? true,
      },
    });

    if (body.inscription) {
      const ins = body.inscription;
      const inscriptionData = {
        inscriptionDate:   new Date(ins.inscriptionDate),
        annualPaymentDate: ins.annualPaymentDate ? new Date(ins.annualPaymentDate) : null,
        annualAmount:      Number(ins.annualAmount)   || 0,
        monthlyAmount:     Number(ins.monthlyAmount)  || 0,
        discountAmount:    Number(ins.discountAmount) || 0,
        discountNote:      ins.discountNote ?? null,
        paymentPeriod:     ins.paymentPeriod   ?? "monthly",
        biweeklyAmount:    Number(ins.biweeklyAmount) || 0,
      };
      await prisma.inscription.upsert({
        where:  { studentId: id },
        create: { studentId: id, ...inscriptionData },
        update: inscriptionData,
      });
    }

    return NextResponse.json(student);
  } catch (err) {
    console.error("PUT /api/students/[id] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE( req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  await prisma.student.delete({ where: { id, dojoId } });
  return NextResponse.json({ ok: true });
}
