/**
 * Database client — provider-agnostic PostgreSQL.
 *
 * No Neon / Supabase / Railway-specific APIs. Everything is driven by
 * the DATABASE_URL environment variable so switching providers means
 * changing one env var and nothing else.
 *
 * SSL strategy (inferred from the URL and environment, never hardcoded):
 *   • localhost / 127.0.0.1  → no SSL  (local dev)
 *   • URL contains sslmode=require → SSL with cert validation
 *   • Any other production host → SSL with cert validation
 *
 * Connection pool:
 *   DATABASE_POOL_MAX defaults to 1 for serverless (Vercel/Netlify) where
 *   each function invocation should hold at most one connection.
 *   Override with DATABASE_POOL_MAX=10 for a long-running server.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg }     from "@prisma/adapter-pg";
import pg               from "pg";
import { validateEnv }  from "@/lib/env";

import type { PoolConfig } from "pg";

function getSslConfig(url: string): PoolConfig["ssl"] {
  // Local development: no SSL
  if (url.includes("localhost") || url.includes("127.0.0.1")) return false;

  // Explicit sslmode=require or any non-local host in production → enforce SSL
  if (url.includes("sslmode=require") || process.env.NODE_ENV === "production") {
    // rejectUnauthorized: true validates the server certificate.
    // Managed providers (Neon, Supabase, Railway, Render…) all use valid certs.
    return { rejectUnauthorized: true };
  }

  return false;
}

function createPrismaClient(): PrismaClient {
  // Fail fast if any required variable is missing
  validateEnv();

  const url     = process.env.DATABASE_URL!;
  const poolMax = Number(process.env.DATABASE_POOL_MAX ?? "1");

  const pool = new pg.Pool({
    connectionString:        url,
    max:                     poolMax,
    ssl:                     getSslConfig(url),
    idleTimeoutMillis:       30_000,
    connectionTimeoutMillis: 10_000,
  });

  // Surface pool errors so they appear in logs rather than silently killing requests
  pool.on("error", (err: Error) => {
    console.error("[db] Unexpected pool error:", err.message);
  });

  // Neon's pgBouncer (pooler) does not allow search_path as a startup parameter,
  // so we set it at connection time instead.
  // This is a no-op for local PostgreSQL which already defaults to public.
  pool.on("connect", (client) => {
    client.query("SET search_path TO public").catch((err: Error) => {
      console.warn("[db] Could not set search_path:", err.message);
    });
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "production"
      ? ["error"]
      : ["error", "warn"],
  });
}

// Reuse a single instance in development (hot-reload safe via globalThis)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
