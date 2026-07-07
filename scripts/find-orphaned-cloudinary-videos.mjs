/**
 * find-orphaned-cloudinary-videos.mjs
 * Compara los videos que existen realmente en Cloudinary (carpetas
 * dojo-manager/{dojoId}/belt-videos) contra los publicId guardados en
 * belt_videos. Solo lectura — no borra nada en Cloudinary ni en la BD.
 *
 * Uso:
 *   node scripts/find-orphaned-cloudinary-videos.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { v2 as cloudinary } from "cloudinary";

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

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key:    env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure:     true,
});

const pool    = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: true } });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });

async function listAllVideoResources() {
  const resources = [];
  let nextCursor;
  do {
    const res = await cloudinary.api.resources({
      resource_type: "video",
      type:          "upload",
      prefix:        "dojo-manager/",
      max_results:   500,
      next_cursor:   nextCursor,
    });
    resources.push(...res.resources);
    nextCursor = res.next_cursor;
  } while (nextCursor);
  return resources;
}

function fmtBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
  const [videos, cloudinaryResources] = await Promise.all([
    prisma.beltVideo.findMany(),
    listAllVideoResources(),
  ]);

  const referenced = new Set();
  for (const v of videos) {
    if (v.publicId)          referenced.add(v.publicId);
    if (v.tachiKataPublicId) referenced.add(v.tachiKataPublicId);
  }

  console.log(`Videos en Cloudinary (carpetas dojo-manager/*/belt-videos): ${cloudinaryResources.length}`);
  console.log(`publicId referenciados en belt_videos: ${referenced.size}\n`);

  const orphaned = cloudinaryResources.filter(r => !referenced.has(r.public_id));

  if (orphaned.length === 0) {
    console.log("✔ No hay videos huérfanos — todo lo que existe en Cloudinary está referenciado en la base de datos.");
  } else {
    let totalBytes = 0;
    console.log(`⚠ ${orphaned.length} video(s) en Cloudinary sin ningún registro en belt_videos:\n`);
    for (const r of orphaned) {
      totalBytes += r.bytes ?? 0;
      console.log(`  - ${r.public_id}`);
      console.log(`      tamaño: ${fmtBytes(r.bytes ?? 0)} · creado: ${r.created_at} · url: ${r.secure_url}`);
    }
    console.log(`\nEspacio total ocupado por huérfanos: ${fmtBytes(totalBytes)}`);
  }
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
