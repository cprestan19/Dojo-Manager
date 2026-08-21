import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { MAX_STUDENT_CUSTOM_FIELDS } from "@/lib/utils";

type SessionUser = { role?: string; dojoId?: string | null };

// GET /api/student-custom-fields — lista los campos personalizados del dojo
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") === "1";

    const fields = await prisma.studentCustomField.findMany({
      where:   { dojoId, ...(activeOnly ? { active: true } : {}) },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(fields);
  } catch (err) {
    console.error("GET /api/student-custom-fields", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/student-custom-fields — crea un campo personalizado
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const body = await req.json() as { label?: string };
    const label = body.label?.trim().slice(0, 60);
    if (!label) return NextResponse.json({ error: "El nombre del campo es requerido" }, { status: 400 });

    const count = await prisma.studentCustomField.count({ where: { dojoId } });
    if (count >= MAX_STUDENT_CUSTOM_FIELDS) {
      return NextResponse.json({ error: `Máximo ${MAX_STUDENT_CUSTOM_FIELDS} campos personalizados por dojo` }, { status: 400 });
    }

    const field = await prisma.studentCustomField.create({
      data: { dojoId, label, order: count },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "STUDENT_CUSTOM_FIELD_CREATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "StudentCustomField",
      resourceId:   field.id,
      statusCode:   200,
      details:      JSON.stringify({ label }),
    });

    return NextResponse.json(field);
  } catch (err) {
    console.error("POST /api/student-custom-fields", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
