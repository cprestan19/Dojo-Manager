import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { CreateStudentSchema, validationError } from "@/lib/validation";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { withReadOnlyGuard } from "@/lib/billing/readOnlyGuard";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;

  if (role === "student") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

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
      id: true, fullName: true, firstName: true, lastName: true,
      birthDate: true, gender: true, nationality: true, active: true,
      photo: true,  // URL Cloudinary — segura en lista (es solo un string corto)
      familyId: true,
      beltHistory: {
        orderBy: { changeDate: "desc" },
        take: 1,
        select: { beltColor: true },
      },
      payments: {
        where: { status: { in: ["pending", "late"] } },
        orderBy: { dueDate: "asc" },
        take: 1,
        select: { status: true, dueDate: true },
      },
      // Portal access status
      portalUser: { select: { active: true } },
    },
    orderBy: { lastName: "asc" },
  });

  // Filtrar base64 legacy — solo retornar URLs de Cloudinary
  const sanitized = students.map(s => ({
    ...s,
    photo: s.photo?.startsWith("http") ? s.photo : null,
  }));

  return NextResponse.json(sanitized);
}

async function _POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  try {
    // ── Verificar límite de alumnos del plan ──────────────────────────────
    const sub = await prisma.subscription.findUnique({
      where:  { dojoId },
      select: { status: true, plan: { select: { name: true, maxStudents: true } } },
    });

    // COMPLIMENTARY y sin suscripción nunca tienen límite
    if (sub?.plan?.maxStudents != null && sub.status !== "COMPLIMENTARY") {
      const activeCount = await prisma.student.count({
        where: { dojoId, active: true },
      });
      if (activeCount >= sub.plan.maxStudents) {
        return NextResponse.json({
          error:    "STUDENT_LIMIT_REACHED",
          message:  `Tu plan ${sub.plan.name} permite hasta ${sub.plan.maxStudents} alumnos activos. No puedes crear más alumnos — adquiere el Plan Silver o Gold para aumentar este límite.`,
          planName: sub.plan.name,
          limit:    sub.plan.maxStudents,
          current:  activeCount,
        }, { status: 403 });
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

    const parsed = CreateStudentSchema.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const body = parsed.data;

    const maxCodeResult = await prisma.student.aggregate({ _max: { studentCode: true } });
    const studentCode   = (maxCodeResult._max.studentCode ?? 999) + 1;

    const t0      = Date.now();
    const student = await prisma.student.create({
      data: {
        dojoId,
        studentCode,
        cardToken:           randomUUID(),
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
        familyId:            body.familyId            ?? null,
      },
    });

    const ctx = buildAuditCtx(session, req, { startTime: t0, dojoId });
    await logAudit({
      ...ctx,
      action:       "STUDENT_CREATED",
      module:       AUDIT_MODULE.STUDENTS,
      resourceType: "Student",
      resourceId:   student.id,
      statusCode:   201,
      details:      JSON.stringify({ fullName: student.fullName, studentCode: student.studentCode, gender: student.gender, nationality: student.nationality }),
    });

    return NextResponse.json(student, { status: 201 });
  } catch (err) {
    console.error("POST /api/students error:", err);
    return NextResponse.json({ error: "Error interno al crear el alumno" }, { status: 500 });
  }
}

export const POST = withReadOnlyGuard(_POST);
