/**
 * POST /api/cron/dojo-lifecycle-messages/test-send
 *
 * Envío de PRUEBA del CRM "Primera Etapa" — el destino está FIJO en el
 * código (TEST_PHONE, el número personal de Cristhian). No se puede pasar
 * por parámetro ni se saca de la base de datos, así que este endpoint nunca
 * puede terminar mandándole un mensaje real a un dojo cliente por error.
 *
 * No toca DojoLifecycleMessage — es un disparo aislado, no marca ninguna
 * fila PENDING como enviada. Solo sirve para confirmar que cada template
 * (variables, botones) se ve bien en Meta antes de conectar el envío real.
 *
 * Disparo manual únicamente, cuando el usuario lo pida explícitamente —
 * mismo patrón dual de auth que el resto de este módulo (CRON_SECRET o
 * sesión sysadmin).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { callMetaGraphApi } from "@/lib/whatsapp/sendTemplate";
import { LIFECYCLE_TEMPLATE_CFG, buildLifecycleVars, type LifecycleTriggerType } from "@/lib/whatsapp/lifecycleTemplates";

export const dynamic = "force-dynamic";

// Número personal de prueba de Cristhian — NUNCA un teléfono de dojo real.
const TEST_PHONE = "+50762019999";

type TriggerType = LifecycleTriggerType;
const TEMPLATE_CFG = LIFECYCLE_TEMPLATE_CFG;

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

  const body = await req.json().catch(() => ({})) as { type?: string; dojoName?: string };
  const type = body.type as TriggerType;
  if (!type || !(type in TEMPLATE_CFG)) {
    return NextResponse.json(
      { error: `type debe ser uno de: ${Object.keys(TEMPLATE_CFG).join(", ")}` },
      { status: 400 },
    );
  }
  const dojoName = body.dojoName?.trim() || "Dojo de Prueba";

  const { headerParams, bodyParams } = buildLifecycleVars(type, dojoName);
  const cfg = TEMPLATE_CFG[type];
  const result = await callMetaGraphApi(TEST_PHONE, {
    templateName: cfg.name,
    language: cfg.language,
    headerParams,
    bodyParams,
  });

  return NextResponse.json({
    ok: result.ok,
    destino: TEST_PHONE,
    template: cfg.name,
    metaMessageId: result.metaMessageId ?? null,
    error: result.errorMessage ?? null,
  });
}
