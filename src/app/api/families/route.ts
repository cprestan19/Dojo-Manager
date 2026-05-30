import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

// GET /api/families?familyId=xxx — members of a family (admin/user only)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (!["admin", "user", "sysadmin"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const familyId = req.nextUrl.searchParams.get("familyId");
  if (!familyId) return NextResponse.json({ error: "familyId requerido" }, { status: 400 });

  const members = await prisma.student.findMany({
    where: { dojoId, familyId, active: true },
    select: {
      id: true,
      fullName: true,
      studentCode: true,
      birthDate: true,
      motherEmail: true,
      fatherEmail: true,
      familyId: true,
    },
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json(members);
}

// POST /api/families — create or link a family group
// body: { studentIds: string[], familyId?: string }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (!["admin", "user", "sysadmin"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.studentIds) || body.studentIds.length < 1) {
    return NextResponse.json({ error: "studentIds requerido (array)" }, { status: 400 });
  }

  const { studentIds, familyId: incomingFamilyId } = body as {
    studentIds: string[];
    familyId?: string;
  };

  // Validate all students belong to this dojo
  const existing = await prisma.student.findMany({
    where: { id: { in: studentIds }, dojoId },
    select: { id: true },
  });
  if (existing.length !== studentIds.length) {
    return NextResponse.json({ error: "Uno o más alumnos no pertenecen a este dojo" }, { status: 400 });
  }

  const familyId = incomingFamilyId ?? crypto.randomUUID();

  const { count } = await prisma.student.updateMany({
    where: { id: { in: studentIds }, dojoId },
    data: { familyId },
  });

  return NextResponse.json({ familyId, updatedCount: count });
}

// DELETE /api/families — unlink a student from their family
// body: { studentId: string }
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (!["admin", "user", "sysadmin"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.studentId) {
    return NextResponse.json({ error: "studentId requerido" }, { status: 400 });
  }

  const updated = await prisma.student.updateMany({
    where: { id: body.studentId, dojoId },
    data: { familyId: null },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
