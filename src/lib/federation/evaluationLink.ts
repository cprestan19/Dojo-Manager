import prisma from "@/lib/prisma";
import { assertActiveParentAccess } from "@/lib/federation/authz";

// ── "Llamar dojo": vincula una Postulación OFRECIDA por un dojo hijo a una
// Evaluación del dojo padre. Nunca lee al hijo directamente en requests
// futuros — todo lo que el padre necesita se copia una sola vez aquí
// (snapshot) a FederatedCandidate. Ver comentario del modelo en schema.prisma.

type LinkResult =
  | { ok: true; linkId: string; candidateCount: number }
  | { ok: false; error: string };

function beltFilterOverlaps(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return true;
  return a.some(belt => b.includes(belt));
}

export async function createFederatedLink(
  parentDojoId: string,
  evaluationId: string,
  applicationId: string,
  requestedBeltFilter: string[],
  createdByUserId: string,
): Promise<LinkResult> {
  // La Postulación debe ser de un dojo hijo con vínculo ACTIVE hacia este
  // padre — nunca confiar en que el applicationId "se ve razonable".
  const application = await prisma.examApplication.findUnique({
    where:  { id: applicationId },
    select: { id: true, dojoId: true, title: true, offeredToParentAt: true, offeredToParentBeltFilter: true },
  });
  // Mensaje genérico — no revela si el id no existe, no está ofrecida, o
  // pertenece a un dojo sin vínculo activo. Los tres casos son "no disponible".
  if (!application || !application.offeredToParentAt) {
    return { ok: false, error: "Postulación no disponible." };
  }
  const hasAccess = await assertActiveParentAccess(parentDojoId, application.dojoId);
  if (!hasAccess) return { ok: false, error: "Postulación no disponible." };

  // El hijo puede haber restringido a solo ciertas cintas al ofrecer — el
  // padre nunca puede pedir cintas fuera de ese subconjunto.
  const offered = application.offeredToParentBeltFilter;
  const beltFilter = [...new Set(requestedBeltFilter)];
  if (offered.length > 0) {
    const outOfScope = beltFilter.some(b => !offered.includes(b));
    if (outOfScope) return { ok: false, error: "Esa cinta no fue ofrecida por el dojo hijo." };
  }
  const effectiveFilter = beltFilter.length > 0 ? beltFilter : offered;

  const existing = await prisma.federatedEvaluationLink.findUnique({
    where: { evaluationId_applicationId: { evaluationId, applicationId } },
  });
  if (existing) return { ok: false, error: "Esa postulación ya está vinculada a esta evaluación." };

  const otherLinks = await prisma.federatedEvaluationLink.findMany({
    where:  { applicationId, evaluationId: { not: evaluationId } },
    select: { beltFilter: true },
  });
  if (otherLinks.some(l => beltFilterOverlaps(l.beltFilter, effectiveFilter))) {
    return { ok: false, error: "Alguna de estas cintas ya está vinculada a otra evaluación." };
  }

  const invitees = await prisma.examApplicationInvitee.findMany({
    where: {
      applicationId,
      response: "ACCEPTED",
      ...(effectiveFilter.length > 0 ? { beltToPresent: { in: effectiveFilter } } : {}),
    },
    select: { studentId: true, beltToPresent: true, student: { select: { fullName: true, photo: true } } },
  });

  // Cinta actual = último BeltHistory por fecha — igual que el resto de la
  // app calcula "cinta actual" (Student no guarda un campo currentBelt).
  const studentIds = invitees.map(i => i.studentId);
  const beltHistories = studentIds.length > 0
    ? await prisma.beltHistory.findMany({
        where:   { studentId: { in: studentIds } },
        select:  { studentId: true, beltColor: true, changeDate: true },
        orderBy: { changeDate: "desc" },
      })
    : [];
  const currentBeltByStudent = new Map<string, string>();
  for (const bh of beltHistories) {
    if (!currentBeltByStudent.has(bh.studentId)) currentBeltByStudent.set(bh.studentId, bh.beltColor);
  }

  const link = await prisma.federatedEvaluationLink.create({
    data: {
      evaluationId, applicationId,
      childDojoId: application.dojoId,
      beltFilter:  effectiveFilter,
      createdBy:   createdByUserId,
    },
  });

  if (invitees.length > 0) {
    await prisma.federatedCandidate.createMany({
      data: invitees.map(inv => ({
        linkId:         link.id,
        parentDojoId,
        childDojoId:    application.dojoId,
        childStudentId: inv.studentId,
        fullName:       inv.student.fullName,
        photo:          inv.student.photo,
        currentBelt:    currentBeltByStudent.get(inv.studentId) ?? null,
        beltToPresent:  inv.beltToPresent,
      })),
      skipDuplicates: true,
    });
  }

  return { ok: true, linkId: link.id, candidateCount: invitees.length };
}
