import prisma from "@/lib/prisma";

/**
 * Verifica que un correo de acudiente (madre/padre) no colisione con una
 * cuenta de staff (admin/user/sysadmin) ya existente en el sistema.
 *
 * Motivo: /api/students/[id]/access y /api/students/bulk-portal-access
 * activan el portal haciendo upsert(User) por email — si ese correo ya
 * pertenece a un admin, lo convierten en cuenta de alumno y le rompen el
 * acceso (incidente real: correo de acudiente == correo del admin del dojo).
 * Este chequeo detiene el problema en el origen, al guardar el alumno.
 *
 * Devuelve un mensaje de error si hay conflicto, o null si el correo es seguro.
 */
export async function checkGuardianEmailConflict(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  const norm = email.trim().toLowerCase();
  if (!norm) return null;

  const existing = await prisma.user.findUnique({
    where:  { email: norm },
    select: { role: true },
  });
  if (existing && existing.role !== "student") {
    return `El correo "${norm}" ya está en uso por una cuenta de usuario/administrador del sistema. No puede usarse como correo de acudiente.`;
  }
  return null;
}

/**
 * Verifica que el correo de acudiente a usar para el portal no esté ya activo
 * en OTRO alumno (típicamente un hermano con el mismo correo de madre/padre).
 *
 * Motivo: /api/students/[id]/access y /api/students/bulk-portal-access activan
 * el portal haciendo upsert(User) por email — si dos hermanos comparten el
 * mismo correo de acudiente, otorgar acceso al segundo reasigna en silencio
 * la cuenta del primero (mismo email = misma fila de User), dejándolo sin
 * acceso sin ninguna revocación explícita. Confirmado en producción: el log
 * de auditoría mostraba el acceso "rebotando" entre hermanos repetidamente.
 *
 * Regla de negocio: solo un alumno por correo de acudiente puede tener acceso
 * activo a la vez — el primero en activarlo queda como "principal" mientras
 * su acceso siga activo; los demás quedan bloqueados hasta que se revoque.
 *
 * Devuelve el nombre del alumno que ya tiene el acceso activo con ese correo,
 * o null si no hay conflicto (correo libre, o ya es de este mismo alumno).
 */
export async function checkExistingStudentPortalUser(
  email: string,
  excludeStudentId: string,
): Promise<{ fullName: string } | null> {
  const existing = await prisma.user.findUnique({
    where:  { email },
    select: { active: true, studentId: true, student: { select: { fullName: true } } },
  });
  if (existing?.active && existing.studentId && existing.studentId !== excludeStudentId) {
    return { fullName: existing.student?.fullName ?? "otro alumno" };
  }
  return null;
}
