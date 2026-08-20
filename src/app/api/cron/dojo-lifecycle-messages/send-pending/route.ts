/**
 * POST /api/cron/dojo-lifecycle-messages/send-pending
 *
 * Envío REAL a dojos-clientes reales — lee las filas PENDING que dejó
 * POST /api/cron/dojo-lifecycle-messages (registro) y a cada una le llama a
 * Meta de verdad. Nunca se dispara solo: exige que CrmSettings.whatsappSendEnabled
 * esté en true, y ese interruptor arranca APAGADO — decisión del usuario
 * ("quiero activarlo yo"), se prende desde el botón en
 * /dashboard/superadmin/clientes (o vía PUT /api/superadmin/crm-settings).
 *
 * Antes de cada envío se re-valida el estado del dojo (activo + opt-in +
 * teléfono válido) por si cambió después de registrarse como PENDING —
 * nunca confía solo en lo que se guardó al momento del registro.
 *
 * Máximo UN mensaje por dojo por corrida — un dojo puede acumular varias
 * filas PENDING de distintos disparadores (ej. "ayuda sin alumnos" del día 2
 * y "último intento" del día 7, si nunca se lo contactó) y estaban pensados
 * para llegar espaciados en días, no los dos casi al mismo tiempo en la misma
 * corrida. Se manda solo el más antiguo (el disparador que lleva más tiempo
 * esperando); el resto queda PENDING para la próxima corrida.
 *
 * Mismo patrón dual de auth que el resto de este módulo (CRON_SECRET o sesión sysadmin).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { callMetaGraphApi } from "@/lib/whatsapp/sendTemplate";
import { LIFECYCLE_TEMPLATE_CFG, buildLifecycleVars, type LifecycleTriggerType } from "@/lib/whatsapp/lifecycleTemplates";
import { SUPPORT_PHONE } from "@/lib/whatsapp/supportBot";

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

function isSupportedType(type: string): type is LifecycleTriggerType {
  return type in LIFECYCLE_TEMPLATE_CFG;
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth(req))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const settings = await prisma.crmSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.whatsappSendEnabled) {
    return NextResponse.json({
      ok: false,
      error: "Envío real desactivado — actívalo desde /dashboard/superadmin/clientes antes de disparar esto.",
    });
  }

  const pending = await prisma.dojoLifecycleMessage.findMany({
    where: { status: "PENDING", channel: "whatsapp" },
    include: { dojo: { select: { id: true, name: true, active: true, whatsappOptIn: true } } },
    orderBy: { createdAt: "asc" }, // el disparador que lleva más tiempo esperando va primero
    take: 200, // tope defensivo por corrida — evita una tanda gigante si algo quedó mal registrado
  });

  let enviados = 0, fallidos = 0, sinTelefono = 0, omitidos = 0, espaciados = 0;
  const dojosProcesadosEnEstaCorrida = new Set<string>();

  for (const msg of pending) {
    // Ya se le mandó (o se le va a mandar) algo a este dojo en esta misma
    // corrida — el resto de sus disparadores pendientes espera a la próxima
    // corrida, para no mandarle 2-3 mensajes casi al mismo tiempo.
    if (dojosProcesadosEnEstaCorrida.has(msg.dojoId)) { espaciados++; continue; }

    // Sin teléfono válido registrado — se deja PENDING para seguimiento manual
    // desde el panel, nunca se cuenta como "fallido" (no se intentó enviar).
    // No marca el dojo como "procesado" — no se le envió nada de verdad.
    if (!msg.recipientPhone) { sinTelefono++; continue; }

    dojosProcesadosEnEstaCorrida.add(msg.dojoId);

    // Re-validación al momento de enviar — el dojo pudo desactivarse o darse
    // de baja después de quedar registrado como PENDING.
    if (!msg.dojo.active || !msg.dojo.whatsappOptIn) {
      await prisma.dojoLifecycleMessage.update({
        where: { id: msg.id },
        data: { status: "FAILED", errorDetail: "Dojo inactivo o dado de baja de WhatsApp — no se envió." },
      });
      omitidos++;
      continue;
    }

    if (!isSupportedType(msg.type)) { omitidos++; continue; }

    const cfg = LIFECYCLE_TEMPLATE_CFG[msg.type];
    const { headerParams, bodyParams } = buildLifecycleVars(msg.type, msg.dojo.name);

    const result = await callMetaGraphApi(msg.recipientPhone, {
      templateName: cfg.name,
      language: cfg.language,
      headerParams,
      bodyParams,
    });

    if (result.ok) {
      await prisma.dojoLifecycleMessage.update({
        where: { id: msg.id },
        data: { status: "SENT", sentAt: new Date(), metaMessageId: result.metaMessageId ?? null },
      });
      enviados++;

      // Copia temporal al número de soporte, para que el sysadmin pueda dar
      // seguimiento y validar que el envío real del CRM funciona — pedido
      // explícito del usuario, quitar cuando ya no haga falta verificarlo.
      // Nunca bloquea ni afecta el resultado del envío principal al dojo.
      if (msg.recipientPhone !== SUPPORT_PHONE) {
        try {
          await callMetaGraphApi(SUPPORT_PHONE, {
            templateName: cfg.name, language: cfg.language, headerParams, bodyParams,
          });
        } catch (err) {
          console.error("Error enviando copia de seguimiento del mensaje de CRM:", err);
        }
      }
    } else {
      await prisma.dojoLifecycleMessage.update({
        where: { id: msg.id },
        data: { status: "FAILED", errorDetail: result.errorMessage ?? "Error desconocido" },
      });
      fallidos++;
    }
  }

  return NextResponse.json({
    ok: true,
    total: pending.length,
    enviados, fallidos, sinTelefono, omitidos, espaciados,
  });
}
