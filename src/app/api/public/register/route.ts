import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { sendEmail } from "@/lib/email";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function generatePassword(): string {
  const upper   = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower   = "abcdefghjkmnpqrstuvwxyz";
  const digits  = "23456789";
  const special = "@#$!";
  const all     = upper + lower + digits + special;
  const pick    = (set: string) => set[randomInt(set.length)];
  const chars   = [pick(upper), pick(lower), pick(digits), pick(special),
    ...Array.from({ length: 8 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function sendWelcomeEmail(to: string, senseiName: string, dojoName: string, password: string) {
  try {
    const loginUrl = `${process.env.NEXTAUTH_URL ?? "https://dojomasteronline.com"}/login`;

    await sendEmail({
      to,
      subject: `🥋 ¡Bienvenido a Dojo Master, ${senseiName}!`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#C0392B;padding:32px 24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:28px;letter-spacing:4px;font-family:Georgia,serif;">DOJO MASTER</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Sistema de Administración de Karate</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 28px;">
      <h2 style="color:#111;font-size:22px;margin:0 0 8px;">¡Bienvenido, ${senseiName}! 🎉</h2>
      <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Tu dojo <strong>${dojoName}</strong> ya está registrado en Dojo Master con el <strong>Plan Bronce gratuito</strong>.
        Aquí están tus credenciales de acceso:
      </p>

      <!-- Credenciales -->
      <div style="background:#f8f8f8;border-left:4px solid #C0392B;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;color:#888;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Tus credenciales</p>
        <p style="margin:0 0 6px;font-size:15px;color:#111;"><strong>Email:</strong> ${to}</p>
        <p style="margin:0;font-size:15px;color:#111;"><strong>Contraseña temporal:</strong> <code style="background:#e8e8e8;padding:2px 8px;border-radius:4px;font-size:14px;">${password}</code></p>
      </div>

      <div style="text-align:center;margin-bottom:28px;">
        <a href="${loginUrl}" style="display:inline-block;background:#C0392B;color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;font-weight:bold;font-size:16px;">
          Entrar al panel →
        </a>
      </div>

      <!-- Pasos -->
      <h3 style="color:#111;font-size:16px;margin:0 0 16px;border-bottom:1px solid #eee;padding-bottom:10px;">
        ⚡ Primeros 3 pasos
      </h3>
      ${[
        ["1️⃣", "Sube tu logo y completa el perfil del dojo", "Configuración → General"],
        ["2️⃣", "Agrega tus primeros alumnos", "Alumnos → Nuevo alumno"],
        ["3️⃣", "Prueba el control de asistencia con QR", "Menú → Scanner QR (desde tu celular)"],
      ].map(([n, title, path]) => `
        <div style="display:flex;gap:12px;margin-bottom:14px;align-items:flex-start;">
          <span style="font-size:20px;line-height:1;">${n}</span>
          <div>
            <p style="margin:0;font-weight:bold;color:#111;font-size:14px;">${title}</p>
            <p style="margin:3px 0 0;color:#888;font-size:12px;">${path}</p>
          </div>
        </div>
      `).join("")}

      <!-- Límites del plan -->
      <div style="background:#fff8e1;border:1px solid #F59E0B;border-radius:10px;padding:16px 20px;margin-top:24px;">
        <p style="margin:0 0 8px;font-weight:bold;color:#92400E;font-size:14px;">📋 Plan Bronce — Límites actuales</p>
        <p style="margin:0 0 4px;font-size:13px;color:#555;">✓ Hasta <strong>15 alumnos</strong> activos</p>
        <p style="margin:0 0 4px;font-size:13px;color:#555;">✓ Control de asistencia QR, pagos y recordatorios automáticos</p>
        <p style="margin:0 0 12px;font-size:13px;color:#555;">✓ Portal del alumno con videos de katas</p>
        <p style="margin:0 0 4px;font-size:12px;color:#92400E;"><strong>¿Más de 15 alumnos?</strong> → Plan Silver (hasta 40) — $29/mes</p>
        <p style="margin:0;font-size:12px;color:#92400E;"><strong>¿Torneos + streaming + alumnos ilimitados?</strong> → Plan Gold — $59/mes</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8f8f8;padding:20px 28px;text-align:center;border-top:1px solid #eee;">
      <p style="margin:0 0 8px;font-size:13px;color:#888;">¿Necesitas ayuda? Escríbenos por WhatsApp</p>
      <a href="https://wa.me/50762019999" style="color:#C0392B;font-weight:bold;text-decoration:none;font-size:13px;">
        📱 +507 6201-9999
      </a>
      <p style="margin:12px 0 0;font-size:11px;color:#bbb;">© ${new Date().getFullYear()} Dojo Master · admin@dojomasteronline.com</p>
    </div>

  </div>
</body>
</html>`,
    });
  } catch (err) {
    console.error("[register] Welcome email failed:", err);
  }
}

async function notifyFounder(senseiName: string, dojoName: string, email: string, phone: string, country: string, studentCount: string, yearsTeaching: string) {
  try {
    await sendEmail({
      to:      "admin@dojomasteronline.com",
      subject: `🥋 Nuevo registro — ${dojoName} (${country})`,
      html: `
        <div style="font-family:Arial,sans-serif;padding:24px;max-width:500px;background:#fff;border-radius:12px;">
          <h2 style="color:#C0392B;margin:0 0 16px;">¡Nuevo dojo registrado!</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            ${[
              ["Sensei",          senseiName],
              ["Dojo",            dojoName],
              ["Email",           email],
              ["WhatsApp",        phone],
              ["País",            country],
              ["Alumnos",         studentCount],
              ["Años enseñando",  yearsTeaching],
            ].map(([k, v]) => `
              <tr>
                <td style="padding:8px 0;color:#888;font-weight:bold;width:120px;">${k}</td>
                <td style="padding:8px 0;color:#111;">${v}</td>
              </tr>
            `).join("")}
          </table>
          <div style="margin-top:20px;display:flex;gap:8px;flex-wrap:wrap;">
            <a href="https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(`¡Hola ${senseiName}! Soy de Dojo Master. Vi que acabas de registrarte con tu dojo "${dojoName}". ¿Cómo te puedo ayudar a configurarlo?`)}"
              style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;font-size:14px;">
              📱 WhatsApp al Sensei
            </a>
            <a href="mailto:${email}?subject=Bienvenido a Dojo Master"
              style="display:inline-block;background:#C0392B;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;font-size:14px;">
              ✉️ Responder por email
            </a>
          </div>
        </div>`,
    });
  } catch (err) {
    console.error("[register] Founder notification failed:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const { senseiName, dojoName, country, email, phone, studentCount, yearsTeaching } = body as {
      senseiName: string; dojoName: string; country: string;
      email: string; phone: string; studentCount: string; yearsTeaching?: string;
    };

    // Validaciones básicas
    if (!senseiName?.trim()) return NextResponse.json({ error: "El nombre del Sensei es requerido" }, { status: 400 });
    if (!dojoName?.trim())   return NextResponse.json({ error: "El nombre del dojo es requerido" }, { status: 400 });
    if (!email?.trim() || !email.includes("@")) return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    if (!phone?.trim())      return NextResponse.json({ error: "El teléfono es requerido" }, { status: 400 });

    const cleanEmail = email.trim().toLowerCase();

    // Verificar si el email ya está registrado
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail }, select: { id: true } });
    if (existingUser) return NextResponse.json({ error: "Ya existe una cuenta con este email" }, { status: 409 });

    // Generar slug único
    let baseSlug = slugify(dojoName.trim());
    if (!baseSlug) baseSlug = "dojo";
    let slug = baseSlug;
    let attempt = 0;
    while (await prisma.dojo.findUnique({ where: { slug }, select: { id: true } })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    const tempPassword = generatePassword();
    const hashed       = await bcrypt.hash(tempPassword, 12);

    // Crear Dojo + Admin en una transacción
    await prisma.$transaction(async (tx) => {
      const dojo = await tx.dojo.create({
        data: {
          name:   dojoName.trim(),
          slug,
          ownerName: senseiName.trim(),
          active: true,
        },
      });

      await tx.user.create({
        data: {
          name:               senseiName.trim(),
          email:              cleanEmail,
          password:           hashed,
          role:               "admin",
          dojoId:             dojo.id,
          mustChangePassword: true,
          active:             true,
        },
      });
    });

    // Obtener el dojo recién creado para el audit log
    const newDojo = await prisma.dojo.findUnique({ where: { slug }, select: { id: true } });

    // Audit log con IP, país y dispositivo
    const ip      = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                 ?? req.headers.get("x-real-ip")
                 ?? req.headers.get("cf-connecting-ip")
                 ?? "unknown";
    const country2 = req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? country ?? null;
    await logAudit({
      action:       "DOJO_SELF_REGISTERED",
      module:       AUDIT_MODULE.SYSADMIN,
      method:       "POST",
      resourceType: "Dojo",
      resourceId:   newDojo?.id ?? null,
      ip,
      userAgent:    req.headers.get("user-agent"),
      country:      country2,
      city:         req.headers.get("x-vercel-ip-city") ?? null,
      statusCode:   201,
      details:      JSON.stringify({
        dojoName:     dojoName.trim(),
        senseiName:   senseiName.trim(),
        email:        cleanEmail,
        phone:        phone.trim(),
        country,
        studentCount:  studentCount ?? "No indicado",
        yearsTeaching: yearsTeaching ?? "No indicado",
        slug,
      }),
    });

    // Enviar emails (no bloqueante — no fallan el registro)
    await Promise.allSettled([
      sendWelcomeEmail(cleanEmail, senseiName.trim(), dojoName.trim(), tempPassword),
      notifyFounder(senseiName.trim(), dojoName.trim(), cleanEmail, phone.trim(), country, studentCount ?? "No indicado", yearsTeaching ?? "No indicado"),
    ]);

    return NextResponse.json({ ok: true, slug }, { status: 201 });

  } catch (err) {
    console.error("[register] Error:", err);
    return NextResponse.json({ error: "Error al crear la cuenta. Inténtalo de nuevo." }, { status: 500 });
  }
}
