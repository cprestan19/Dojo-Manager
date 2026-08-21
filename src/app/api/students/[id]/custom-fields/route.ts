import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string }> };

// PUT /api/students/[id]/custom-fields — guarda los valores del alumno para
// los campos personalizados de su dojo. Body: { values: { fieldId, value }[] }
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id: studentId } = await params;
    const student = await prisma.student.findFirst({ where: { id: studentId, dojoId } });
    if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

    const body = await req.json() as { values?: { fieldId: string; value: string }[] };
    const values = Array.isArray(body.values) ? body.values : [];
    if (values.length === 0) return NextResponse.json({ ok: true });

    // Los fieldId deben pertenecer al dojo del alumno — nunca confiar en el body.
    const validFieldIds = new Set(
      (await prisma.studentCustomField.findMany({ where: { dojoId }, select: { id: true } })).map(f => f.id),
    );

    await prisma.$transaction(
      values
        .filter(v => validFieldIds.has(v.fieldId))
        .map(v => {
          const value = String(v.value ?? "").trim().slice(0, 200);
          return prisma.studentCustomFieldValue.upsert({
            where:  { studentId_fieldId: { studentId, fieldId: v.fieldId } },
            update: { value },
            create: { studentId, fieldId: v.fieldId, value },
          });
        }),
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/students/[id]/custom-fields", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
