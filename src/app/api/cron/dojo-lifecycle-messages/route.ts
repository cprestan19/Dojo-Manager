/**
 * /api/cron/dojo-lifecycle-messages — CRM "Primera Etapa" (Activación y Riesgo Básico).
 *
 * GET  → modo simulacro: calcula quién calificaría HOY para cada uno de los
 *        5 mensajes de seguimiento. Solo lectura, no escribe nada.
 * POST → modo real de REGISTRO (no de envío) — botón manual del panel. Crea
 *        una fila PENDING en DojoLifecycleMessage por cada candidato nuevo.
 *        El mismo registro real también corre solo, por cron, en
 *        GET /api/cron/dojo-lifecycle-messages/register (Vercel Cron solo
 *        llama por GET, por eso vive en una ruta aparte).
 *        Todavía NO llama a la API de WhatsApp — solo dice "a este dojo le
 *        toca contacto". El envío real lo hace .../send-pending.
 *
 * Ambos protegidos por Authorization: Bearer CRON_SECRET, igual que el
 * resto de los crons existentes (ver payment-late-status).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computeCandidates, registerCandidates, summarizeCandidates } from "@/lib/whatsapp/dojoLifecycle";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

type SessionUser = { role?: string };

async function checkAuth(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!!cronSecret && auth === `Bearer ${cronSecret}`) return true;

  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUser | undefined)?.role;
  return role === "sysadmin";
}

export async function GET(req: NextRequest) {
  if (!(await checkAuth(req))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const candidates = await computeCandidates();
    const grouped = summarizeCandidates(candidates);
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

export async function POST(req: NextRequest) {
  if (!(await checkAuth(req))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { creados } = await registerCandidates();
    return NextResponse.json({
      ok: true,
      creados,
      nota: creados === 0 ? "Sin candidatos nuevos." : "Solo se registró — todavía no se envió ningún WhatsApp real.",
    });
  } catch (err) {
    console.error("[cron/dojo-lifecycle-messages POST] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
