import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string }> };

// GET /api/evaluations/[id]/candidates — postulados aceptados de todas las
// Postulaciones vinculadas a esta Evaluación, con su progreso de calificación.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id } = await params;
    const evaluation = await prisma.evaluation.findFirst({ where: { id, dojoId } });
    if (!evaluation) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const links = await prisma.evaluationLink.findMany({ where: { evaluationId: id }, select: { applicationId: true } });
    const applicationIds = links.map(l => l.applicationId);

    const [invitees, criteriaCount, evaluatorCount] = await Promise.all([
      applicationIds.length > 0
        ? prisma.examApplicationInvitee.findMany({
            where:  { applicationId: { in: applicationIds }, response: "ACCEPTED" },
            select: {
              id: true, beltToPresent: true, finalScore: true, passed: true,
              student:    { select: { id: true, fullName: true, photo: true } },
              application: { select: { id: true, title: true } },
              _count:     { select: { scores: true } },
            },
            orderBy: { student: { fullName: "asc" } },
          })
        : Promise.resolve([]),
      prisma.examCriteria.count({ where: { evaluationId: id } }),
      prisma.examEvaluator.count({ where: { evaluationId: id } }),
    ]);

    const expectedScoresPerInvitee = criteriaCount * evaluatorCount;

    return NextResponse.json(
      invitees.map(inv => ({
        inviteeId:      inv.id,
        studentId:      inv.student.id,
        fullName:       inv.student.fullName,
        photo:          inv.student.photo,
        beltToPresent:  inv.beltToPresent,
        finalScore:     inv.finalScore,
        passed:         inv.passed,
        applicationId:  inv.application.id,
        applicationTitle: inv.application.title,
        scoresGiven:    inv._count.scores,
        scoresExpected: expectedScoresPerInvitee,
      })),
    );
  } catch (err) {
    console.error("GET /api/evaluations/[id]/candidates", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
