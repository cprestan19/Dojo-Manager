import webpush from "web-push";
import prisma from "@/lib/prisma";

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT     ?? "mailto:admin@dojomasteronline.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export { VAPID_PUBLIC_KEY };

export interface PushPayload {
  title:              string;
  body:               string;
  icon?:              string;
  badge?:             string;
  url?:               string;
  tag?:               string;
  requireInteraction?: boolean;
  renotify?:          boolean;
}

interface SubscriptionData {
  endpoint: string;
  p256dh:   string;
  auth:     string;
}

interface SendResult {
  success: number;
  failed:  number;
  expired: string[]; // endpoints que devolvieron 410 → desactivar
}

const BATCH_SIZE = 50;

export async function sendPushToSubscriptions(
  subscriptions: SubscriptionData[],
  payload: PushPayload,
): Promise<SendResult> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[push] VAPID keys not configured — skipping push send");
    return { success: 0, failed: 0, expired: [] };
  }

  const result: SendResult = { success: 0, failed: 0, expired: [] };
  const pushData = JSON.stringify({
    ...payload,
    icon:  payload.icon  ?? "/logo.png",
    badge: payload.badge ?? "/logo.png",
  });

  for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          pushData,
          { TTL: 24 * 60 * 60 }, // TTL: 24 horas
        )
      )
    );

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled") {
        result.success++;
      } else {
        result.failed++;
        const err = r.reason as { statusCode?: number };
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          result.expired.push(batch[j].endpoint);
        }
      }
    }
  }

  // Desactivar suscripciones expiradas (410 Gone)
  if (result.expired.length > 0) {
    await prisma.pushSubscription
      .updateMany({
        where:  { endpoint: { in: result.expired } },
        data:   { active: false, failCount: { increment: 1 } },
      })
      .catch(() => {}); // fire-and-forget
  }

  return result;
}

// Obtiene suscripciones activas de alumnos de un dojo
export async function getDojoStudentSubscriptions(dojoId: string): Promise<SubscriptionData[]> {
  const subs = await prisma.pushSubscription.findMany({
    where:  { dojoId, active: true, studentId: { not: null } },
    select: { endpoint: true, p256dh: true, auth: true },
  });
  return subs;
}

// Obtiene suscripciones activas de admins/usuarios de un dojo
export async function getDojoAdminSubscriptions(dojoId: string): Promise<SubscriptionData[]> {
  const subs = await prisma.pushSubscription.findMany({
    where:  { dojoId, active: true, userId: { not: null } },
    select: { endpoint: true, p256dh: true, auth: true },
  });
  return subs;
}

// Obtiene suscripciones activas de UN alumno específico
export async function getStudentSubscriptions(studentId: string): Promise<SubscriptionData[]> {
  const subs = await prisma.pushSubscription.findMany({
    where:  { studentId, active: true },
    select: { endpoint: true, p256dh: true, auth: true },
  });
  return subs;
}

// Guarda el log de envío y actualiza failCount de suscripciones fallidas
export async function logPushSent(params: {
  dojoId:      string;
  type:        string;
  title:       string;
  body:        string;
  url?:        string;
  result:      SendResult;
  sentBy?:     string;
}): Promise<void> {
  await prisma.pushNotificationLog
    .create({
      data: {
        dojoId:       params.dojoId,
        type:         params.type,
        title:        params.title,
        body:         params.body,
        url:          params.url ?? null,
        targetCount:  params.result.success + params.result.failed,
        successCount: params.result.success,
        failCount:    params.result.failed,
        sentBy:       params.sentBy ?? null,
      },
    })
    .catch(() => {}); // no lanzar error — el envío ya ocurrió
}

// Helper: envía push a todos los alumnos del dojo (fire-and-forget)
export function sendPushToDojoStudentsAsync(
  dojoId: string,
  payload: PushPayload,
  opts?: { type?: string; sentBy?: string; url?: string },
): void {
  getDojoStudentSubscriptions(dojoId)
    .then((subs) => {
      if (subs.length === 0) return;
      return sendPushToSubscriptions(subs, payload).then((result) =>
        logPushSent({
          dojoId,
          type:   opts?.type  ?? "manual",
          title:  payload.title,
          body:   payload.body,
          url:    opts?.url ?? payload.url,
          result,
          sentBy: opts?.sentBy,
        })
      );
    })
    .catch((err) => console.error("[push] sendPushToDojoStudentsAsync:", err));
}

// Helper: envía push a todos los admins del dojo (fire-and-forget)
export function sendPushToDojoAdminsAsync(
  dojoId: string,
  payload: PushPayload,
  opts?: { type?: string; sentBy?: string },
): void {
  getDojoAdminSubscriptions(dojoId)
    .then((subs) => {
      if (subs.length === 0) return;
      return sendPushToSubscriptions(subs, payload).then((result) =>
        logPushSent({
          dojoId,
          type:   opts?.type  ?? "admin_notification",
          title:  payload.title,
          body:   payload.body,
          url:    payload.url,
          result,
          sentBy: opts?.sentBy,
        })
      );
    })
    .catch((err) => console.error("[push] sendPushToDojoAdminsAsync:", err));
}

// Helper: envía push al alumno específico (fire-and-forget)
export function sendPushToStudentAsync(
  studentId: string,
  dojoId: string,
  payload: PushPayload,
  opts?: { type?: string; sentBy?: string },
): void {
  getStudentSubscriptions(studentId)
    .then((subs) => {
      if (subs.length === 0) return;
      return sendPushToSubscriptions(subs, payload).then((result) =>
        logPushSent({
          dojoId,
          type:   opts?.type  ?? "attendance",
          title:  payload.title,
          body:   payload.body,
          url:    payload.url,
          result,
          sentBy: opts?.sentBy,
        })
      );
    })
    .catch((err) => console.error("[push] sendPushToStudentAsync:", err));
}
