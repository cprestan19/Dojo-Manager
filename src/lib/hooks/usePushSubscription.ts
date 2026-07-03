"use client";
import { useState, useEffect, useCallback } from "react";

type PushState =
  | "loading"        // verificando estado inicial
  | "unsupported"    // browser no soporta push
  | "denied"         // usuario bloqueó permisos
  | "subscribed"     // activo
  | "unsubscribed"   // soportado pero no suscrito
  | "error";         // error inesperado

interface UsePushSubscription {
  state:        PushState;
  subscribe:    () => Promise<boolean>;
  unsubscribe:  () => Promise<boolean>;
  sendTest:     () => Promise<boolean>;
  isIOS:        boolean;
  isInstalled:  boolean; // si está instalado como PWA
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function detectInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/vapid-key");
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKey?: string };
    return data.publicKey ?? null;
  } catch {
    return null;
  }
}

async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export function usePushSubscription(): UsePushSubscription {
  const [state,       setState]       = useState<PushState>("loading");
  const [isIOS]                       = useState(detectIOS);
  const [isInstalled]                 = useState(detectInstalled);

  // Detectar soporte y estado inicial
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }

    const permission = Notification.permission;
    if (permission === "denied") {
      setState("denied");
      return;
    }

    getCurrentSubscription()
      .then((sub) => {
        if (!sub) { setState("unsubscribed"); return; }
        // Verificar en el servidor que sigue activa
        fetch(`/api/push/status?endpoint=${encodeURIComponent(sub.endpoint)}`)
          .then((r) => r.ok ? r.json() : { subscribed: false })
          .then((d: { subscribed?: boolean }) => setState(d.subscribed ? "subscribed" : "unsubscribed"))
          .catch(() => setState("subscribed")); // si falla la red, asumir suscrito
      })
      .catch(() => setState("unsubscribed"));
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

      const vapidPublicKey = await getVapidPublicKey();
      if (!vapidPublicKey) return false;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "unsubscribed");
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      });

      const key  = sub.getKey("p256dh");
      const auth = sub.getKey("auth");
      if (!key || !auth) { await sub.unsubscribe(); return false; }

      const res = await fetch("/api/push/subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          endpoint: sub.endpoint,
          p256dh:   btoa(String.fromCharCode(...new Uint8Array(key))),
          auth:     btoa(String.fromCharCode(...new Uint8Array(auth))),
        }),
      });

      if (!res.ok) { await sub.unsubscribe(); return false; }

      setState("subscribed");
      return true;
    } catch (err) {
      console.error("[push] subscribe error:", err);
      setState("error");
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      const sub = await getCurrentSubscription();
      if (!sub) { setState("unsubscribed"); return true; }

      await fetch("/api/push/unsubscribe", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
      setState("unsubscribed");
      return true;
    } catch (err) {
      console.error("[push] unsubscribe error:", err);
      return false;
    }
  }, []);

  const sendTest = useCallback(async (): Promise<boolean> => {
    try {
      const sub = await getCurrentSubscription();
      if (!sub) return false;

      const res = await fetch("/api/push/test", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ endpoint: sub.endpoint }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  return { state, subscribe, unsubscribe, sendTest, isIOS, isInstalled };
}
