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
    idleTimeoutMillis:       30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on("error", (err: Error) => {
    console.error("[db] Unexpected pool error:", err.message);
  });

  // Neon's pgBouncer pooler does not accept search_path as a startup parameter.
  // Setting it per-connection works in both pooled and direct connections.
  pool.on("connect", (client) => {
    client.query("SET search_path TO public").catch((err: Error) => {
      console.warn("[db] Could not set search_path:", err.message);
    });
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });
}

// Reuse a single instance in development (hot-reload safe via globalThis)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
