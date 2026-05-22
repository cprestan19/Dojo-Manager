// Lógica y tipos para la importación masiva de alumnos desde Excel
import { BELT_COLORS } from "@/lib/utils";

export const IMPORT_COLUMNS = [
  // ── Obligatorios ────────────────────────────────────────────────────
  { key: "fullName",            header: "Nombre Completo *",             required: true,  example: "García López, Pedro Alberto" },
  { key: "cedula",              header: "Cédula / Documento *",          required: true,  example: "8-123-4567" },
  // ── Datos personales ────────────────────────────────────────────────
  { key: "firstName",           header: "Primer Nombre",                 required: false, example: "Pedro" },
  { key: "lastName",            header: "Apellidos",                     required: false, example: "García López" },
  { key: "birthDate",           header: "Fecha Nacimiento (DD/MM/AAAA)", required: false, example: "15/03/2009" },
  { key: "gender",              header: "Género (M/F)",                  required: false, example: "M" },
  { key: "nationality",         header: "Nacionalidad",                  required: false, example: "Panameño" },
  { key: "bloodType",           header: "Tipo de Sangre",                required: false, example: "O+" },
  { key: "condition",           header: "Condición de Salud",            required: false, example: "Ninguna" },
  // ── Seguro ──────────────────────────────────────────────────────────
  { key: "hasPrivateInsurance", header: "Seguro Privado (SI/NO)",        required: false, example: "NO" },
  { key: "insuranceName",       header: "Nombre del Seguro",             required: false, example: "ASSA" },
  { key: "insuranceNumber",     header: "N° Póliza",                     required: false, example: "POL-12345" },
  // ── Karate ──────────────────────────────────────────────────────────
  { key: "beltColor",           header: "Color de Cinta",                required: false, example: "blanca" },
  { key: "fepakaId",            header: "N° FEPAKA",                     required: false, example: "FEP-2341" },
  { key: "ryoBukaiId",          header: "N° Ryo-Bukai",                  required: false, example: "RB-001" },
  // ── Contacto madre ──────────────────────────────────────────────────
  { key: "motherName",          header: "Nombre de la Madre",            required: false, example: "Ana María López" },
  { key: "motherPhone",         header: "Teléfono de la Madre",          required: false, example: "+507 6123-4567" },
  { key: "motherEmail",         header: "Email de la Madre",             required: false, example: "ana@email.com" },
  // ── Contacto padre ──────────────────────────────────────────────────
  { key: "fatherName",          header: "Nombre del Padre",              required: false, example: "Carlos García" },
  { key: "fatherPhone",         header: "Teléfono del Padre",            required: false, example: "+507 6987-6543" },
  { key: "fatherEmail",         header: "Email del Padre",               required: false, example: "carlos@email.com" },
  // ── Dirección ───────────────────────────────────────────────────────
  { key: "address",             header: "Dirección",                     required: false, example: "Ciudad de Panamá, San Francisco" },
  // ── Inscripción (opcional) ──────────────────────────────────────────
  { key: "monthlyAmount",       header: "Mensualidad ($)",               required: false, example: "60" },
  { key: "annualAmount",        header: "Monto Anual ($)",               required: false, example: "720" },
  { key: "inscriptionDate",     header: "Fecha Inscripción (DD/MM/AAAA)",required: false, example: "01/09/2024" },
] as const;

export type ImportColumnKey = typeof IMPORT_COLUMNS[number]["key"];

export const VALID_BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;
export const VALID_BELT_COLORS = BELT_COLORS.map((b: { value: string }) => b.value);

export type RowResult =
  | { status: "created"; row: number; fullName: string;   cedula: string; studentCode: number }
  | { status: "skipped"; row: number; fullName?: string;  cedula?: string; reason: string }
  | { status: "error";   row: number; fullName?: string;  cedula?: string; reason: string };

export interface ImportSummary {
  total:   number;
  created: number;
  skipped: number;
  errors:  number;
  rows:    RowResult[];
}

/**
 * Parsea fechas en múltiples formatos a Date (hora local medianoche).
 * Formatos aceptados:
 *   DD/MM/AAAA · DD-MM-AAAA · DD.MM.AAAA
 *   AAAA-MM-DD · AAAA/MM/DD           (ISO y variantes)
 *   DD/MM/AA   · DD-MM-AA             (año de 2 dígitos — 00-30→2000s, 31-99→1900s)
 * Retorna null si el valor es inválido o el año está fuera del rango 1900-hoy+1.
 */
export function parseDate(raw: string | null | undefined): Date | null {
  if (!raw?.toString().trim()) return null;
  const str = raw.toString().trim();
  const curYear = new Date().getFullYear();

  function build(y: number, m: number, d: number): Date | null {
    if (y < 1900 || y > curYear + 1) return null;
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return null;
    // Verificar que día/mes no se desbordaron (ej: 31/02)
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
  }

  // DD/MM/AAAA · DD-MM-AAAA · DD.MM.AAAA (4 dígitos de año)
  let m = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) return build(Number(m[3]), Number(m[2]), Number(m[1]));

  // AAAA-MM-DD · AAAA/MM/DD (ISO y variantes)
  m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));

  // DD/MM/AA · DD-MM-AA (2 dígitos de año)
  m = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (m) {
    const yr = Number(m[3]);
    return build(yr <= 30 ? 2000 + yr : 1900 + yr, Number(m[2]), Number(m[1]));
  }

  return null;
}

/** Convierte valor de celda Excel a string limpio. */
export function cellToString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

/** Normaliza género a "M" | "F" | null. */
export function normalizeGender(raw: string | null): string | null {
  if (!raw) return null;
  const u = raw.toUpperCase().trim();
  if (u === "M" || u === "MASCULINO" || u === "HOMBRE") return "M";
  if (u === "F" || u === "FEMENINO"  || u === "MUJER")  return "F";
  return null;
}

/** Normaliza SI/NO a boolean. */
export function normalizeBoolean(raw: string | null): boolean {
  if (!raw) return false;
  const u = raw.toUpperCase().trim();
  return u === "SI" || u === "SÍ" || u === "YES" || u === "1" || u === "TRUE";
}

/** Valida y normaliza color de cinta. Retorna null si no es válido (no falla la fila). */
export function normalizeBeltColor(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase().trim().replace(/\s+/g, "-");
  return VALID_BELT_COLORS.includes(normalized) ? normalized : null;
}

/** Convierte índice de columna (1-based) a letra Excel (A, B, ..., Z, AA, ...). */
export function columnLetter(col: number): string {
  let letter = "";
  let c = col;
  while (c > 0) {
    const mod = (c - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    c = Math.floor((c - 1) / 26);
  }
  return letter;
}
