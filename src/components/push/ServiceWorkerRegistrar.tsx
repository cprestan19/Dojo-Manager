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

    // El manifest necesita display:standalone para que push funcione en iPhone
    // (Apple exige "Agregar a inicio" antes de dar permiso de notificaciones).
    // Eso mismo hace que Chrome/Android ofrezca su propio banner de "Instalar
    // app" — lo bloqueamos para que el único camino de activar notificaciones
    // sea el botón de la app, no un banner de instalación que confunde al usuario.
    const blockInstallPrompt = (e: Event) => e.preventDefault();
    window.addEventListener("beforeinstallprompt", blockInstallPrompt);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handler);
      window.removeEventListener("beforeinstallprompt", blockInstallPrompt);
    };
  }, [router]);

  return null;
}
