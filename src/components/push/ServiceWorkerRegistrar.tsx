"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Registra el Service Worker y escucha mensajes de navegación push
export default function ServiceWorkerRegistrar() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Verificar actualizaciones del SW en segundo plano
        reg.update().catch(() => null);
      })
      .catch((err) => console.warn("[SW] Registration failed:", err));

    // Escuchar mensajes del SW (ej: navegación por click en notificación)
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_NAVIGATE" && event.data?.url) {
        router.push(event.data.url as string);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [router]);

  return null;
}
