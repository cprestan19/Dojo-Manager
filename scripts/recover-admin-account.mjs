/**
 * recover-admin-account.mjs
 * Recuperación puntual: recrea la cuenta admin de dojoshoshin2368@gmail.com,
 * secuestrada por el bug de /api/students/[id]/access (ver auditoría 2026-07-09).
 * Genera contraseña temporal + mustChangePassword=true. Deja un registro en audit_logs.
 *
 * Uso: node scripts/recover-admin-account.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

const __dir = dirname(fileURLToPath(import.meta.url));
function readEnv() {
  const lines = readFileSync(resolve(__dir, "../.env.local"), "utf-8").split("\n");
  const env = {};
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = readEnv();
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: true } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function generatePassword() {
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ", lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789", special = "@#$!";
  const all = upper + lower + digits + special;
  const pick = set => set[randomInt(set.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(special),
    ...Array.from({ length: 8 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

const EMAIL  = "dojoshoshin2368@gmail.com";
const DOJO_ID = "cmr6twp40000304lhztxzzzev";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log("Ya existe un usuario con ese email, abortando:", existing);
    return;
  }

  const plainPassword = generatePassword();
  const hashed = await bcrypt.hash(plainPassword, 12);

  const created = await prisma.user.create({
    data: {
      email: EMAIL,
      password: hashed,
      name: "Dojoshoshin Karatedo",
      role: "admin",
      dojoId: DOJO_ID,
      active: true,
      mustChangePassword: true,
    },
    select: { id: true, email: true, role: true, dojoId: true, active: true },
  });

  await prisma.auditLog.create({
    data: {
      action: "USER_RECOVERED",
      module: "USERS",
      resourceType: "User",
      resourceId: created.id,
      userName: "Claude (recuperación asistida)",
      userEmail: "system-recovery",
      dojoId: DOJO_ID,
      statusCode: 201,
      details: JSON.stringify({
        reason: "Cuenta admin original secuestrada por bug de upsert en /api/students/[id]/access " +
                "cuando el correo del acudiente coincidió con el email del admin. Se recrea como cuenta nueva.",
        recreatedEmail: EMAIL,
      }),
    },
  });

  console.log("Usuario admin recreado:");
  console.log(created);
  console.log("\nContraseña temporal (compártela una sola vez, se pedirá cambio en el primer login):");
  console.log(plainPassword);
}

main()
  .catch(err => { console.error("ERROR:", err.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
