import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// Valida que la lista de IDs de alumnos enviada desde el cliente para el
// campo BeltVideo.visibleToStudentIds pertenezca realmente al dojo del
// admin que hace la petición — evita que se filtren IDs de otros dojos.
// Devuelve null si la lista viene vacía (= comportamiento normal por cinta,
// el admin explícitamente no pidió restringir). Si el admin SÍ pidió
// restringir a alumnos específicos pero ninguno de los IDs enviados es
// válido para este dojo, se rechaza la escritura (fail-closed) en vez de
// revertir en silencio a "visible para todos los de esta cinta" — lo
// contrario expondría el video a todo el mundo sin que nadie se entere.
export async function sanitizeStudentAllowlist(
  raw: unknown,
  dojoId: string,
): Promise<Prisma.NullableJsonNullValueInput | string[]> {
  if (!Array.isArray(raw) || raw.length === 0) return Prisma.JsonNull;

  const ids = raw.filter((v): v is string => typeof v === "string" && v.length > 0);
  if (ids.length === 0) return Prisma.JsonNull;

  const matched = await prisma.student.findMany({
    where:  { id: { in: ids }, dojoId },
    select: { id: true },
  });

  if (matched.length === 0) {
    throw new Error("Ninguno de los alumnos seleccionados es válido — vuelve a seleccionarlos.");
  }

  return matched.map(s => s.id);
}
