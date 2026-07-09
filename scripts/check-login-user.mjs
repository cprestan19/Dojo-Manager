/**
 * check-login-user.mjs
 * Diagnóstico (solo lectura) de un problema de login: estado de la cuenta
 * + timeline completo de auditoría (AUTH y USERS) para un dojo/usuario.
 *
 * Uso:
 *   node scripts/check-login-user.mjs correo@ejemplo.com
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
if (!email) throw new Error("Uso: node scripts/check-login-user.mjs correo@ejemplo.com");

async function main() {
  const norm = email.toLowerCase().trim();

  console.log("── Usuario actual con ese email ──────────────");
  const user = await prisma.user.findUnique({
    where:  { email: norm },
    select: {
      id: true, name: true, email: true, role: true, active: true,
      mustChangePassword: true, createdAt: true, updatedAt: true,
      dojoId: true, dojo: { select: { name: true, slug: true, active: true } },
    },
  });
  console.log(user ?? `No existe ningún User con email "${norm}"`);

  console.log("\n── Todos los eventos de auditoría con userEmail = ese correo ──");
  const byEmail = await prisma.auditLog.findMany({
    where:  { userEmail: norm },
    orderBy: { createdAt: "asc" },
    select: { action: true, details: true, ip: true, createdAt: true, userId: true, dojoId: true, resourceType: true, resourceId: true },
  });
  for (const l of byEmail) {
    console.log(`  ${l.createdAt.toISOString()}  ${l.action}  userId=${l.userId ?? "-"}  dojoId=${l.dojoId ?? "-"}  ip=${l.ip ?? "-"}  ${l.details ?? ""}`);
  }
  if (byEmail.length === 0) console.log("  (ninguno)");

  // userId visto en el evento LOGIN_SUCCESS más antiguo, si existe
  const loginEvt = byEmail.find(l => l.action === "LOGIN_SUCCESS");
  const oldUserId = loginEvt?.userId ?? null;
  const dojoId = loginEvt?.dojoId ?? byEmail.find(l => l.dojoId)?.dojoId ?? null;

  if (oldUserId) {
    console.log(`\n── Eventos de auditoría con userId = ${oldUserId} (id visto en el login exitoso) ──`);
    const byId = await prisma.auditLog.findMany({
      where:  { userId: oldUserId },
      orderBy: { createdAt: "asc" },
      select: { action: true, userEmail: true, details: true, ip: true, createdAt: true, resourceType: true, resourceId: true },
    });
    for (const l of byId) {
      console.log(`  ${l.createdAt.toISOString()}  ${l.action}  email=${l.userEmail ?? "-"}  resource=${l.resourceType ?? "-"}:${l.resourceId ?? "-"}  ${l.details ?? ""}`);
    }
  }

  if (dojoId) {
    console.log(`\n── Eventos USERS/AUTH del dojo ${dojoId} entre hoy 10:00 y 22:00 ──`);
    const start = new Date(); start.setHours(10, 0, 0, 0);
    const end   = new Date(); end.setHours(23, 59, 59, 999);
    const dojoEvents = await prisma.auditLog.findMany({
      where: {
        dojoId,
        createdAt: { gte: start, lte: end },
        OR: [{ module: "USERS" }, { module: "AUTH" }, { resourceType: "User" }],
      },
      orderBy: { createdAt: "asc" },
      select: { action: true, userEmail: true, userName: true, details: true, ip: true, createdAt: true, resourceType: true, resourceId: true, statusCode: true },
    });
    for (const l of dojoEvents) {
      console.log(`  ${l.createdAt.toISOString()}  ${l.action}  actor=${l.userEmail ?? l.userName ?? "-"}  resource=${l.resourceType ?? "-"}:${l.resourceId ?? "-"}  status=${l.statusCode ?? "-"}  ${l.details ?? ""}`);
    }
    if (dojoEvents.length === 0) console.log("  (ninguno)");
  }

  console.log("\n── Usuario actual soporte@dojo-shoshin.com (comparación) ──");
  const other = await prisma.user.findUnique({
    where:  { email: "soporte@dojo-shoshin.com" },
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, updatedAt: true, dojoId: true },
  });
  console.log(other);
  if (other) {
    console.log(`\n── Eventos de auditoría con userId = ${other.id} (soporte@dojo-shoshin.com) ──`);
    const byOtherId = await prisma.auditLog.findMany({
      where:  { userId: other.id },
      orderBy: { createdAt: "asc" },
      select: { action: true, userEmail: true, details: true, ip: true, createdAt: true, resourceType: true, resourceId: true },
    });
    for (const l of byOtherId) {
      console.log(`  ${l.createdAt.toISOString()}  ${l.action}  email=${l.userEmail ?? "-"}  resource=${l.resourceType ?? "-"}:${l.resourceId ?? "-"}  ${l.details ?? ""}`);
    }
  }
}

main()
  .catch(err => { console.error("ERROR:", err.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
