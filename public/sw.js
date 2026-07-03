// Dojo Master — Service Worker v1
// Maneja notificaciones push cuando la app está en segundo plano o cerrada

const CACHE_NAME = "dojo-master-v1";

// ── Instalación ──────────────────────────────────────────────────────────────
self.addEventListener("install", () => {
  self.skipWaiting();
});

// ── Activación ───────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Push recibido ─────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Dojo Master", body: event.data.text() };
  }

  const title = data.title || "Dojo Master";
  const options = {
    body:    data.body    || "",
    icon:    data.icon    || "/logo.png",
    badge:   data.badge   || "/logo.png",
    tag:     data.tag     || "dojo-notification",
    renotify: !!data.renotify,
    data:    { url: data.url || "/portal" },
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Click en la notificación ──────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/portal";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay una pestaña con la app abierta, redirigirla y enfocarla
        for (const client of clientList) {
          if ("focus" in client) {
            client.postMessage({ type: "PUSH_NAVIGATE", url: targetUrl });
            return client.focus();
          }
        }
        // Si no hay pestaña abierta, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ── Cierre de notificación ────────────────────────────────────────────────────
self.addEventListener("notificationclose", () => {
  // Espacio para tracking de dismissals si se necesita en el futuro
});
