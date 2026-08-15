/**
 * /api/cron/dojo-lifecycle-messages — CRM "Primera Etapa" (Activación y Riesgo Básico).
 *
 * GET  → modo simulacro: calcula quién calificaría HOY para cada uno de los
 *        5 mensajes de seguimiento. Solo lectura, no escribe nada.
 * POST → modo real de REGISTRO (no de envío): crea una fila PENDING en
 *        DojoLifecycleMessage por cada candidato nuevo. Todavía NO llama a
 *        la API de WhatsApp — solo dice "a este dojo le toca contacto".
 *        El envío real (cuando haya templates aprobados en Meta) se agrega
 *        aparte, leyendo las filas PENDING que este POST vaya dejando.
 *
 * Ambos protegidos por Authorization: Bearer CRON_SECRET, igual que el
 * resto de los crons existentes (ver payment-late-status).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizePhoneE164 } from "@/lib/whatsapp/sendTemplate";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 86_400_000;
const daysSince = (date: Date | null) => date ? Math.floor((Date.now() - date.getTime()) / DAY_MS) : null;

type TriggerType = "WELCOME" | "HELP_NO_STUDENTS" | "FOLLOWUP" | "LAST_ATTEMPT" | "REACTIVATION";

const TEMPLATE_BY_TYPE: Record<TriggerType, string> = {
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

interface Candidate {
  dojoId: string; dojo: string; phone: string | null;
  diasCreado: number; alumnos: number; diasSinSesion: number | null;
  type: TriggerType; template: string;
}

type SessionUser = { role?: string };

async function checkAuth(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!!cronSecret && auth === `Bearer ${cronSecret}`) return true;

  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUser | undefined)?.role;
  return role === "sysadmin";
}

async function computeCandidates(): Promise<Candidate[]> {
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

function summarize(candidates: Candidate[]) {
  const byType: Record<string, Candidate[]> = {};
  for (const c of candidates) (byType[c.type] ??= []).push(c);
  return byType;
}

export async function GET(req: NextRequest) {
  if (!(await checkAuth(req))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const candidates = await computeCandidates();
    const grouped = summarize(candidates);
    const resumen = Object.fromEntries(Object.entries(grouped).map(([t, l]) => [t, l.length]));

    return NextResponse.json({
      dryRun: true,
      note: "Modo simulacro — nada se registró ni se envió. REACTIVATION usa un nombre de template reservado, texto pendiente.",
      resumen,
      candidatos: grouped,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[cron/dojo-lifecycle-messages GET] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * Registra (no envía) — crea una fila PENDING por cada candidato nuevo.
 * Sigue sin llamar a Meta. `recipientPhone` guarda el teléfono ya
 * normalizado a E.164 cuando se pudo interpretar (null si no).
 */
export async function POST(req: NextRequest) {
  if (!(await checkAuth(req))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const candidates = await computeCandidates();

    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, creados: 0, mensaje: "Sin candidatos nuevos." });
    }

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

    return NextResponse.json({
      ok: true,
      creados: result.count,
      nota: "Solo se registró — todavía no se envió ningún WhatsApp real.",
    });
  } catch (err) {
    console.error("[cron/dojo-lifecycle-messages POST] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
