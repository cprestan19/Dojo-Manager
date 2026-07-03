import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";

/**
 * POST /api/admin/backfill-terms
 * Uso único (idempotente): propaga aceptaciones de términos a hermanos que
 * comparten correo de padre/madre con alumnos que ya aceptaron.
 * Solo sysadmin.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { role?: string; id?: string } | undefined;
    if (!session || user?.role !== "sysadmin") {
      return NextResponse.json({ error: "Solo sysadmin" }, { status: 403 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "backfill";

    // 1. Obtener todas las aceptaciones existentes con datos del alumno
    const existing = await prisma.termsAcceptance.findMany({
      select: {
        studentId: true,
        dojoId:    true,
        version:   true,
        ipAddress: true,
        acceptedAt: true,
        student: { select: { motherEmail: true, fatherEmail: true, active: true } },
      },
    });

    let created = 0;
    let skipped = 0;

    for (const acc of existing) {
      const emails = [
        acc.student.motherEmail?.trim(),
        acc.student.fatherEmail?.trim(),
      ].filter((e): e is string => !!e);

      if (emails.length === 0) continue;

      // 2. Buscar hermanos activos del mismo dojo con mismo correo de padre/madre
      const siblings = await prisma.student.findMany({
        where: {
          dojoId: acc.dojoId,
          id:     { not: acc.studentId },
          active: true,
          OR: [
            ...emails.map(e => ({ motherEmail: e })),
            ...emails.map(e => ({ fatherEmail: e })),
          ],
        },
        select: { id: true, fullName: true },
      });

      for (const sibling of siblings) {
        // 3. Verificar si ya tiene un registro para esta versión
        const already = await prisma.termsAcceptance.findUnique({
          where: { studentId_dojoId: { studentId: sibling.id, dojoId: acc.dojoId } },
        });

        if (already && already.version >= acc.version) {
          skipped++;
          continue;
        }

        // 4. Crear o actualizar el registro del hermano
        await prisma.termsAcceptance.upsert({
          where:  { studentId_dojoId: { studentId: sibling.id, dojoId: acc.dojoId } },
          create: {
            studentId: sibling.id,
            dojoId:    acc.dojoId,
            version:   acc.version,
            acceptedAt: acc.acceptedAt,
            ipAddress: ip,
          },
          update: {
            version:   acc.version,
            acceptedAt: acc.acceptedAt,
            ipAddress: ip,
          },
        });

        // 5. Registrar en auditoría
        await logAudit({
          action:       "TERMS_ACCEPTED_BACKFILL",
          module:       AUDIT_MODULE.PORTAL,
          userId:       user.id,
          dojoId:       acc.dojoId,
          resourceType: "TermsAcceptance",
          resourceId:   sibling.id,
          ip,
          statusCode:   201,
          details:      JSON.stringify({
            siblingName:    sibling.fullName,
            principalId:    acc.studentId,
            version:        acc.version,
          }),
        });

        created++;
      }
    }

    return NextResponse.json({ ok: true, created, skipped });
  } catch (err) {
    console.error("POST /api/admin/backfill-terms", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
