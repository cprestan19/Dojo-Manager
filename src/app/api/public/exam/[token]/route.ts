import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Params = { params: Promise<{ token: string }> };

// GET /api/public/exam/[token] — público, sin sesión. El token identifica al Sensei.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;

    const evaluator = await prisma.examEvaluator.findUnique({
      where:  { token },
      select: {
        id: true, name: true, active: true, confirmedAt: true,
        evaluation: {
          select: {
            id: true, title: true,
            dojo: { select: { name: true } },
            criteria: { select: { id: true, name: true, weightPct: true, order: true }, orderBy: { order: "asc" } },
            links: {
              select: {
                beltFilter: true,
                application: {
                  select: {
                    invitees: {
                      where:  { response: "ACCEPTED" },
                      select: {
                        id: true, beltToPresent: true,
                        student: { select: { id: true, fullName: true, photo: true } },
                      },
                    },
                  },
                },
              },
            },
            federatedLinks: {
              select: {
                childDojoId: true,
                candidates: {
                  select: { id: true, fullName: true, photo: true, beltToPresent: true },
                },
              },
            },
          },
        },
      },
    });

    if (!evaluator) return NextResponse.json({ error: "Link no válido" }, { status: 404 });

    // Cada vínculo puede traer solo un subconjunto de cintas de su Postulación
    // (beltFilter) — así una Postulación con varias cintas se reparte entre
    // varias Evaluaciones sin que un Sensei vea alumnos que no le tocan.
    // beltFilter vacío = todas las cintas de esa Postulación (retro-compatible).
    let students = evaluator.evaluation.links
      .flatMap(l => l.beltFilter.length > 0
        ? l.application.invitees.filter(inv => l.beltFilter.includes(inv.beltToPresent))
        : l.application.invitees)
      .sort((a, b) => a.student.fullName.localeCompare(b.student.fullName));

    let federatedStudentsRaw = evaluator.evaluation.federatedLinks
      .flatMap(l => l.candidates.map(c => ({ ...c, childDojoId: l.childDojoId })));

    // ── Distribución 1-a-1: si esta Evaluación ya tiene asignaciones
    // (se corrió "Distribuir"), cada Sensei ve SOLO lo suyo. Si nunca se
    // distribuyó, se mantiene el comportamiento histórico de panel (todos
    // ven a todos) — retro-compatible con evaluaciones ya en curso.
    const [allAssignments, allFederatedAssignments, otherEvaluators] = await Promise.all([
      prisma.examAssignment.findMany({ where: { evaluationId: evaluator.evaluation.id }, select: { inviteeId: true, evaluatorId: true } }),
      prisma.federatedExamAssignment.findMany({ where: { evaluationId: evaluator.evaluation.id }, select: { candidateId: true, evaluatorId: true } }),
      prisma.examEvaluator.findMany({
        where:  { evaluationId: evaluator.evaluation.id, active: true, id: { not: evaluator.id } },
        select: { id: true, name: true },
      }),
    ]);
    const hasDistribution = allAssignments.length > 0 || allFederatedAssignments.length > 0;
    const myInviteeIds   = new Set(allAssignments.filter(a => a.evaluatorId === evaluator.id).map(a => a.inviteeId));
    const myCandidateIds = new Set(allFederatedAssignments.filter(a => a.evaluatorId === evaluator.id).map(a => a.candidateId));

    if (hasDistribution) {
      students = students.filter(s => myInviteeIds.has(s.id));
      federatedStudentsRaw = federatedStudentsRaw.filter(c => myCandidateIds.has(c.id));
    }

    const [myScores, myFederatedScores] = await Promise.all([
      prisma.examScore.findMany({
        where:  { evaluatorId: evaluator.id },
        select: { inviteeId: true, criteriaId: true, value: true, note: true },
      }),
      prisma.federatedExamScore.findMany({
        where:  { evaluatorId: evaluator.id },
        select: { candidateId: true, criteriaId: true, value: true, note: true },
      }),
    ]);
    const scoresByInvitee = new Map<string, { criteriaId: string; value: number; note: string | null }[]>();
    for (const s of myScores) {
      const arr = scoresByInvitee.get(s.inviteeId) ?? [];
      arr.push({ criteriaId: s.criteriaId, value: s.value, note: s.note });
      scoresByInvitee.set(s.inviteeId, arr);
    }
    const scoresByCandidate = new Map<string, { criteriaId: string; value: number; note: string | null }[]>();
    for (const s of myFederatedScores) {
      const arr = scoresByCandidate.get(s.candidateId) ?? [];
      arr.push({ criteriaId: s.criteriaId, value: s.value, note: s.note });
      scoresByCandidate.set(s.candidateId, arr);
    }

    const childDojoIds = [...new Set(federatedStudentsRaw.map(c => c.childDojoId))];
    const childDojoNames = childDojoIds.length > 0
      ? await prisma.dojo.findMany({ where: { id: { in: childDojoIds } }, select: { id: true, name: true } })
      : [];
    const childDojoNameById = new Map(childDojoNames.map(d => [d.id, d.name]));

    const federatedStudents = federatedStudentsRaw
      .map(c => ({ ...c, dojoLabel: childDojoNameById.get(c.childDojoId) ?? "Dojo" }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    return NextResponse.json({
      evaluatorName:     evaluator.name,
      active:            evaluator.active,
      confirmed:         !!evaluator.confirmedAt,
      evaluationTitle:   evaluator.evaluation.title,
      dojoName:          evaluator.evaluation.dojo.name,
      criteria:          evaluator.evaluation.criteria,
      // "Mudar alumno" solo tiene sentido si hay distribución 1-a-1 activa —
      // en modo panel (histórico) todos ya ven a todos, no aplica.
      canReassign:       hasDistribution,
      otherEvaluators,
      students: students.map(inv => ({
        inviteeId:     inv.id,
        studentId:     inv.student.id,
        fullName:      inv.student.fullName,
        photo:         inv.student.photo,
        beltToPresent: inv.beltToPresent,
        scores:        scoresByInvitee.get(inv.id) ?? [],
      })),
      // Candidatos de un dojo hijo vinculado — mismo shape, más dojoLabel
      // para que el Sensei vea claramente que es un alumno externo.
      federatedStudents: federatedStudents.map(c => ({
        federatedCandidateId: c.id,
        fullName:      c.fullName,
        photo:         c.photo,
        beltToPresent: c.beltToPresent,
        dojoLabel:     c.dojoLabel,
        scores:        scoresByCandidate.get(c.id) ?? [],
      })),
    });
  } catch (err) {
    console.error("GET /api/public/exam/[token]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
