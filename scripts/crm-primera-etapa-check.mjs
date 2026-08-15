/**
 * Script de SOLO LECTURA — valida, sin enviar nada ni escribir nada,
 * qué dojos calificarían HOY para cada uno de los 5 mensajes de la
 * "Primera Etapa" del CRM (Activación y Riesgo Básico).
 *
 * No crea tablas, no modifica el schema, no llama a la API de WhatsApp.
 * Uso: node scripts/crm-primera-etapa-check.mjs
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DAY_MS = 86_400_000;
const daysSince = (date) => date ? Math.floor((Date.now() - new Date(date).getTime()) / DAY_MS) : null;

const dojos = await prisma.dojo.findMany({
  where: { active: true },
  select: {
    id: true, name: true, phone: true, email: true, createdAt: true,
    students: { select: { id: true } },
    users: { where: { role: "admin" }, select: { lastActiveAt: true } },
  },
  orderBy: { createdAt: "desc" },
});

const rows = dojos.map(d => {
  const studentCount = d.students.length;
  const daysCreated = daysSince(d.createdAt);
  const lastActive = d.users
    .map(u => u.lastActiveAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] ?? null;
  const daysInactive = daysSince(lastActive);

  return {
    dojo: d.name,
    tel: d.phone ?? "⚠️ sin teléfono",
    diasCreado: daysCreated,
    alumnos: studentCount,
    diasSinSesion: daysInactive,
    // Flags — usan ">=" porque hoy no hay historial de envíos (es el backlog completo)
    ayuda_sin_alumnos:   daysCreated >= 2 && studentCount === 0,
    seguimiento_activo:  daysCreated >= 3 && studentCount >= 1,
    ultimo_intento:      daysCreated >= 7 && studentCount === 0,
    reactivacion:        studentCount >= 1 && daysInactive !== null && daysInactive >= 10,
  };
});

console.log(`\nTotal dojos activos: ${rows.length}\n`);

for (const [flag, label] of [
  ["ayuda_sin_alumnos",  "Día 2 — sin alumnos, ¿necesita ayuda?"],
  ["seguimiento_activo", "Día 3 — ya tiene alumnos, seguimiento"],
  ["ultimo_intento",     "Día 7 — sigue sin alumnos, último intento"],
  ["reactivacion",       "10+ días sin sesión, con alumnos"],
]) {
  const matches = rows.filter(r => r[flag]);
  console.log(`\n── ${label} — ${matches.length} dojo(s) ──`);
  for (const r of matches) {
    console.log(`  ${r.dojo} | tel: ${r.tel} | creado hace ${r.diasCreado}d | alumnos: ${r.alumnos} | última sesión hace ${r.diasSinSesion ?? "—"}d`);
  }
}

console.log(`\n⚠️ Dojos sin teléfono registrado (no se les podría enviar WhatsApp): ${rows.filter(r => r.tel.includes("⚠️")).length}\n`);

await prisma.$disconnect();
