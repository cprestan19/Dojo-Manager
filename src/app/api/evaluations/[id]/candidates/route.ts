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

    const links = await prisma.evaluationLink.findMany({ where: { evaluationId: id }, select: { applicationId: true, beltFilter: true } });
    const applicationIds = links.map(l => l.applicationId);

    const [allInvitees, federatedCandidates, criteriaCount, evaluatorCount, assignments, federatedAssignments] = await Promise.all([
      applicationIds.length > 0
        ? prisma.examApplicationInvitee.findMany({
            where:  { applicationId: { in: applicationIds }, response: "ACCEPTED" },
            select: {
              id: true, beltToPresent: true, finalScore: true, passed: true, applicationId: true,
              student:    { select: { id: true, fullName: true, photo: true, homeInstructorName: true } },
              application: { select: { id: true, title: true } },
              _count:     { select: { scores: true } },
            },
            orderBy: { student: { fullName: "asc" } },
          })
        : Promise.resolve([]),
      // Candidatos federados (dojo hijo) — snapshot ya filtrado y aislado por
      // FederatedEvaluationLink.evaluationId, nunca una query directa al hijo.
      prisma.federatedCandidate.findMany({
        where:  { link: { evaluationId: id } },
        select: {
          id: true, fullName: true, photo: true, beltToPresent: true, finalScore: true, passed: true,
          link: { select: { applicationId: true, application: { select: { title: true } } } },
          childDojoId: true,
          _count: { select: { scores: true } },
        },
        orderBy: { fullName: "asc" },
      }),
      prisma.examCriteria.count({ where: { evaluationId: id } }),
      prisma.examEvaluator.count({ where: { evaluationId: id } }),
      prisma.examAssignment.findMany({ where: { evaluationId: id }, select: { inviteeId: true, forcedSelfAssignment: true, evaluator: { select: { name: true } } } }),
      prisma.federatedExamAssignment.findMany({ where: { evaluationId: id }, select: { candidateId: true, forcedSelfAssignment: true, evaluator: { select: { name: true } } } }),
    ]);
    const assignmentByInvitee   = new Map(assignments.map(a => [a.inviteeId, a]));
    const assignmentByCandidate = new Map(federatedAssignments.map(a => [a.candidateId, a]));

    const childDojoNames = federatedCandidates.length > 0
      ? await prisma.dojo.findMany({
          where:  { id: { in: [...new Set(federatedCandidates.map(c => c.childDojoId))] } },
          select: { id: true, name: true },
        })
      : [];
    const childDojoNameById = new Map(childDojoNames.map(d => [d.id, d.name]));

    // Un mismo applicationId puede estar vinculado con distintos beltFilter —
    // un postulado solo es candidato real si su cinta cae dentro de alguno
    // de los vínculos de ESTA Evaluación (vacío = todas las cintas de ese vínculo).
    const invitees = allInvitees.filter(inv =>
      links.some(l => l.applicationId === inv.applicationId
        && (l.beltFilter.length === 0 || l.beltFilter.includes(inv.beltToPresent))),
    );

    const expectedScoresPerInvitee = criteriaCount * evaluatorCount;

    const localCandidates = invitees.map(inv => {
      const a = assignmentByInvitee.get(inv.id);
      return {
        source:         "local" as const,
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
        homeInstructorName:   inv.student.homeInstructorName,
        assignedEvaluatorName: a?.evaluator.name ?? null,
        assignmentForced:      a?.forcedSelfAssignment ?? false,
      };
    });

    // DTO deliberadamente mínimo — nunca studentId real del hijo ni su
    // childDojoId crudo, solo el nombre del dojo para que el Sensei sepa que
    // es un candidato externo.
    const federated = federatedCandidates.map(c => {
      const a = assignmentByCandidate.get(c.id);
      return {
        source:            "federated" as const,
        federatedCandidateId: c.id,
        fullName:           c.fullName,
        photo:              c.photo,
        beltToPresent:      c.beltToPresent,
        finalScore:         c.finalScore,
        passed:             c.passed,
        applicationId:      c.link.applicationId,
        applicationTitle:   c.link.application.title,
        childDojoName:      childDojoNameById.get(c.childDojoId) ?? "Dojo",
        scoresGiven:        c._count.scores,
        scoresExpected:     expectedScoresPerInvitee,
        homeInstructorName:    null as string | null,
        assignedEvaluatorName: a?.evaluator.name ?? null,
        assignmentForced:      a?.forcedSelfAssignment ?? false,
      };
    });

    return NextResponse.json(
      [...localCandidates, ...federated].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    );
  } catch (err) {
    console.error("GET /api/evaluations/[id]/candidates", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
