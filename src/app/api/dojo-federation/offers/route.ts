import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

// GET /api/dojo-federation/offers — Postulaciones que los dojos HIJO
// (con vínculo ACTIVE hacia este dojo) han ofrecido explícitamente. Nunca es
// una búsqueda abierta: solo devuelve lo que el hijo eligió exponer, de
// dojos ya vinculados y activos — nada más. DTO mínimo (sin datos de alumnos
// todavía, eso solo aparece tras "llamar" con /federated-link).
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const activeChildren = await prisma.dojoParentLink.findMany({
      where:  { parentDojoId: dojoId, status: "ACTIVE" },
      select: { childDojoId: true, child: { select: { name: true } } },
    });
    if (activeChildren.length === 0) return NextResponse.json([]);

    const childNameById = new Map(activeChildren.map(c => [c.childDojoId, c.child.name]));

    const offers = await prisma.examApplication.findMany({
      where: {
        dojoId:            { in: activeChildren.map(c => c.childDojoId) },
        offeredToParentAt: { not: null },
      },
      select: {
        id: true, title: true, examDate: true, examTime: true, dojoId: true,
        offeredToParentBeltFilter: true,
        _count: { select: { invitees: { where: { response: "ACCEPTED" } } } },
      },
      orderBy: { examDate: "desc" },
    });

    return NextResponse.json(offers.map(o => ({
      applicationId:  o.id,
      title:          o.title,
      examDate:       o.examDate,
      examTime:       o.examTime,
      childDojoName:  childNameById.get(o.dojoId) ?? "Dojo",
      beltFilter:     o.offeredToParentBeltFilter,
      candidateCount: o._count.invitees,
    })));
  } catch (err) {
    console.error("GET /api/dojo-federation/offers", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
