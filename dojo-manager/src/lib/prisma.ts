import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

function createPrismaClient() {
  const isProduction  = process.env.NODE_ENV === "production";
  const isServerless  = !!process.env.VERCEL;

  const pool = new pg.Pool({
    connectionString:        process.env.DATABASE_URL,
    max:                     isServerless ? 1 : 10,
    ssl:                     isProduction ? { rejectUnauthorized: false } : false,
    idleTimeoutMillis:       30_000,
    connectionTimeoutMillis: 5_000,
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: isProduction ? ["error"] : ["error", "warn"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
