/**
 * POST /api/cron/payment-late-status/delinquency-summary-test-send
 *
 * Envío de PRUEBA del resumen de morosidad para admin de dojo
 * (resumen_morosidad_dojomaster) — mismo patrón de seguridad que
 * dojo-lifecycle-messages/test-send: el destino está FIJO en el código
 * (TEST_PHONE, número personal de Cristhian), nunca se puede pasar por
 * parámetro ni se saca de la base de datos, y no toca WhatsAppNotification
 * (no deja rastro, es solo para confirmar que el template se ve bien en
 * Meta antes de dejar que el cron real lo dispare).
 *
 * Disparo manual únicamente. Mismo dual de auth que el resto de los crons
 * (CRON_SECRET o sesión sysadmin).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { callMetaGraphApi } from "@/lib/whatsapp/sendTemplate";
import { DELINQUENCY_SUMMARY_TEMPLATE, buildDelinquencySummaryVars } from "@/lib/whatsapp/delinquencySummary";

export const dynamic = "force-dynamic";

// Número personal de prueba de Cristhian — NUNCA un teléfono de dojo real.
const TEST_PHONE = "+50762019999";

type SessionUser = { role?: string };

async function checkAuth(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!!cronSecret && auth === `Bearer ${cronSecret}`) return true;

  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUser | undefined)?.role;
  return role === "sysadmin";
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth(req))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    dojoName?: string; lateStudents?: number; lateAmount?: number; collectedThisMonth?: number;
  };

  const stats = {
    lateStudents:       body.lateStudents       ?? 4,
    lateAmount:         body.lateAmount         ?? 320,
    collectedThisMonth: body.collectedThisMonth ?? 1250,
  };
  const dojoName = body.dojoName?.trim() || "Dojo de Prueba";

  const { bodyParams } = buildDelinquencySummaryVars(dojoName, stats);
  const result = await callMetaGraphApi(TEST_PHONE, {
    templateName: DELINQUENCY_SUMMARY_TEMPLATE.name,
    language:     DELINQUENCY_SUMMARY_TEMPLATE.language,
    bodyParams,
  });

  return NextResponse.json({
    ok:            result.ok,
    destino:       TEST_PHONE,
    template:      DELINQUENCY_SUMMARY_TEMPLATE.name,
    statsUsados:   stats,
    metaMessageId: result.metaMessageId ?? null,
    error:         result.errorMessage ?? null,
  });
}
