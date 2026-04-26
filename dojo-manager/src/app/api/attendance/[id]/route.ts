import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null; email?: string | null };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId } = session.user as SessionUser;
  if (!dojoId) return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  const correctedBy = session.user?.email ?? null;

  const attendance = await prisma.attendance.update({
    where: {
      id,
      student: { dojoId },
    },
    data: {
      type:        body.type,
      markedAt:    body.markedAt ? new Date(body.markedAt) : undefined,
      scheduleId:  body.scheduleId ?? null,
      note:        body.note      ?? null,
      corrected:   true,
      correctedBy,
    },
  });

  return NextResponse.json(attendance);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId } = session.user as SessionUser;
  if (!dojoId) return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  await prisma.attendance.delete({
    where: {
      id,
      student: { dojoId },
    },
  });

  return NextResponse.json({ ok: true });
}
