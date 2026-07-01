import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type Params = { params: Promise<{ id: string }> };

// GET /api/students/[id]/terms-status — estado de aceptación de términos del alumno
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id: studentId } = await params;

    // Verificar que el alumno pertenezca al dojo
    const student = await prisma.student.findFirst({ where: { id: studentId, dojoId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

    const [policy, acceptance] = await Promise.all([
      prisma.dojoTermsPolicy.findUnique({ where: { dojoId }, select: { version: true, enabled: true } }),
      prisma.termsAcceptance.findUnique({
        where:  { studentId_dojoId: { studentId, dojoId } },
        select: { version: true, acceptedAt: true, ipAddress: true },
      }),
    ]);

    return NextResponse.json({
      enabled:    policy?.enabled ?? false,
      version:    policy?.version ?? 1,
      accepted:   !!acceptance && !!policy && acceptance.version >= policy.version,
      acceptedAt: acceptance?.acceptedAt ?? null,
      acceptedVersion: acceptance?.version ?? null,
    });
  } catch (err) {
    console.error("GET /api/students/[id]/terms-status", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
