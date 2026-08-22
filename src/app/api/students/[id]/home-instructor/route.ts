import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/students/[id]/home-instructor — instructor/Sensei habitual del
// alumno (texto libre). Solo se usa para que el reparto de Evaluaciones evite
// asignarle sus propios alumnos a un Sensei — no afecta nada más del alumno.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id } = await params;
    const student = await prisma.student.findFirst({ where: { id, dojoId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const body = await req.json().catch(() => ({})) as { homeInstructorName?: unknown };
    const name = typeof body.homeInstructorName === "string" ? body.homeInstructorName.trim().slice(0, 100) || null : null;

    await prisma.student.update({ where: { id }, data: { homeInstructorName: name } });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action: "STUDENT_HOME_INSTRUCTOR_UPDATED", module: AUDIT_MODULE.STUDENTS,
      resourceType: "Student", resourceId: id, statusCode: 200,
      details: JSON.stringify({ homeInstructorName: name }),
    });

    return NextResponse.json({ ok: true, homeInstructorName: name });
  } catch (err) {
    console.error("PATCH /api/students/[id]/home-instructor", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
