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
          },
        },
      },
    });

    if (!evaluator) return NextResponse.json({ error: "Link no válido" }, { status: 404 });

    const students = evaluator.evaluation.links
      .flatMap(l => l.application.invitees)
      .sort((a, b) => a.student.fullName.localeCompare(b.student.fullName));

    const myScores = await prisma.examScore.findMany({
      where:  { evaluatorId: evaluator.id },
      select: { inviteeId: true, criteriaId: true, value: true, note: true },
    });
    const scoresByInvitee = new Map<string, { criteriaId: string; value: number; note: string | null }[]>();
    for (const s of myScores) {
      const arr = scoresByInvitee.get(s.inviteeId) ?? [];
      arr.push({ criteriaId: s.criteriaId, value: s.value, note: s.note });
      scoresByInvitee.set(s.inviteeId, arr);
    }

    return NextResponse.json({
      evaluatorName:     evaluator.name,
      active:            evaluator.active,
      confirmed:         !!evaluator.confirmedAt,
      evaluationTitle:   evaluator.evaluation.title,
      dojoName:          evaluator.evaluation.dojo.name,
      criteria:          evaluator.evaluation.criteria,
      students: students.map(inv => ({
        inviteeId:     inv.id,
        studentId:     inv.student.id,
        fullName:      inv.student.fullName,
        photo:         inv.student.photo,
        beltToPresent: inv.beltToPresent,
        scores:        scoresByInvitee.get(inv.id) ?? [],
      })),
    });
  } catch (err) {
    console.error("GET /api/public/exam/[token]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
