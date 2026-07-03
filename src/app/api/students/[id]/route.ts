import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { deleteResource, extractCloudinaryPublicId } from "@/lib/cloudinary";
import { formatStudentName } from "@/lib/utils";
import { notifyAdmin, buildStudentDeletedEmail } from "@/lib/admin-notifications";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null };

export async function GET( req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role === "student") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const isPrivileged = role === "admin" || role === "sysadmin";

  if (!isPrivileged) {
    // Roles no privilegiados: sin PII, sin datos de salud, sin contactos privados, sin montos
    const student = await prisma.student.findUnique({
      where: { id, dojoId },
      include: {
        portalUser: { select: { id: true, active: true } },
        beltHistory: {
          orderBy: { changeDate: "desc" },
          take: 50,
          select: {
            id: true, beltColor: true, changeDate: true, isRanking: true, notes: true,
            kataIds: true,
            kata: { select: { id: true, name: true, beltColor: true } },
          },
        },
        kataCompetitions: {
          orderBy: { date: "desc" },
          take: 50,
          include: { kata: { select: { id: true, name: true } } },
        },
        dojo: { select: { name: true, slug: true } },
        payments: {
          orderBy: { dueDate: "desc" },
          take: 24,
          select: {
            id: true, type: true, status: true,
            dueDate: true, paidDate: true, reminderSent: true, createdAt: true,
          },
        },
      },
    });
    if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    // Retornar solo campos seguros — excluye cédula, salud, contactos y datos financieros
    return NextResponse.json({
      id:               student.id,
      fullName:         student.fullName,
      firstName:        student.firstName,
      lastName:         student.lastName,
      birthDate:        student.birthDate,
      gender:           student.gender,
      nationality:      student.nationality,
      active:           student.active,
      photo:            student.photo,
      studentCode:      student.studentCode,
      familyId:         student.familyId,
      attendanceStatus: student.attendanceStatus,
      portalUser:       student.portalUser,
      beltHistory:      student.beltHistory,
      kataCompetitions: student.kataCompetitions,
      dojo:             student.dojo,
      payments:         student.payments,
    });
  }

  // Admin / sysadmin: datos completos
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
          kataIds: true,
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

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  try {
    const t0   = Date.now();
    const body = await req.json();

    // Rechazar fotos base64 — deben subirse a Cloudinary antes de guardar
    if (body.photo && typeof body.photo === "string" && body.photo.startsWith("data:")) {
      return NextResponse.json({ error: "La foto debe subirse a Cloudinary antes de guardar. Usa el editor de foto en el formulario." }, { status: 400 });
    }

    // Snapshot del estado anterior para el log (incluye portal user para sync de email)
    const before = await prisma.student.findUnique({
      where:  { id, dojoId },
      select: {
        fullName: true, active: true, cedula: true, fepakaId: true,
        photo: true,
        motherEmail: true, fatherEmail: true,
        portalUser: { select: { id: true, email: true } },
      },
    });

    // Si se reemplaza o elimina la foto, borrar la anterior de Cloudinary
    if ("photo" in body && before?.photo && body.photo !== before.photo) {
      const pid = extractCloudinaryPublicId(before.photo);
      if (pid) deleteResource(pid).catch(() => {});
    }

    const rawFullName = String(body.fullName ?? (body.firstName + " " + (body.lastName ?? "")).trim());
    const student = await prisma.student.update({
      where: { id, dojoId },
      data: {
        fullName:            formatStudentName(rawFullName),
        firstName:           body.firstName ? formatStudentName(body.firstName) : body.firstName,
        lastName:            body.lastName  ? formatStudentName(body.lastName)  : body.lastName,
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
        primaryGuardian:     body.primaryGuardian || null,
        address:             body.address ?? null,
        active:              body.active ?? true,
      },
    });

    // Sincronizar email del usuario portal solo si el portal fue creado con el email del acudiente
    // (no aplica a familias donde el email del portal fue configurado diferente a propósito)
    if (before?.portalUser) {
      const oldGuardianEmails = [before.motherEmail?.trim(), before.fatherEmail?.trim()].filter(Boolean);
      const portalEmailMatchedGuardian = oldGuardianEmails.includes(before.portalUser.email);
      if (portalEmailMatchedGuardian) {
        const newPrimaryEmail = (body.motherEmail?.trim() || body.fatherEmail?.trim()) ?? "";
        if (newPrimaryEmail && newPrimaryEmail !== before.portalUser.email) {
          const conflict = await prisma.user.findFirst({
            where: { email: newPrimaryEmail, id: { not: before.portalUser.id } },
            select: { id: true },
          });
          if (!conflict) {
            await prisma.user.update({
              where: { id: before.portalUser.id },
              data:  { email: newPrimaryEmail },
            });
          }
        }
      }
    }

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

    const action = before && body.active !== undefined && body.active !== before.active
      ? (body.active ? "STUDENT_ACTIVATED" : "STUDENT_DEACTIVATED")
      : "STUDENT_UPDATED";

    const ctx = buildAuditCtx(session, req, { startTime: t0, dojoId });
    await logAudit({
      ...ctx,
      action,
      module:       AUDIT_MODULE.STUDENTS,
      resourceType: "Student",
      resourceId:   id,
      statusCode:   200,
      details:      JSON.stringify({
        before: before ? { fullName: before.fullName, active: before.active } : null,
        after:  { fullName: student.fullName, active: student.active },
      }),
    });

    // Invalidar caché de Next.js para que la lista y el perfil muestren datos frescos
    revalidatePath("/dashboard/students");
    revalidatePath(`/dashboard/students/${id}`);

    return NextResponse.json(student);
  } catch (err) {
    console.error("PUT /api/students/[id] error:", err);
    return NextResponse.json({ error: "Error al actualizar el alumno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const t0 = Date.now();

  // Leer metadata antes de la transacción (para Cloudinary y auditoría)
  const student = await prisma.student.findUnique({
    where:  { id, dojoId },
    select: { fullName: true, studentCode: true, active: true, photo: true },
  });
  if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

  // Limpiar datos huérfanos y eliminar dentro de la misma transacción.
  // La guarda de active se re-verifica dentro para evitar TOCTOU race condition.
  try {
  await prisma.$transaction(async (tx) => {
    // Re-check active dentro de la transacción para evitar race condition
    const current = await tx.student.findUnique({ where: { id, dojoId }, select: { active: true } });
    if (!current) throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
    if (current.active) throw Object.assign(new Error("STILL_ACTIVE"), { code: "STILL_ACTIVE" });

    // 1. TournamentEventParticipant — sin FK formal, quedarían huérfanos
    await tx.$executeRaw`DELETE FROM tournament_event_participants WHERE student_id = ${id}`;

    // 2. TournamentEmailLog — sin FK formal en studentId, quedarían huérfanos
    await tx.$executeRaw`UPDATE tournament_email_logs SET student_id = NULL WHERE student_id = ${id}`;

    // 3. TournamentParticipant — onDelete: Restrict bloquearía el DELETE del alumno
    await tx.tournamentParticipant.deleteMany({ where: { studentId: id } });

    // 4. TournamentRegistration
    await tx.tournamentRegistration.updateMany({
      where: { studentId: id },
      data:  { studentId: null },
    });

    // 5. GeneratedCertificate — onDelete: Restrict; eliminar antes que el invitee
    await tx.generatedCertificate.deleteMany({ where: { studentId: id } });

    // 6. ExamApplicationInvitee — onDelete: Restrict bloquearía el DELETE del alumno
    await tx.examApplicationInvitee.deleteMany({ where: { studentId: id } });

    // 7. User.studentId — desvincula el usuario del portal sin eliminarlo
    await tx.user.updateMany({
      where: { studentId: id },
      data:  { studentId: null },
    });

    // 8. DELETE del alumno — cascadea: Inscription, Payment, BeltHistory,
    //    Attendance, StudentSchedule, KataCompetition, PushSubscription, TermsAcceptance
    await tx.student.delete({ where: { id, dojoId } });
  }, { timeout: 15000 });
  } catch (txErr) {
    const code = (txErr as { code?: string }).code;
    if (code === "NOT_FOUND")    return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    if (code === "STILL_ACTIVE") return NextResponse.json({ error: "Solo se pueden eliminar alumnos inactivos" }, { status: 409 });
    throw txErr;
  }

  // Borrar foto de Cloudinary fuera de la transacción (no bloquea si falla)
  if (student.photo) {
    const publicId = extractCloudinaryPublicId(student.photo);
    if (publicId) {
      try { await deleteResource(publicId, "image"); } catch { /* continúa aunque Cloudinary falle */ }
    }
  }

  const ctx = buildAuditCtx(session, req, { startTime: t0, dojoId });
  await logAudit({
    ...ctx,
    action:       "STUDENT_DELETED",
    module:       AUDIT_MODULE.STUDENTS,
    resourceType: "Student",
    resourceId:   id,
    statusCode:   200,
    details:      JSON.stringify({ fullName: student.fullName, studentCode: student.studentCode }),
  });

  // Notificación al propietario de la plataforma (fire-and-forget)
  prisma.dojo.findUnique({ where: { id: dojoId }, select: { name: true } }).then(dojo => {
    notifyAdmin(
      `🗑️ Alumno eliminado — ${student.fullName}`,
      buildStudentDeletedEmail(student.fullName, dojo?.name ?? dojoId, (session.user as { email?: string }).email ?? "admin"),
    );
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
