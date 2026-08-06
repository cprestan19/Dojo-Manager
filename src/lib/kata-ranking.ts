import prisma from "@/lib/prisma";

/**
 * Valida que los IDs de alumnos enviados desde el cliente para asignar una
 * Kata de Competencia pertenezcan realmente al dojo del admin que hace la
 * petición — evita que se filtren IDs de otro dojo. No lanza si viene vacío
 * (= sin alumnos asignados, válido). Descarta silenciosamente cualquier ID
 * que no pertenezca al dojo en vez de fallar toda la operación.
 */
export async function sanitizeKataStudentIds(raw: unknown, dojoId: string): Promise<string[]> {
  if (!Array.isArray(raw)) return [];
  const ids = [...new Set(raw.filter((v): v is string => typeof v === "string" && v.length > 0))];
  if (ids.length === 0) return [];

  const matched = await prisma.student.findMany({
    where:  { id: { in: ids }, dojoId },
    select: { id: true },
  });
  return matched.map(s => s.id);
}

/**
 * Reemplaza el set completo de alumnos asignados a una Kata de Competencia
 * por el nuevo set validado — diff mínimo (solo borra/crea lo que cambió).
 */
export async function syncKataRankingAssignments(kataId: string, studentIds: string[]): Promise<void> {
  const current = await prisma.kataRankingAssignment.findMany({
    where:  { kataId },
    select: { studentId: true },
  });
  const currentIds = new Set(current.map(c => c.studentId));
  const nextIds    = new Set(studentIds);

  const toRemove = [...currentIds].filter(id => !nextIds.has(id));
  const toAdd    = [...nextIds].filter(id => !currentIds.has(id));

  await prisma.$transaction([
    ...(toRemove.length > 0
      ? [prisma.kataRankingAssignment.deleteMany({ where: { kataId, studentId: { in: toRemove } } })]
      : []),
    ...(toAdd.length > 0
      ? [prisma.kataRankingAssignment.createMany({ data: toAdd.map(studentId => ({ kataId, studentId })) })]
      : []),
  ]);
}
