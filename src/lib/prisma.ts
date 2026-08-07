/**
 * Database client — provider-agnostic PostgreSQL.
 *
 * No Neon / Supabase / Railway-specific APIs. Everything is driven by
 * the DATABASE_URL environment variable so switching providers means
 * changing one env var and nothing else.
 *
 * SSL strategy (inferred from the URL, never hardcoded):
 *   • localhost / 127.0.0.1  → no SSL  (local dev)
 *   • URL contains sslmode   → SSL with cert validation
 *   • Any other remote host  → SSL with cert validation in production
 *
 * Connection pool:
 *   DATABASE_POOL_MAX defaults to 1 for serverless (Vercel/Netlify).
 *   Override with DATABASE_POOL_MAX=10 for a long-running server.
 *
 * Build-phase safety:
 *   validateEnv() is skipped during `next build` (NEXT_PHASE check).
 *   Env vars are validated on the FIRST real runtime request, not at
 *   module import time — this prevents build failures when env vars
 *   are only available at runtime (standard Vercel behaviour).
 *
 * Retry on transient connection errors:
 *   Neon (y otros Postgres serverless) pueden cerrar una conexión del lado
 *   del servidor mientras el pool local todavía la considera viva — la
 *   siguiente query sobre esa conexión falla con "Connection terminated
 *   unexpectedly" aunque la base de datos esté sana. Se reintenta esa
 *   query (no otros errores) un par de veces con backoff corto — ver
 *   isTransientConnectionError() más abajo.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg }     from "@prisma/adapter-pg";
import pg               from "pg";
import { validateEnv }  from "@/lib/env";

import type { PoolConfig } from "pg";

/** True only during `next build` — env vars may not be set yet. */
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

function getSslConfig(url: string): PoolConfig["ssl"] {
  if (url.includes("localhost") || url.includes("127.0.0.1")) return false;
  if (url.includes("sslmode") || process.env.NODE_ENV === "production") {
    return { rejectUnauthorized: true };
  }
  return false;
}

// Mensajes de errores de conexión que SÍ es seguro reintentar — la conexión
// murió antes de (o mientras) se enviaba la query, así que no hay riesgo de
// duplicar un efecto ya aplicado. No incluye timeouts de query lenta ni
// errores de datos/constraints, que nunca se reintentan.
const TRANSIENT_CONNECTION_PATTERNS = [
  "connection terminated",
  "connection terminated unexpectedly",
  "connection terminated due to connection timeout",
  "econnreset",
  "econnrefused",
  "connection reset by peer",
  "server closed the connection unexpectedly",
  "the pool is draining",
];

function isTransientConnectionError(err: unknown): boolean {
  const message = String((err as { message?: unknown })?.message ?? "").toLowerCase();
  const causeMessage = String(
    (err as { cause?: { message?: unknown } })?.cause?.message ?? ""
  ).toLowerCase();
  return TRANSIENT_CONNECTION_PATTERNS.some(p => message.includes(p) || causeMessage.includes(p));
}

const RETRY_ATTEMPTS   = 2; // reintentos además del intento original
const RETRY_DELAY_MS   = 150;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function createPrismaClient(): PrismaClient {
  // Skip validation during build — env vars are only available at runtime on Vercel.
  // At runtime the first request will fail with a clear message if a var is missing.
  if (!IS_BUILD) {
    validateEnv();
  }

  const url     = process.env.DATABASE_URL ?? "";
  const poolMax = Number(process.env.DATABASE_POOL_MAX ?? "1");

  const pool = new pg.Pool({
    connectionString:        url,
    max:                     poolMax,
    ssl:                     url ? getSslConfig(url) : false,
    idleTimeoutMillis:       60_000,   // mantener conexiones calientes más tiempo
    connectionTimeoutMillis: 5_000,    // fallar rápido si no hay conexión disponible
    allowExitOnIdle:         false,    // no terminar el pool entre requests
  });

  pool.on("error", (err: Error) => {
    console.error("[db] Unexpected pool error:", err.message);
  });

  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

  return client.$extends({
    name: "retry-transient-connection-errors",
    query: {
      $allOperations: async ({ operation, model, args, query }) => {
        for (let attempt = 0; ; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            if (attempt >= RETRY_ATTEMPTS || !isTransientConnectionError(err)) throw err;
            console.warn(
              `[db] ${model ?? ""}.${operation} falló por conexión transitoria — reintento ${attempt + 1}/${RETRY_ATTEMPTS}`,
            );
            await sleep(RETRY_DELAY_MS * (attempt + 1));
          }
        }
      },
    },
  }) as unknown as PrismaClient;
}

// Reuse a single instance in development (hot-reload safe via globalThis)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
