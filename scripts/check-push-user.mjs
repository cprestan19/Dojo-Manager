/**
 * check-push-user.mjs
 * Consulta (solo lectura) el estado de push de un usuario por correo:
 * rol, dojo, y sus suscripciones push activas/inactivas.
 *
 * Uso:
 *   node scripts/check-push-user.mjs correo@ejemplo.com
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const __dir = dirname(fileURLToPath(import.meta.url));

function readEnv() {
  const envPath = resolve(__dir, "../.env.local");
  const lines   = readFileSync(envPath, "utf-8").split("\n");
  const env     = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = val;
  }
  return env;
}

const env = readEnv();
const url = env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no encontrada en .env.local");

const pool    = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: true } });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });

const email = process.argv[2];
if (!email) throw new Error("Uso: node scripts/check-push-user.mjs correo@ejemplo.com");

async function main() {
  const user = await prisma.user.findFirst({
    where:  { email: email.toLowerCase().trim() },
    select: { id: true, name: true, role: true, dojoId: true, studentId: true },
  });

  if (!user) {
    console.log(`No se encontró ningún User con email ${email}`);
    return;
  }

  console.log("Usuario:", user);

  const where = user.role === "student" && user.studentId
    ? { studentId: user.studentId }
    : { userId: user.id };

  const subs = await prisma.pushSubscription.findMany({
    where,
    select: { id: true, active: true, deviceLabel: true, userAgent: true, createdAt: true, failCount: true, endpoint: true },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\nSuscripciones push (${JSON.stringify(where)}): ${subs.length}`);
  for (const s of subs) {
    console.log(`  - id=${s.id} activo=${s.active} failCount=${s.failCount} dispositivo="${s.deviceLabel ?? "(sin nombre)"}" ua="${(s.userAgent ?? "").slice(0,60)}" creado=${s.createdAt.toISOString()} endpoint=${s.endpoint.slice(0,50)}...`);
  }
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
