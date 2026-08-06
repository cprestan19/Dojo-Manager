/**
 * seed-demo-students.mjs
 * Script ADITIVO (nunca borra nada) para poblar un dojo de demo con alumnos,
 * cintas, horarios y asistencia de un mes — pensado para dejar Dojo Test listo
 * antes de presentárselo a clientes nuevos. Reutilizable: cada corrida agrega
 * otro lote nuevo encima de lo que ya exista.
 *
 * Uso:
 *   node scripts/seed-demo-students.mjs [--dojo=dojo-test] [--count=20] [--month=2026-07]
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
  const lines = readFileSync(envPath, "utf-8").split("\n");
  const env = {};
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

function parseArgs() {
  const args = { dojo: "dojo-test", count: 20, month: null };
  for (const arg of process.argv.slice(2)) {
    const [key, val] = arg.replace(/^--/, "").split("=");
    if (key === "dojo") args.dojo = val;
    if (key === "count") args.count = parseInt(val, 10);
    if (key === "month") args.month = val; // "YYYY-MM"
  }
  return args;
}

const env = readEnv();
const url = env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no encontrada en .env.local");

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: true } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Panamá es UTC-5 fijo (sin horario de verano) ──────────────────────────
const PANAMA_UTC_OFFSET_HOURS = 5;

// ── Datos de referencia ────────────────────────────────────────────────────
const FIRST_NAMES_M = [
  "Carlos", "José", "Luis", "Miguel", "Diego", "Andrés", "Fernando", "Ricardo",
  "Eduardo", "Gabriel", "Sebastián", "Rodrigo", "Iván", "Julio", "Manuel",
  "Roberto", "Adrián", "Emilio", "Nicolás", "Alejandro",
];
const FIRST_NAMES_F = [
  "María", "Ana", "Sofía", "Valentina", "Camila", "Isabella", "Gabriela",
  "Daniela", "Fernanda", "Lucía", "Paola", "Carolina", "Andrea", "Mariana",
  "Victoria", "Ximena", "Renata", "Alejandra", "Natalia", "Regina",
];
const LAST_NAMES = [
  "González", "Rodríguez", "Pérez", "Sánchez", "Martínez", "Fernández",
  "López", "Díaz", "Torres", "Vásquez", "Castillo", "Herrera", "Morales",
  "Jiménez", "Reyes", "Gutiérrez", "Ortega", "Ramos", "Vargas", "Cedeño",
  "Quintero", "Guerra", "Núñez", "Aguilar",
];
const NATIONALITY_VARIANTS = ["Panamá", "Panamá", "Panamá", "Panamá", "Colombia", "Venezuela"];

const AGE_BANDS = [
  { label: "infantil (6-9)", minAge: 6, maxAge: 9, belts: ["blanca", "blanca-celeste", "blanco-amarillo"] },
  { label: "niños (10-13)", minAge: 10, maxAge: 13, belts: ["blanco-amarillo", "amarilla", "naranja", "verde"] },
  { label: "juvenil (14-17)", minAge: 14, maxAge: 17, belts: ["verde", "azul", "morada", "roja"] },
  { label: "adultos (18-45)", minAge: 18, maxAge: 45, belts: ["roja", "café", "café-1-raya", "café-2-rayas", "café-3-rayas", "negra", "negra-1-dan", "negra-2-dan", "negra-3-dan"] },
];

const SCHEDULE_DEFS = [
  { name: "Baby Karate", days: ["lunes", "miercoles"], startTime: "16:00", endTime: "17:00", description: "Niños de 6 a 9 años - iniciación" },
  { name: "Novatos", days: ["lunes", "miercoles", "viernes"], startTime: "17:00", endTime: "18:00", description: "Blanco amarillo a naranja" },
  { name: "Juvenil Intermedio", days: ["martes", "jueves"], startTime: "17:00", endTime: "18:00", description: "Verde a morada, 10 a 17 años" },
  { name: "Avanzados Juvenil", days: ["martes", "jueves"], startTime: "18:00", endTime: "19:00", description: "Roja y café, 12 a 17 años" },
  { name: "Adultos", days: ["lunes", "miercoles", "viernes"], startTime: "19:00", endTime: "20:30", description: "18 años en adelante, todas las cintas" },
];

const DAY_KEYS_BY_WEEKDAY = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

function scheduleNameFor(ageBandIndex, belt) {
  if (ageBandIndex === 0) return "Baby Karate";
  const JUVENIL_MID_BELTS = new Set(["verde", "azul", "morada"]);
  const JUVENIL_ADV_BELTS = new Set(["roja", "café", "café-1-raya", "café-2-rayas", "café-3-rayas"]);
  if (ageBandIndex === 3) return "Adultos";
  if (JUVENIL_ADV_BELTS.has(belt)) return "Avanzados Juvenil";
  if (JUVENIL_MID_BELTS.has(belt)) return "Juvenil Intermedio";
  return "Novatos";
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr, i) {
  return arr[i % arr.length];
}

async function main() {
  const { dojo: slug, count, month } = parseArgs();

  const dojo = await prisma.dojo.findUnique({ where: { slug } });
  if (!dojo) throw new Error(`No existe ningún dojo con slug "${slug}". Abortando (no se crea un dojo nuevo).`);

  console.log(`── Poblando dojo "${dojo.name}" (${dojo.id}) con ${count} alumnos nuevos ──`);

  // Mes objetivo para la asistencia (default: julio del año actual del sistema)
  const now = new Date();
  let targetYear = now.getUTCFullYear();
  let targetMonth = 7; // julio
  if (month) {
    const [y, m] = month.split("-").map(Number);
    targetYear = y;
    targetMonth = m;
  } else if (now.getUTCMonth() + 1 === 7) {
    // si estamos parados en julio, usamos el mes pasado como mes "cerrado"
    targetMonth = 6;
  }
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();

  // ── 1. Horarios: reusar los que ya existan, crear los que falten ─────────
  const existingSchedules = await prisma.schedule.findMany({ where: { dojoId: dojo.id } });
  const scheduleByName = new Map(existingSchedules.map(s => [s.name, s]));

  for (const def of SCHEDULE_DEFS) {
    if (scheduleByName.has(def.name)) continue;
    const created = await prisma.schedule.create({
      data: {
        dojoId: dojo.id,
        name: def.name,
        days: JSON.stringify(def.days),
        startTime: def.startTime,
        endTime: def.endTime,
        description: def.description,
        active: true,
        availableForTrial: false,
      },
    });
    scheduleByName.set(def.name, created);
    console.log(`  + Horario creado: ${def.name}`);
  }

  // ── 2. studentCode inicial (correlativo global, igual que la API) ────────
  const maxCodeResult = await prisma.student.aggregate({ _max: { studentCode: true } });
  let nextStudentCode = (maxCodeResult._max.studentCode ?? 999) + 1;

  // ── 3. Distribución de alumnos por banda de edad ──────────────────────────
  const base = Math.floor(count / AGE_BANDS.length);
  let remainder = count - base * AGE_BANDS.length;
  const bandCounts = AGE_BANDS.map(() => base);
  for (let i = 0; i < remainder; i++) bandCounts[AGE_BANDS.length - 1 - i] += 1;

  const summary = { belts: {}, schedules: {}, students: 0, attendances: 0 };

  let globalIndex = 0;
  for (let bandIdx = 0; bandIdx < AGE_BANDS.length; bandIdx++) {
    const band = AGE_BANDS[bandIdx];
    const nInBand = bandCounts[bandIdx];

    for (let i = 0; i < nInBand; i++, globalIndex++) {
      const isMale = globalIndex % 2 === 0;
      const firstName = isMale ? pick(FIRST_NAMES_M, globalIndex) : pick(FIRST_NAMES_F, globalIndex);
      const lastName = pick(LAST_NAMES, globalIndex + 5);
      const fullName = `${firstName} ${lastName}`;
      const gender = isMale ? "M" : "F";
      const nationality = pick(NATIONALITY_VARIANTS, globalIndex);

      const age = randInt(band.minAge, band.maxAge);
      const birthYear = targetYear - age;
      const birthDate = new Date(Date.UTC(birthYear, randInt(0, 11), randInt(1, 28), 12, 0, 0));

      const belt = pick(band.belts, i);
      const scheduleName = scheduleNameFor(bandIdx, belt);
      const schedule = scheduleByName.get(scheduleName);

      const isMinor = age < 18;
      const guardianFirst = isMale ? pick(FIRST_NAMES_F, globalIndex + 3) : pick(FIRST_NAMES_M, globalIndex + 3);
      const guardianLast = pick(LAST_NAMES, globalIndex + 11);
      const guardianPhone = `+507 6${randInt(100, 999)}-${randInt(1000, 9999)}`;

      const student = await prisma.student.create({
        data: {
          dojoId: dojo.id,
          studentCode: nextStudentCode++,
          cardToken: randomUUID(),
          fullName,
          firstName,
          lastName,
          birthDate,
          gender,
          nationality,
          active: true,
          ...(isMinor ? {
            motherName: `${guardianFirst} ${guardianLast}`,
            motherPhone: guardianPhone,
            primaryGuardian: "mother",
          } : {}),
        },
      });

      // Cinta actual — registro de historial 1 a 24 meses atrás
      const monthsAgo = randInt(1, 24);
      const changeDate = new Date(Date.UTC(targetYear, targetMonth - 1 - monthsAgo, randInt(1, 28)));
      await prisma.beltHistory.create({
        data: {
          studentId: student.id,
          beltColor: belt,
          changeDate,
          isRanking: false,
        },
      });

      // Horario asignado
      if (schedule) {
        await prisma.studentSchedule.create({
          data: { studentId: student.id, scheduleId: schedule.id },
        });
      }

      // ── Asistencia del mes objetivo ────────────────────────────────────
      let lastAttendance = null;
      if (schedule) {
        const scheduleDays = JSON.parse(schedule.days);
        const [startHour, startMin] = schedule.startTime.split(":").map(Number);

        let sessionsSeen = 0;
        for (let day = 1; day <= daysInTargetMonth; day++) {
          const weekday = new Date(Date.UTC(targetYear, targetMonth - 1, day)).getUTCDay();
          const dayKey = DAY_KEYS_BY_WEEKDAY[weekday];
          if (!scheduleDays.includes(dayKey)) continue;

          sessionsSeen++;
          // Garantizamos asistencia en las primeras 2 sesiones para que nadie
          // quede sin historial; el resto tiene 75-85% de probabilidad.
          const attends = sessionsSeen <= 2 || Math.random() < 0.8;
          if (!attends) continue;

          const jitterMin = randInt(0, 12);
          const markedAt = new Date(Date.UTC(
            targetYear, targetMonth - 1, day,
            startHour + PANAMA_UTC_OFFSET_HOURS, startMin + jitterMin, randInt(0, 59),
          ));
          await prisma.attendance.create({
            data: { studentId: student.id, scheduleId: schedule.id, type: "entry", markedAt },
          });
          lastAttendance = markedAt;
          summary.attendances++;
        }
      }

      // ── Recalcular attendanceStatus según cuántos días pasaron ──────────
      let attendanceStatus = "RIESGO";
      if (lastAttendance) {
        const diffDays = Math.floor((now.getTime() - lastAttendance.getTime()) / 86400000);
        attendanceStatus = diffDays <= 3 ? "ACTIVO" : diffDays < 14 ? "ALERTA" : "RIESGO";
      }
      await prisma.student.update({ where: { id: student.id }, data: { attendanceStatus } });

      summary.students++;
      summary.belts[belt] = (summary.belts[belt] ?? 0) + 1;
      summary.schedules[scheduleName] = (summary.schedules[scheduleName] ?? 0) + 1;
    }
  }

  console.log(`\n── Listo ──`);
  console.log(`Alumnos creados: ${summary.students}`);
  console.log(`Asistencias creadas (${targetYear}-${String(targetMonth).padStart(2, "0")}): ${summary.attendances}`);
  console.log(`Distribución de cintas:`, summary.belts);
  console.log(`Distribución de horarios:`, summary.schedules);
}

main()
  .catch(err => { console.error("ERROR:", err.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
