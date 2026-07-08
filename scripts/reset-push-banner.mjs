/**
 * reset-push-banner.mjs
 * Desactiva (active=false, sin borrar) las suscripciones push de un usuario
 * para que el banner "Activa las notificaciones" vuelva a mostrarse en el
 * portal. Reversible: al tocar "Activar notificaciones" de nuevo, el
 * navegador ya tiene el permiso concedido y solo re-activa la fila.
 *
 * Uso:
 *   node scripts/reset-push-banner.mjs correo@ejemplo.com
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
if (!email) throw new Error("Uso: node scripts/reset-push-banner.mjs correo@ejemplo.com");

async function main() {
  const user = await prisma.user.findFirst({
    where:  { email: email.toLowerCase().trim() },
    select: { id: true, name: true, role: true, studentId: true },
  });
  if (!user) throw new Error(`No se encontró User con email ${email}`);

  const where = user.role === "student" && user.studentId
    ? { studentId: user.studentId }
    : { userId: user.id };

  const result = await prisma.pushSubscription.updateMany({
    where: { ...where, active: true },
    data:  { active: false },
  });

  console.log(`Usuario: ${user.name} (${user.role})`);
  console.log(`Suscripciones desactivadas: ${result.count}`);
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
