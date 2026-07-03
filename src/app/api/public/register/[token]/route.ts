import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";
import { sendRegistrationConfirmation } from "@/lib/email";
import { validateBase64Image } from "@/lib/file-validation";
import { notifyAdmin, buildPendingStudentEmail } from "@/lib/admin-notifications";

const ERR_LINK_UNAVAILABLE = "Este enlace de inscripción ya no está disponible. Contacta al dojo para obtener un nuevo enlace.";
const ERR_INVALID_DATA     = "Los datos enviados son inválidos. Revisa el formulario e intenta de nuevo.";
const ERR_SAVE_FAILED      = "Ocurrió un error al guardar tu solicitud. Por favor intenta de nuevo en unos minutos o contacta al dojo.";

const LOWER_PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "e", "van", "von", "o"]);
function toTitleCase(str: string): string {
  if (!str.trim()) return str;
  return str.trim().replace(/\s+/g, " ").split(" ").map((word, i) => {
    if (!word) return word;
    const lower = word.toLowerCase();
    if (i > 0 && LOWER_PARTICLES.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(" ");
}

const RegisterSchema = z.object({
  fullName:    z.string().min(2).max(200),
  firstName:   z.string().min(1).max(100).optional(),
  lastName:    z.string().min(1).max(100).optional(),
  birthDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  gender:      z.enum(["M", "F"]),
  nationality: z.string().min(2).max(100),
  cedula:      z.string().min(1, "La cédula es obligatoria").max(30),
  fepakaId:    z.string().max(15).optional().nullable(),
  ryoBukaiId:  z.string().max(15).optional().nullable(),

  bloodType:           z.enum(["O+","O-","A+","A-","B+","B-","AB+","AB-"]).optional().nullable(),
  condition:           z.string().max(500).optional().nullable(),
  hasPrivateInsurance: z.boolean().optional().default(false),
  insuranceName:       z.string().max(200).optional().nullable(),
  insuranceNumber:     z.string().max(25).optional().nullable(),

  motherName:  z.string().max(200).optional().nullable(),
  motherPhone: z.string().max(30).optional().nullable(),
  motherEmail: z.string().email().optional().nullable().or(z.literal("")),
  fatherName:  z.string().max(200).optional().nullable(),
  fatherPhone: z.string().max(30).optional().nullable(),
  fatherEmail: z.string().email().optional().nullable().or(z.literal("")),
  address:          z.string().max(500).optional().nullable(),
  photo:            z.string().max(6_800_000).optional().nullable(), // ~5 MB como base64
  hasSiblingInDojo: z.boolean().optional().default(false),
  primaryGuardian:  z.enum(["mother", "father"]).optional().nullable(),
  // Campo trampa para detección de bots — debe llegar vacío. No exponer en errores.
  honeypot: z.string().optional().default(""),
  // Versión de los términos que aceptó (null si no hay términos o es el sistema legado)
  acceptedTermsVersion: z.number().int().positive().optional().nullable(),
});

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ip = getIp(req);

  const link = await prisma.registrationLink.findUnique({
    where:  { token },
    select: {
      id: true, dojoId: true, isActive: true, activatesAt: true, expiresAt: true, maxUses: true, useCount: true,
      dojo: { select: { name: true, email: true, phone: true, slogan: true, logo: true, ownerName: true } },
    },
  });

  // Sin rate limit por IP — el link controla el acceso mediante expiración, maxUses e isActive.

  const now = new Date();
  const isValid =
    link &&
    link.isActive &&
    (!link.activatesAt || link.activatesAt <= now) &&
    (!link.expiresAt   || link.expiresAt   >= now) &&
    (link.maxUses == null || link.useCount < link.maxUses);

  if (!isValid) {
    if (link) {
      const reason = !link.isActive ? "link_inactive"
        : (link.expiresAt && link.expiresAt < now) ? "link_expired"
        : (link.maxUses != null && link.useCount >= link.maxUses) ? "max_uses_reached"
        : "not_activated_yet";
      logAudit({
        action:       "REGISTRATION_LINK_BLOCKED",
        module:       "REGISTROS",
        dojoId:       link.dojoId,
        resourceType: "RegistrationLink",
        resourceId:   link.id,
        ip,
        details:      JSON.stringify({ reason }),
      }).catch(() => {});
    }
    // Retornar error real — nunca mostrar "éxito" si no se guardó nada
    return NextResponse.json({ error: ERR_LINK_UNAVAILABLE }, { status: 410 });
  }

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: ERR_INVALID_DATA }, { status: 400 });

  const parsed = RegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: ERR_INVALID_DATA }, { status: 400 });
  }

  const body = parsed.data;

  // Honeypot: bots rellenan campos ocultos, humanos no.
  // Respuesta exitosa silenciosa para no revelar la existencia del mecanismo.
  if (body.honeypot) {
    return NextResponse.json({ ok: true });
  }

  // Validar magic bytes de la foto — rechaza archivos maliciosos disfrazados de imagen
  if (body.photo) {
    if (!validateBase64Image(body.photo)) {
      logAudit({
        action:       "REGISTRATION_MALICIOUS_FILE_BLOCKED",
        module:       "REGISTROS",
        dojoId:       link.dojoId,
        resourceType: "RegistrationLink",
        resourceId:   link.id,
        ip,
        details:      JSON.stringify({ reason: "invalid_magic_bytes" }),
      }).catch(() => {});
      return NextResponse.json({ error: ERR_INVALID_DATA }, { status: 400 });
    }
  }

  // Normalizar nombres con capitalización correcta en español
  const fullNameTrimmed = toTitleCase(body.fullName);
  const nameParts = fullNameTrimmed.split(/\s+/);
  const firstName = toTitleCase(body.firstName?.trim() || nameParts[0] || fullNameTrimmed);
  const lastName  = toTitleCase(body.lastName?.trim()  || nameParts.slice(1).join(" ") || firstName);

  // ── Validación de duplicados: cédula y correos ────────────────────────────
  const trimmedCedula      = body.cedula?.trim()      || null;
  const trimmedMotherEmail = body.motherEmail?.trim() || null;
  const trimmedFatherEmail = body.fatherEmail?.trim() || null;
  const hasSibling         = body.hasSiblingInDojo ?? false;

  // 1. Cédula — verificar contra alumnos aprobados y solicitudes activas
  if (trimmedCedula) {
    const [cedulaStudent, cedulaPending] = await Promise.all([
      prisma.student.findFirst({
        where:  { dojoId: link.dojoId, cedula: trimmedCedula },
        select: { id: true },
      }),
      prisma.pendingStudent.findFirst({
        where:  { dojoId: link.dojoId, cedula: trimmedCedula, status: { not: "rejected" } },
        select: { id: true, status: true },
      }),
    ]);

    if (cedulaStudent || cedulaPending) {
      const msg = cedulaStudent || cedulaPending?.status === "approved"
        ? "Esta cédula ya pertenece a un alumno registrado en este dojo."
        : "Esta cédula ya tiene una solicitud de inscripción pendiente de revisión.";
      logAudit({
        action:       "REGISTRATION_DUPLICATE_BLOCKED",
        module:       "REGISTROS",
        dojoId:       link.dojoId,
        resourceType: "RegistrationLink",
        resourceId:   link.id,
        ip,
        details:      JSON.stringify({
          field:    "cedula",
          cedula:   trimmedCedula,
          fullName: body.fullName,
          email:    trimmedMotherEmail || trimmedFatherEmail || null,
        }),
      }).catch(() => {});
      return NextResponse.json({ error: msg, field: "cedula" }, { status: 409 });
    }
  }

  // 2. Correos — solo si NO es hermano/a (los hermanos comparten email de padres)
  if (!hasSibling) {
    const emailsToCheck = [trimmedMotherEmail, trimmedFatherEmail].filter(Boolean) as string[];

    if (emailsToCheck.length > 0) {
      const emailChecks = await Promise.all(
        emailsToCheck.map(email => Promise.all([
          prisma.student.findFirst({
            where:  { dojoId: link.dojoId, OR: [{ motherEmail: email }, { fatherEmail: email }] },
            select: { id: true },
          }),
          prisma.pendingStudent.findFirst({
            where:  { dojoId: link.dojoId, status: { not: "rejected" }, OR: [{ motherEmail: email }, { fatherEmail: email }] },
            select: { id: true, status: true },
          }),
        ]))
      );

      for (const [emailStudent, emailPending] of emailChecks) {
        if (emailStudent || emailPending) {
          const msg = emailStudent || emailPending?.status === "approved"
            ? "Este correo electrónico ya está asociado a un alumno registrado en este dojo."
            : "Este correo electrónico ya tiene una solicitud de inscripción pendiente de revisión.";
          logAudit({
            action:       "REGISTRATION_DUPLICATE_BLOCKED",
            module:       "REGISTROS",
            dojoId:       link.dojoId,
            resourceType: "RegistrationLink",
            resourceId:   link.id,
            ip,
            details:      JSON.stringify({
              field:    "email",
              fullName: body.fullName,
              email:    trimmedMotherEmail || trimmedFatherEmail || null,
            }),
          }).catch(() => {});
          return NextResponse.json({ error: msg, field: "email" }, { status: 409 });
        }
      }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.pendingStudent.create({
        data: {
          dojoId:             link.dojoId,
          registrationLinkId: link.id,
          submitterIp:        ip,
          fullName:           fullNameTrimmed,
          firstName,
          lastName,
          primaryGuardian:    body.primaryGuardian || null,
          birthDate:          new Date(body.birthDate),
          gender:             body.gender,
          nationality:        toTitleCase(body.nationality.trim()),
          cedula:             body.cedula.trim(),
          fepakaId:           body.fepakaId     ? body.fepakaId.toUpperCase()    : null,
          ryoBukaiId:         body.ryoBukaiId   ? body.ryoBukaiId.toUpperCase()  : null,
          bloodType:          body.bloodType    || null,
          condition:          body.condition    || null,
          hasPrivateInsurance: body.hasPrivateInsurance ?? false,
          insuranceName:      body.insuranceName  || null,
          insuranceNumber:    body.insuranceNumber || null,
          motherName:         body.motherName  ? toTitleCase(body.motherName)  : null,
          motherPhone:        body.motherPhone || null,
          motherEmail:        body.motherEmail || null,
          fatherName:         body.fatherName  ? toTitleCase(body.fatherName)  : null,
          fatherPhone:        body.fatherPhone || null,
          fatherEmail:        body.fatherEmail || null,
          address:             body.address         || null,
          photo:               body.photo           || null,
          hasSiblingInDojo:    body.hasSiblingInDojo ?? false,
          acceptedTermsVersion: body.acceptedTermsVersion ?? null,
        },
      });
      await tx.registrationLink.update({
        where: { id: link.id },
        data:  { useCount: { increment: 1 } },
      });
    });

    const confirmTo = body.primaryGuardian === "mother" ? trimmedMotherEmail :
                      body.primaryGuardian === "father" ? trimmedFatherEmail :
                      trimmedMotherEmail || trimmedFatherEmail;

    await logAudit({
      action:       "PENDING_STUDENT_SUBMITTED",
      module:       AUDIT_MODULE.STUDENTS,
      dojoId:       link.dojoId,
      resourceType: "PendingStudent",
      ip,
      country:      req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? null,
      city:         req.headers.get("x-vercel-ip-city")    ?? null,
      region:       req.headers.get("x-vercel-ip-region")  ?? null,
      userAgent:    req.headers.get("user-agent"),
      statusCode:   201,
      details:      JSON.stringify({
        fullName:  body.fullName,
        email:     confirmTo ?? null,
        linkId:    link.id,
      }),
    });

    // Enviar email de confirmación al acudiente principal (fire-and-forget)
    if (confirmTo) {
      sendRegistrationConfirmation({
        to:          confirmTo,
        studentName: body.fullName,
        dojoName:    link.dojo.name,
        dojo:        link.dojo,
      }).catch(err => console.error("[registro] Confirmation email failed:", err));
    }

    // Notificación al propietario de la plataforma (fire-and-forget)
    notifyAdmin(
      `📋 Auto-registro — ${body.fullName} (${link.dojo.name})`,
      buildPendingStudentEmail(body.fullName, link.dojo.name, body.cedula ?? "No indicada", ip),
    ).catch(() => {});

    // Cookie de bloqueo: evita reenvío desde el mismo navegador
    const res = NextResponse.json({ ok: true });
    res.cookies.set(`reg-${token}`, "1", {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   30 * 24 * 60 * 60, // 30 días
      path:     "/",
    });
    return res;
  } catch (err) {
    console.error("POST /api/public/register error:", err);
    return NextResponse.json({ error: ERR_SAVE_FAILED }, { status: 500 });
  }
}
