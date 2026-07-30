import prisma from "@/lib/prisma";

export interface FamilyPrincipal {
  id: string;
  fullName: string;
  email: string | null;
}

/**
 * El "familiar principal" de un familyId es el alumno activo más antiguo
 * (menor createdAt) del grupo — regla de negocio: solo el principal puede
 * tener acceso al portal; los demás hermanos comparten sesión a través de él
 * (selector de hermano ya existente en /api/portal/family, belt-videos, etc).
 *
 * Devuelve null si el familyId no tiene ningún alumno activo (grupo vacío).
 */
export async function getFamilyPrincipal(dojoId: string, familyId: string): Promise<FamilyPrincipal | null> {
  const principal = await prisma.student.findFirst({
    where:   { dojoId, familyId, active: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, fullName: true,
      primaryGuardian: true, motherEmail: true, fatherEmail: true,
    },
  });
  if (!principal) return null;

  const guardianEmail = principal.primaryGuardian === "mother"
    ? principal.motherEmail?.trim()
    : principal.primaryGuardian === "father"
    ? principal.fatherEmail?.trim()
    : null;
  const email = guardianEmail || principal.motherEmail?.trim() || principal.fatherEmail?.trim() || null;

  return { id: principal.id, fullName: principal.fullName, email: email ?? null };
}

/**
 * Enriquece una lista de alumnos con `isFamilyPrincipal` y
 * `familyAccessViaPrincipal` — usado en el listado de alumnos para marcar
 * quién es el principal de su familia y quiénes acceden al portal a través
 * de él (sin tener User propio).
 *
 * El principal se calcula sobre TODOS los activos de cada familia (no solo
 * los de `students`), para no dar un resultado incorrecto cuando la lista
 * viene filtrada (búsqueda, cinta, activo/inactivo, etc).
 */
export async function attachFamilyPrincipalInfo<T extends { id: string; familyId: string | null }>(
  dojoId: string,
  students: T[],
): Promise<(T & { isFamilyPrincipal: boolean; familyAccessViaPrincipal: boolean })[]> {
  const familyIds = Array.from(new Set(students.map(s => s.familyId).filter((v): v is string => !!v)));
  const principalsByFamily = new Map<string, FamilyPrincipal | null>();
  await Promise.all(familyIds.map(async fid => {
    principalsByFamily.set(fid, await getFamilyPrincipal(dojoId, fid));
  }));

  const principalIds = Array.from(principalsByFamily.values())
    .filter((p): p is FamilyPrincipal => !!p)
    .map(p => p.id);
  const principalPortalUsers = principalIds.length
    ? await prisma.user.findMany({
        where:  { studentId: { in: principalIds } },
        select: { studentId: true, active: true },
      })
    : [];
  const principalHasAccess = new Map(principalPortalUsers.map(u => [u.studentId, u.active]));

  return students.map(s => {
    const principal = s.familyId ? principalsByFamily.get(s.familyId) ?? null : null;
    const isFamilyPrincipal = !!principal && principal.id === s.id;
    const familyAccessViaPrincipal = !isFamilyPrincipal && !!principal
      && principalHasAccess.get(principal.id) === true;
    return { ...s, isFamilyPrincipal, familyAccessViaPrincipal };
  });
}
