/**
 * find-duplicate-videos.mjs
 * Detecta videos duplicados en belt_videos (solo lectura, no modifica nada):
 *  - Mismo publicId de Cloudinary usado en más de un registro (kata o tachi kata)
 *  - Mismo título + cinta dentro del mismo dojo (posible subida repetida)
 *
 * Uso:
 *   node scripts/find-duplicate-videos.mjs
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

function reportPublicIdDuplicates(videos) {
  const byPublicId = new Map();
  for (const v of videos) {
    for (const [field, id] of [["kata", v.publicId], ["tachiKata", v.tachiKataPublicId]]) {
      if (!id) continue;
      if (!byPublicId.has(id)) byPublicId.set(id, []);
      byPublicId.get(id).push({ ...v, field });
    }
  }

  const dupes = [...byPublicId.entries()].filter(([, rows]) => rows.length > 1);
  if (dupes.length === 0) {
    console.log("✔ No hay publicId de Cloudinary repetidos entre registros.");
    return;
  }

  console.log(`\n⚠ ${dupes.length} publicId de Cloudinary usados en más de un registro:\n`);
  for (const [publicId, rows] of dupes) {
    console.log(`  publicId: ${publicId}`);
    for (const r of rows) {
      console.log(`    - [${r.field}] "${r.title}" · cinta ${r.beltColor} · dojo ${r.dojoId} · id=${r.id} · activo=${r.active}`);
    }
    console.log();
  }
}

function reportTitleDuplicates(videos) {
  const byKey = new Map();
  for (const v of videos) {
    const key = `${v.dojoId}::${v.beltColor}::${v.title.trim().toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(v);
  }

  const dupes = [...byKey.entries()].filter(([, rows]) => rows.length > 1);
  if (dupes.length === 0) {
    console.log("✔ No hay título+cinta repetidos dentro del mismo dojo.");
    return;
  }

  console.log(`\n⚠ ${dupes.length} combinaciones de título+cinta repetidas (mismo dojo):\n`);
  for (const [key, rows] of dupes) {
    const [, belt, title] = key.split("::");
    console.log(`  "${title}" · cinta ${belt} (dojo ${rows[0].dojoId})`);
    for (const r of rows) {
      console.log(`    - id=${r.id} · activo=${r.active} · creado=${r.createdAt.toISOString().slice(0, 10)} · videoUrl=${r.videoUrl ?? "(sin video kata)"}`);
    }
    console.log();
  }
}

async function main() {
  const videos = await prisma.beltVideo.findMany({
    orderBy: [{ dojoId: "asc" }, { beltColor: "asc" }, { title: "asc" }],
  });

  console.log(`Total de registros en belt_videos: ${videos.length}\n`);
  console.log("── Duplicados por publicId de Cloudinary ──────────────────────");
  reportPublicIdDuplicates(videos);
  console.log("── Duplicados por título + cinta ───────────────────────────────");
  reportTitleDuplicates(videos);
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
