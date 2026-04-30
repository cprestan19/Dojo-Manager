/**
 * Shared Zod schemas for API route validation.
 * Import the relevant schema in each route and call .safeParse(body).
 */
import { z } from "zod";
import { NextResponse } from "next/server";

// ── Primitives ───────────────────────────────────────────────
const email   = z.string().email("Email inválido").max(254);
const cuid    = z.string().cuid("ID inválido");
const nonEmpty = (max = 255) => z.string().trim().min(1, "Campo requerido").max(max);

// ── Students ─────────────────────────────────────────────────
export const CreateStudentSchema = z.object({
  fullName:            nonEmpty(200),
  firstName:           nonEmpty(100),
  lastName:            nonEmpty(100),
  birthDate:           z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).refine(
    v => { const d = new Date(v); return !isNaN(d.getTime()) && d < new Date(); },
    "Fecha de nacimiento inválida o futura",
  ),
  gender:              z.enum(["M", "F"]),
  nationality:         nonEmpty(100),
  cedula:              z.string().max(30).optional().nullable(),
  fepakaId:            z.string().max(15).optional().nullable(),
  ryoBukaiId:          z.string().max(15).optional().nullable(),
  photo:               z.string().url().optional().nullable(),
  condition:           z.string().max(500).optional().nullable(),
  bloodType:           z.enum(["O+","O-","A+","A-","B+","B-","AB+","AB-",""]).optional().nullable(),
  hasPrivateInsurance: z.boolean().optional().default(false),
  insuranceName:       z.string().max(200).optional().nullable(),
  insuranceNumber:     z.string().max(25).optional().nullable(),
  motherName:          z.string().max(200).optional().nullable(),
  motherPhone:         z.string().max(30).optional().nullable(),
  motherEmail:         email.optional().nullable().or(z.literal("")),
  fatherName:          z.string().max(200).optional().nullable(),
  fatherPhone:         z.string().max(30).optional().nullable(),
  fatherEmail:         email.optional().nullable().or(z.literal("")),
  address:             z.string().max(500).optional().nullable(),
  inscription: z.object({
    inscriptionDate:   z.string(),
    annualPaymentDate: z.string().optional().nullable(),
    annualAmount:      z.coerce.number().min(0).max(99_999),
    monthlyAmount:     z.coerce.number().min(0).max(99_999),
    discountAmount:    z.coerce.number().min(0).max(99_999).default(0),
    discountNote:      z.string().max(500).optional().nullable(),
  }).optional(),
});

// ── Payments ─────────────────────────────────────────────────
export const CreatePaymentSchema = z.object({
  studentId: cuid,
  type:      z.enum(["monthly", "annual"]),
  amount:    z.number().positive("El monto debe ser positivo").max(99_999, "Monto fuera de rango"),
  dueDate:   z.string().refine(v => !isNaN(new Date(v).getTime()), "Fecha de vencimiento inválida"),
  paidDate:  z.string().optional().nullable(),
  status:    z.enum(["pending", "paid", "late"]).default("pending"),
  note:      z.string().max(500).optional().nullable(),
});

export const UpdatePaymentSchema = z.object({
  id:       cuid,
  status:   z.enum(["pending", "paid", "late"]).optional(),
  paidDate: z.string().optional().nullable(),
  amount:   z.number().positive().max(99_999).optional(),
  note:     z.string().max(500).optional().nullable(),
});

// ── Users ────────────────────────────────────────────────────
const PasswordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(128)
  .regex(/[A-Z]/,   "Debe incluir al menos una mayúscula")
  .regex(/[0-9]/,   "Debe incluir al menos un número");

export const CreateUserSchema = z.object({
  name:     nonEmpty(200),
  email:    email,
  password: PasswordSchema,
  role:     z.string().min(1).max(50).default("user"),
  dojoId:   z.string().cuid().optional().nullable(),
  photo:    z.string().url().optional().nullable(),
});

export const UpdateUserSchema = z.object({
  name:               nonEmpty(200).optional(),
  email:              email.optional(),
  password:           PasswordSchema.optional(),
  role:               z.string().min(1).max(50).optional(),
  active:             z.boolean().optional(),
  photo:              z.string().url().optional().nullable(),
  mustChangePassword: z.boolean().optional(),
});

// ── Attendance (public scanner endpoint) ─────────────────────
export const CreateAttendanceSchema = z.object({
  studentId:  z.union([cuid, z.string().regex(/^\d+$/, "studentCode debe ser numérico")]),
  type:       z.enum(["entry", "exit"]),
  scheduleId: cuid.optional().nullable(),
  note:       z.string().max(500).optional().nullable(),
});

// ── Belt Videos ──────────────────────────────────────────────
export const CreateBeltVideoSchema = z.object({
  beltColor:   z.string().min(1).max(50),
  title:       nonEmpty(200),
  description: z.string().max(1000).optional().nullable(),
  videoUrl:    z.string().url("URL de video inválida"),
  publicId:    nonEmpty(200),
  order:       z.number().int().min(0).default(0),
  active:      z.boolean().default(true),
});

// ── Helper: return typed validation error ────────────────────
export function validationError(error: z.ZodError) {
  const messages = error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; ");
  return NextResponse.json({ error: messages }, { status: 400 });
}
