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
