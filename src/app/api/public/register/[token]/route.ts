import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";

const GENERIC_ERROR = "No se pudo procesar la solicitud. Verifica el enlace e intenta de nuevo.";

const RegisterSchema = z.object({
  fullName:    z.string().min(2).max(200),
  firstName:   z.string().min(1).max(100),
  lastName:    z.string().min(1).max(100),
  birthDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  gender:      z.enum(["M", "F"]),
  nationality: z.string().min(2).max(100),
  cedula:      z.string().max(30).optional().nullable(),
  fepakaId:    z.string().max(15).optional().nullable(),
  ryoBukaiId:  z.string().max(15).optional().nullable(),

  bloodType:           z.enum(["O+","O-","A+","A-","B+","B-","AB+","AB-"]).optional().nullable(),
  condition:           z.string().max(500).optional().nullable(),
  hasPrivateInsurance: z.boolean().optional().default(false),
  insuranceName:       z.string().max(200).optional().nullable(),
  insuranceNumber:     z.string().max(25).optional().nullable(),

  motherName:  z.string().max(200).optional().nullable(),
  motherPhone: z.string().max(30).optional().nullable(),
  motherEmail: z.string().email().optional().nullable().or(z.literal("")),
  fatherName:  z.string().max(200).optional().nullable(),
  fatherPhone: z.string().max(30).optional().nullable(),
  fatherEmail: z.string().email().optional().nullable().or(z.literal("")),
  address:     z.string().max(500).optional().nullable(),
});

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ip = getIp(req);

  const link = await prisma.registrationLink.findUnique({
    where:  { token },
    select: { id: true, dojoId: true, isActive: true, activatesAt: true, expiresAt: true, maxUses: true, useCount: true },
  });

  const now = new Date();
  const isValid =
    link &&
    link.isActive &&
    (!link.activatesAt || link.activatesAt <= now) &&
    (!link.expiresAt   || link.expiresAt   >= now) &&
    (link.maxUses == null || link.useCount < link.maxUses);

  if (!isValid) {
    return NextResponse.json({ ok: true });
  }

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });

  const parsed = RegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const body = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.pendingStudent.create({
        data: {
          dojoId:             link.dojoId,
          registrationLinkId: link.id,
          submitterIp:        ip,
          fullName:           body.fullName.trim(),
          firstName:          body.firstName.trim(),
          lastName:           body.lastName.trim(),
          birthDate:          new Date(body.birthDate),
          gender:             body.gender,
          nationality:        body.nationality.trim(),
          cedula:             body.cedula        || null,
          fepakaId:           body.fepakaId     ? body.fepakaId.toUpperCase()    : null,
          ryoBukaiId:         body.ryoBukaiId   ? body.ryoBukaiId.toUpperCase()  : null,
          bloodType:          body.bloodType    || null,
          condition:          body.condition    || null,
          hasPrivateInsurance: body.hasPrivateInsurance ?? false,
          insuranceName:      body.insuranceName  || null,
          insuranceNumber:    body.insuranceNumber || null,
          motherName:         body.motherName  || null,
          motherPhone:        body.motherPhone || null,
          motherEmail:        body.motherEmail || null,
          fatherName:         body.fatherName  || null,
          fatherPhone:        body.fatherPhone || null,
          fatherEmail:        body.fatherEmail || null,
          address:            body.address     || null,
        },
      });
      await tx.registrationLink.update({
        where: { id: link.id },
        data:  { useCount: { increment: 1 } },
      });
    });

    await logAudit({
      action:       "PENDING_STUDENT_SUBMITTED",
      module:       AUDIT_MODULE.STUDENTS,
      dojoId:       link.dojoId,
      resourceType: "PendingStudent",
      ip,
      details:      JSON.stringify({ fullName: body.fullName, linkId: link.id }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/public/register error:", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
