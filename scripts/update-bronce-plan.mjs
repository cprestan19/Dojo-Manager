/**
 * update-bronce-plan.mjs
 * Actualiza el Plan Bronce existente: límite de 15 → 20 alumnos activos,
 * y refresca su descripción/features para reflejar el nuevo límite.
 *
 * Uso:
 *   node scripts/update-bronce-plan.mjs
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

async function main() {
  const existing = await prisma.plan.findFirst({ where: { name: "Bronce" } });
  if (!existing) throw new Error("No se encontró el Plan Bronce");

  const plan = await prisma.plan.update({
    where: { id: existing.id },
    data: {
      maxStudents: 20,
      description: "Plan gratuito para dojos pequeños — hasta 20 alumnos",
      features: JSON.stringify([
        "Hasta 20 alumnos activos",
        "Control de asistencia con QR",
        "Gestión de pagos y mensualidades",
        "Recordatorios automáticos por correo",
        "Portal del alumno (historial, cintas, videos)",
        "Historial de cintas y katas",
      ]),
    },
  });
  console.log(`Plan Bronce actualizado (maxStudents=${plan.maxStudents})`);

  // Dojos en Plan Bronce que quedaron en READ_ONLY por el vencimiento del
  // período de prueba (lógica anterior) — el plan gratuito nunca debe
  // bloquear el dojo, solo limitar la cantidad de alumnos.
  const fixed = await prisma.subscription.updateMany({
    where: { planId: plan.id, status: "READ_ONLY" },
    data:  { status: "ACTIVE" },
  });
  console.log(`Suscripciones Bronce reactivadas (READ_ONLY → ACTIVE): ${fixed.count}`);
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
