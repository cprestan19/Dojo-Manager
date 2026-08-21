/**
 * GET /api/cron/dojo-lifecycle-messages/register — versión "real" del
 * registro de candidatos, accesible por GET porque Vercel Cron siempre
 * llama por GET (nunca POST). Hace exactamente lo mismo que el botón
 * "Registrar candidatos" del panel (POST /api/cron/dojo-lifecycle-messages),
 * solo que pensado para dispararse solo desde vercel.json — así "bienvenida"
 * y los demás mensajes del ciclo de vida dejan de depender de que alguien
 * entre a /dashboard/superadmin/clientes y presione el botón a tiempo.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { registerCandidates } from "@/lib/whatsapp/dojoLifecycle";

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
    const { creados } = await registerCandidates();
    return NextResponse.json({
      ok: true,
      creados,
      nota: creados === 0 ? "Sin candidatos nuevos." : "Solo se registró — todavía no se envió ningún WhatsApp real.",
    });
  } catch (err) {
    console.error("[cron/dojo-lifecycle-messages/register GET] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
