import prisma from "@/lib/prisma";
import { normalizePhoneE164 } from "@/lib/whatsapp/sendTemplate";

const DAY_MS = 86_400_000;
const daysSince = (date: Date | null) => date ? Math.floor((Date.now() - date.getTime()) / DAY_MS) : null;

export type TriggerType = "WELCOME" | "HELP_NO_STUDENTS" | "FOLLOWUP" | "LAST_ATTEMPT" | "REACTIVATION";

export const TEMPLATE_BY_TYPE: Record<TriggerType, string> = {
  // "bienvenida_dojomaster" quedó aprobado por Meta con el nombre "bienvenida_2"
  // (no se puede reusar el mismo nombre al recategorizar UTILITY→MARKETING) —
  // confirmado vía GET /{WABA_ID}/message_templates (2026-08-15).
  WELCOME:          "bienvenida_2",
  HELP_NO_STUDENTS: "ayuda_primer_alumno",
  FOLLOWUP:         "seguimiento_activo",
  LAST_ATTEMPT:     "ultimo_intento_activacion",
  // Descartado por decisión del usuario ("no hagamos el 5 template") — nombre reservado, no se usa.
  REACTIVATION:      "reactivacion_dojomaster",
};

export interface Candidate {
  dojoId: string; dojo: string; phone: string | null;
  diasCreado: number; alumnos: number; diasSinSesion: number | null;
  type: TriggerType; template: string;
}

export async function computeCandidates(): Promise<Candidate[]> {
  const dojos = await prisma.dojo.findMany({
    // whatsappOptIn=false: el dueño pidió que no le escribamos más (manual o
    // automático vía "detener"/"stop") — nunca se le vuelve a proponer un
    // disparador mientras esté así, aunque siga calificando por fecha/alumnos.
    where: { active: true, whatsappOptIn: true },
    select: {
      id: true, name: true, phone: true, createdAt: true,
      students: { select: { id: true } },
      users: { where: { role: "admin" }, select: { lastActiveAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Ya registrados (de cualquier estado) — no se vuelven a proponer.
  const existing = await prisma.dojoLifecycleMessage.findMany({
    select: { dojoId: true, type: true },
  });
  const alreadyLogged = new Set(existing.map(m => `${m.dojoId}:${m.type}`));

  const candidates: Candidate[] = [];

  for (const d of dojos) {
    // LAST_ATTEMPT es el último mensaje del flujo automático — una vez
    // enviado, se deja de proponer cualquier otro tipo para ese dojo (aunque
    // más adelante cumpla otra condición, ej. agregue su primer alumno).
    // Pedido explícito del usuario: "ya recibió el último mensaje del flujo,
    // no se le envía más mensajes".
    if (alreadyLogged.has(`${d.id}:LAST_ATTEMPT`)) continue;

    const studentCount = d.students.length;
    const daysCreated   = daysSince(d.createdAt) ?? 0;
    const lastActive = d.users
      .map(u => u.lastActiveAt)
      .filter((v): v is Date => !!v)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const daysInactive = daysSince(lastActive);

    const push = (type: TriggerType) => {
      if (alreadyLogged.has(`${d.id}:${type}`)) return;
      candidates.push({
        dojoId: d.id, dojo: d.name, phone: d.phone,
        diasCreado: daysCreated, alumnos: studentCount, diasSinSesion: daysInactive,
        type, template: TEMPLATE_BY_TYPE[type],
      });
    };

    if (daysCreated === 0) push("WELCOME");
    if (daysCreated >= 2 && studentCount === 0) push("HELP_NO_STUDENTS");
    if (daysCreated >= 3 && studentCount >= 1) push("FOLLOWUP");
    if (daysCreated >= 7 && studentCount === 0) push("LAST_ATTEMPT");
    if (studentCount >= 1 && daysInactive !== null && daysInactive >= 10) push("REACTIVATION");
  }

  return candidates;
}

/**
 * Registra (no envía) — crea una fila PENDING por cada candidato nuevo.
 * Sigue sin llamar a Meta. `recipientPhone` guarda el teléfono ya
 * normalizado a E.164 cuando se pudo interpretar (null si no).
 * Compartida entre el botón manual del panel (POST) y el cron automático
 * (GET, en /api/cron/dojo-lifecycle-messages/register) — Vercel Cron siempre
 * llama por GET, nunca POST.
 */
export async function registerCandidates(): Promise<{ creados: number }> {
  const candidates = await computeCandidates();
  if (candidates.length === 0) return { creados: 0 };

  const result = await prisma.dojoLifecycleMessage.createMany({
    data: candidates.map(c => ({
      dojoId:         c.dojoId,
      type:           c.type,
      channel:        "whatsapp",
      templateName:   c.template,
      status:         "PENDING",
      recipientPhone: normalizePhoneE164(c.phone),
      note:           `Detectado automáticamente — ${c.alumnos} alumno(s), creado hace ${c.diasCreado}d.`,
    })),
    skipDuplicates: true,
  });
  return { creados: result.count };
}

export function summarizeCandidates(candidates: Candidate[]) {
  const byType: Record<string, Candidate[]> = {};
  for (const c of candidates) (byType[c.type] ??= []).push(c);
  return byType;
}
