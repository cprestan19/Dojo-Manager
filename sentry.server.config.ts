import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 10% de las transacciones — suficiente para detectar regresiones de performance sin agotar la cuota.
  tracesSampleRate: 0.1,
  debug: false,
});
