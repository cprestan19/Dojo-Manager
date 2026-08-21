import prisma from "@/lib/prisma";

/**
 * Tipos de Payment que se generan automáticamente (evento/examen con costo)
 * en vez de ser mensualidades reales. Nunca deben acumular mora ni recibir
 * el aviso de atraso — se excluyen explícitamente en el cron de mora
 * (payment-late-status) porque ese template asume una mensualidad.
 */
export const LINKED_PAYMENT_TYPES = ["event", "exam"] as const;

/**
 * Crea el cargo pendiente en la cuenta del alumno cuando confirma un evento
 * con precio o acepta una postulación a examen con costo.
 *
 * Usa upsert sobre un unique real (eventId+studentId / examInviteeId) en vez
 * de find-then-create: dos eventos o exámenes distintos pueden caer en la
 * misma fecha para el mismo alumno (dueDate suele normalizarse a medianoche),
 * lo cual colisionaría con el unique legado (studentId, type, dueDate) y
 * find-then-create además tiene una condición de carrera si el alumno hace
 * doble clic. upsert es atómico y usa la clave de vínculo real.
 */
export async function createLinkedPayment(opts: {
  studentId: string;
  type:      "event" | "exam";
  amount:    number;
  dueDate:   Date;
  note:      string;
  eventId?:      string;
  examInviteeId?: string;
}) {
  if (opts.amount <= 0) return null;

  const data = {
    studentId: opts.studentId,
    type:      opts.type,
    amount:    opts.amount,
    dueDate:   opts.dueDate,
    status:    "pending" as const,
    note:      opts.note,
    eventId:       opts.eventId ?? null,
    examInviteeId: opts.examInviteeId ?? null,
  };

  if (opts.examInviteeId) {
    return prisma.payment.upsert({
      where:  { examInviteeId: opts.examInviteeId },
      update: {}, // ya existe — no se pisa un cargo que el admin pudo haber ajustado
      create: data,
    });
  }
  if (opts.eventId) {
    return prisma.payment.upsert({
      where:  { eventId_studentId: { eventId: opts.eventId, studentId: opts.studentId } },
      update: {},
      create: data,
    });
  }
  return null;
}

/**
 * Cancela (borra) el cargo vinculado cuando el alumno cambia de opinión —
 * solo si todavía no se pagó. Si ya está pagado se deja intacto (no se borra
 * dinero ya cobrado) y el admin lo maneja a mano.
 */
export async function cancelLinkedPaymentIfUnpaid(where: { eventId?: string; examInviteeId?: string; studentId: string }) {
  const payment = await prisma.payment.findFirst({ where });
  if (!payment) return { canceled: false as const };
  if (payment.status === "paid") return { canceled: false as const, alreadyPaid: true as const };

  await prisma.payment.delete({ where: { id: payment.id } });
  return { canceled: true as const, payment };
}
