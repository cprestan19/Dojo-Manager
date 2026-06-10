/**
 * backfill-card-tokens.mjs
 * Asigna un cardToken (UUID) a cada alumno existente que no tenga uno.
 * Necesario tras agregar Student.cardToken — el carnet público (/id/[code])
 * ahora se busca por este token impredecible en vez de studentCode secuencial.
 *
 * Uso:
 *   node scripts/backfill-card-tokens.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
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

async function main() {
  const students = await prisma.student.findMany({
    where: { cardToken: null },
    select: { id: true },
  });

  console.log(`Alumnos sin cardToken: ${students.length}`);

  for (const s of students) {
    await prisma.student.update({
      where: { id: s.id },
      data:  { cardToken: randomUUID() },
    });
  }

  console.log("Listo.");
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
