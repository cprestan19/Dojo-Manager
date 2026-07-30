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
