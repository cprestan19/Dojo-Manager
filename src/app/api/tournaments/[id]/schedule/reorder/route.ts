import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id: tournamentId } = await params;

  const raw = await req.json().catch(() => null);
  if (!raw || !Array.isArray(raw.slots)) {
    return NextResponse.json({ error: "slots array es requerido" }, { status: 400 });
  }

  const slots: { id: string; order: number }[] = raw.slots;

  try {
    await prisma.$transaction(
      slots.map((s) =>
        prisma.tournamentScheduleSlot.updateMany({
          where: { id: s.id, tournamentId, dojoId },
          data: { order: s.order },
        }),
      ),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/tournaments/[id]/schedule/reorder error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
