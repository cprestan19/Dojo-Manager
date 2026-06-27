import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { formatStudentName } from "@/lib/utils";

type SessionUser = { id?: string; name?: string; role?: string; dojoId?: string | null };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const pending = await prisma.pendingStudent.findUnique({ where: { id } });

    if (!pending || pending.dojoId !== dojoId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    if (pending.status !== "pending") {
      return NextResponse.json({ error: "Esta solicitud ya fue procesada" }, { status: 409 });
    }

    // Verificar límite de plan
    const sub = await prisma.subscription.findUnique({
      where:  { dojoId },
      select: { status: true, plan: { select: { name: true, maxStudents: true } } },
    });
    if (sub?.plan?.maxStudents != null && sub.status !== "COMPLIMENTARY") {
      const activeCount = await prisma.student.count({ where: { dojoId, active: true } });
      if (activeCount >= sub.plan.maxStudents) {
        return NextResponse.json({
          error:    "STUDENT_LIMIT_REACHED",
          message:  `Tu plan ${sub.plan.name} permite hasta ${sub.plan.maxStudents} alumnos activos.`,
          limit:    sub.plan.maxStudents,
          current:  activeCount,
        }, { status: 403 });
      }
    }

    const reviewerId = (session.user as { id?: string }).id ?? "";
    const t0 = Date.now();

    const student = await prisma.$transaction(async (tx) => {
      const maxCodeResult = await tx.student.aggregate({ _max: { studentCode: true } });
      const studentCode   = (maxCodeResult._max.studentCode ?? 999) + 1;

      const newStudent = await tx.student.create({
        data: {
          dojoId,
          studentCode,
          cardToken:           randomUUID(),
          fullName:            formatStudentName(pending.fullName),
          firstName:           formatStudentName(pending.firstName),
          lastName:            formatStudentName(pending.lastName),
          birthDate:           pending.birthDate,
          gender:              pending.gender,
          nationality:         pending.nationality,
          cedula:              pending.cedula      || null,
          fepakaId:            pending.fepakaId   ? pending.fepakaId.toUpperCase()   : null,
          ryoBukaiId:          pending.ryoBukaiId ? pending.ryoBukaiId.toUpperCase() : null,
          bloodType:           pending.bloodType   || null,
          condition:           pending.condition   || null,
          hasPrivateInsurance: pending.hasPrivateInsurance,
          insuranceName:       pending.insuranceName   || null,
          insuranceNumber:     pending.insuranceNumber || null,
          motherName:          pending.motherName  || null,
          motherPhone:         pending.motherPhone || null,
          motherEmail:         pending.motherEmail || null,
          fatherName:          pending.fatherName  || null,
          fatherPhone:         pending.fatherPhone || null,
          fatherEmail:         pending.fatherEmail || null,
          address:             pending.address     || null,
        },
      });

      await tx.pendingStudent.update({
        where: { id },
        data: {
          status:     "approved",
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
        },
      });

      return newStudent;
    }, { isolationLevel: "Serializable" });

    const ctx = buildAuditCtx(session, req, { startTime: t0, dojoId });
    await logAudit({
      ...ctx,
      action:       "PENDING_STUDENT_APPROVED",
      module:       AUDIT_MODULE.STUDENTS,
      resourceType: "Student",
      resourceId:   student.id,
      statusCode:   201,
      details:      JSON.stringify({ pendingId: id, fullName: student.fullName, studentCode: student.studentCode }),
    });

    return NextResponse.json({ student }, { status: 201 });
  } catch (err) {
    console.error("POST /api/pending-students/[id]/approve error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
