/**
 * Public endpoint — submit a free trial / scholarship request.
 * No authentication required. Rate limited via middleware.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";
import { z } from "zod";

const Schema = z.object({
  slug:        z.string().min(1).max(100),
  childName:   z.string().trim().min(2).max(100),
  childAge:    z.number().int().min(3).max(18),
  parentName:  z.string().trim().min(2).max(100),
  parentPhone: z.string().trim().min(6).max(30),
  parentEmail: z.string().email().optional().or(z.literal("")),
  message:     z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const ip        = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                 ?? req.headers.get("x-real-ip")
                 ?? req.headers.get("cf-connecting-ip")
                 ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? null;
  const country   = req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? null;
  const city      = req.headers.get("x-vercel-ip-city") ?? null;

  try {
    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const parsed = Schema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.errors.map(e => e.message).join(", ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { slug, childName, childAge, parentName, parentPhone, parentEmail, message } = parsed.data;

    const dojo = await prisma.dojo.findUnique({
      where:  { slug, active: true },
      select: {
        id: true, name: true, email: true, phone: true, logo: true, slogan: true,
        users: {
          where:  { role: { in: ["admin"] }, active: true },
          select: { email: true },
          take:   3,
        },
        dojoPage: { select: { showFreeTrial: true } },
      },
    });
    if (!dojo)
      return NextResponse.json({ error: "Formulario no disponible" }, { status: 404 });
    if (dojo.dojoPage && dojo.dojoPage.showFreeTrial === false)
      return NextResponse.json({ error: "El formulario de clase de prueba no está disponible en este dojo" }, { status: 404 });

    const schedules = await prisma.schedule.findMany({
      where:   { dojoId: dojo.id, active: true },
      select:  { id: true, startTime: true },
      orderBy: { startTime: "asc" },
    });

    let suggestedScheduleId: string | null = null;
    if (schedules.length > 0) {
      if (childAge <= 7) {
        suggestedScheduleId = schedules.find(s => s.startTime < "12:00")?.id ?? schedules[0].id;
      } else if (childAge <= 12) {
        suggestedScheduleId = schedules.find(s => s.startTime >= "12:00" && s.startTime < "17:00")?.id
          ?? schedules[0].id;
      } else {
        suggestedScheduleId = schedules.find(s => s.startTime >= "17:00")?.id ?? schedules[0].id;
      }
    }

    const request = await prisma.freeTrialRequest.create({
      data: {
        dojoId:      dojo.id,
        childName,
        childAge,
        parentName,
        parentPhone,
        parentEmail: parentEmail || null,
        message:     message || null,
        scheduleId:  suggestedScheduleId,
        status:      "pending",
        read:        false,
      },
      select: { id: true, childName: true, childAge: true },
    });

    // ── Audit log con IP, país y dispositivo ────────────────────────
    await logAudit({
      action:       "FREE_TRIAL_REQUESTED",
      module:       AUDIT_MODULE.PORTAL,
      method:       "POST",
      resourceType: "FreeTrialRequest",
      resourceId:   request.id,
      dojoId:       dojo.id,
      ip,
      userAgent,
      country,
      city,
      statusCode:   201,
      details:      JSON.stringify({
        childName, childAge, parentName,
        parentPhone, parentEmail: parentEmail || null,
        dojoName: dojo.name,
      }),
    });

    // ── Notificar a los admins del dojo por email ───────────────────
    const adminEmails = dojo.users.map(u => u.email).filter(Boolean);
    if (adminEmails.length > 0) {
      const dashboardUrl = `${process.env.NEXTAUTH_URL ?? "https://dojomasteronline.com"}/dashboard/leads`;
      const html = `
<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;background:#1A1A2E;color:#F0F0F0;border-radius:12px;overflow:hidden;">
  <div style="background:#C0392B;padding:20px 24px;">
    <h1 style="margin:0;font-size:18px;color:#fff;font-family:serif;letter-spacing:2px;">${dojo.name}</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Nueva solicitud de clase de prueba</p>
  </div>
  <div style="padding:24px;">
    <h2 style="color:#F39C12;font-size:16px;margin:0 0 16px;">🥋 ¡Nuevo prospecto interesado!</h2>
    <div style="background:#16213E;border-radius:8px;padding:16px;margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="color:#8892A4;padding:5px 0;">Niño/a</td><td style="color:#F0F0F0;font-weight:bold;">${childName} (${childAge} años)</td></tr>
        <tr><td style="color:#8892A4;padding:5px 0;">Acudiente</td><td style="color:#F0F0F0;">${parentName}</td></tr>
        <tr><td style="color:#8892A4;padding:5px 0;">Teléfono</td><td style="color:#F0F0F0;">${parentPhone}</td></tr>
        ${parentEmail ? `<tr><td style="color:#8892A4;padding:5px 0;">Email</td><td style="color:#F0F0F0;">${parentEmail}</td></tr>` : ""}
        ${message ? `<tr><td style="color:#8892A4;padding:5px 0;vertical-align:top;">Mensaje</td><td style="color:#C8D0DA;font-style:italic;">"${message}"</td></tr>` : ""}
        <tr><td style="color:#8892A4;padding:5px 0;">País/IP</td><td style="color:#8892A4;font-size:11px;">${country ?? "N/A"} · ${city ?? ""} · ${ip}</td></tr>
      </table>
    </div>
    <div style="text-align:center;">
      <a href="${dashboardUrl}" style="display:inline-block;background:#C0392B;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:14px;">
        Ver en el CRM de Prospectos →
      </a>
    </div>
    <p style="color:#8892A4;font-size:11px;text-align:center;margin:16px 0 0;">
      Responde rápido — el 78% de los prospectos elige al primero que los contacta.
    </p>
  </div>
</div>`;

      // No bloqueante — no fallar el request si el email falla
      sendEmail({
        to:      adminEmails.join(","),
        subject: `🥋 Nuevo prospecto — ${childName} (${childAge} años) quiere clase de prueba en ${dojo.name}`,
        html,
      }).catch(err => console.error("[free-trial] Admin email failed:", err));
    }

    return NextResponse.json({ ok: true, id: request.id }, { status: 201 });
  } catch (err) {
    console.error("[free-trial] POST error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
