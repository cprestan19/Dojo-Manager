import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// POST /api/exam-applications/[id]/reopen — un paso hacia atrás:
//   FINALIZED → CLOSED : corregir asistencia/aprobado y volver a Finalizar.
//     Nunca permite agregar alumnos nuevos (canAddStudents solo permite
//     DRAFT/PUBLISHED); esa segunda corrida de Finalizar es idempotente (ver
//     beltAwarded/resultNotifiedAt en finalize/route.ts) — no repite cinta ni
//     notificación a quien ya se procesó.
//   CLOSED → PUBLISHED : reabre las inscripciones (ej. se cerró antes de
//     tiempo) — los alumnos vuelven a poder responder desde el portal.
//     Bloqueado si ya hay asistencia/aprobado registrado (señal de que el
//     examen ya empezó) — para ese caso conviene crear una Postulación nueva.
// Nunca reabre una PUBLISHED/DRAFT (no aplica) ni salta directo de FINALIZED
// a PUBLISHED (siempre un paso a la vez).
export async function POST(req: NextRequest, { params }: Params) {
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

    const existing = await prisma.examApplication.findFirst({ where: { id, dojoId } });
    if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    let newStatus: "CLOSED" | "PUBLISHED";
    if (existing.status === "FINALIZED") {
      newStatus = "CLOSED";
    } else if (existing.status === "CLOSED") {
      const hasExamActivity = await prisma.examApplicationInvitee.findFirst({
        where: { applicationId: id, OR: [{ attended: true }, { passed: { not: null } }] },
        select: { id: true },
      });
      if (hasExamActivity) {
        return NextResponse.json({
          error: "Ya hay asistencia o resultados registrados — no se puede reabrir para inscripciones. Crea una nueva Postulación si necesitas invitar a más alumnos.",
        }, { status: 400 });
      }
      newStatus = "PUBLISHED";
    } else {
      return NextResponse.json({ error: "Solo se puede reabrir una postulación cerrada o finalizada" }, { status: 400 });
    }

    const updated = await prisma.examApplication.update({ where: { id }, data: { status: newStatus } });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_APPLICATION_REOPENED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamApplication",
      resourceId:   id,
      statusCode:   200,
      details:      JSON.stringify({ from: existing.status, to: newStatus }),
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("POST /api/exam-applications/[id]/reopen", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
