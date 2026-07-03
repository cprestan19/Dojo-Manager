import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

// GET /api/portal/terms — verifica si el alumno necesita aceptar los términos
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user    = session?.user as { role?: string; studentId?: string | null; dojoId?: string | null } | undefined;

    if (!session || user?.role !== "student" || !user?.studentId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where:  { id: user.studentId },
      select: { dojoId: true },
    });
    if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

    const dojoId = student.dojoId;

    const [policy, acceptance] = await Promise.all([
      prisma.dojoTermsPolicy.findUnique({ where: { dojoId } }),
      prisma.termsAcceptance.findUnique({ where: { studentId_dojoId: { studentId: user.studentId, dojoId } } }),
    ]);

    if (!policy || !policy.enabled) {
      return NextResponse.json({ needsAcceptance: false });
    }

    const needsAcceptance = !acceptance || acceptance.version < policy.version;
    return NextResponse.json({
      needsAcceptance,
      policy: needsAcceptance ? { id: policy.id, content: policy.content, version: policy.version } : null,
    });
  } catch (err) {
    console.error("GET /api/portal/terms", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/portal/terms — el alumno acepta los términos
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user    = session?.user as { role?: string; studentId?: string | null } | undefined;

    if (!session || user?.role !== "student" || !user?.studentId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where:  { id: user.studentId },
      select: { dojoId: true, motherEmail: true, fatherEmail: true },
    });
    if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

    const dojoId = student.dojoId;

    const policy = await prisma.dojoTermsPolicy.findUnique({ where: { dojoId } });
    if (!policy || !policy.enabled) {
      return NextResponse.json({ error: "No hay términos activos para este dojo" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? null;

    // Buscar hermanos: alumnos del mismo dojo que comparten motherEmail o fatherEmail
    const parentEmails = [student.motherEmail?.trim(), student.fatherEmail?.trim()]
      .filter((e): e is string => !!e);

    const siblingIds: string[] = [];
    if (parentEmails.length > 0) {
      const siblings = await prisma.student.findMany({
        where: {
          dojoId,
          id:     { not: user.studentId! },
          active: true,
          OR: [
            ...parentEmails.map(e => ({ motherEmail: e })),
            ...parentEmails.map(e => ({ fatherEmail: e })),
          ],
        },
        select: { id: true },
      });
      siblingIds.push(...siblings.map(s => s.id));
    }

    const allStudentIds = [user.studentId!, ...siblingIds];

    // Upsert de aceptación para el principal y todos los hermanos
    const now = new Date();
    await Promise.all(
      allStudentIds.map(sid =>
        prisma.termsAcceptance.upsert({
          where:  { studentId_dojoId: { studentId: sid, dojoId } },
          create: { studentId: sid, dojoId, version: policy.version, ipAddress: ip },
          update: { version: policy.version, acceptedAt: now, ipAddress: ip },
        })
      )
    );

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "TERMS_ACCEPTED",
      module:       AUDIT_MODULE.PORTAL,
      resourceType: "TermsAcceptance",
      resourceId:   user.studentId!,
      statusCode:   200,
      details:      JSON.stringify({ version: policy.version, siblings: siblingIds.length }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/portal/terms", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
