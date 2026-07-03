import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail, escHtml } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REPORT_TO = "soporte@dojomasteronline.com";
const TZ        = "America/Panama";

function fmtDate(d: Date) {
  return d.toLocaleDateString("es-PA", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("es-PA", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtDateTime(d: Date) { return `${fmtDate(d)} ${fmtTime(d)}`; }

function stat(label: string, value: number | string, color = "#1a1a2e") {
  return `
    <td style="padding:8px 16px;text-align:center;background:${color};border-radius:8px;margin:4px;">
      <div style="font-size:24px;font-weight:bold;color:#C0392B;">${value}</div>
      <div style="font-size:11px;color:#666;margin-top:2px;">${label}</div>
    </td>`;
}

function section(title: string, content: string) {
  return `
    <div style="margin:20px 0;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
      <div style="background:#1a1a2e;padding:12px 16px;">
        <h3 style="margin:0;color:#C0392B;font-size:14px;text-transform:uppercase;letter-spacing:1px;">${title}</h3>
      </div>
      <div style="padding:16px;background:#fff;">${content}</div>
    </div>`;
}

function badge(text: string, color: string) {
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:bold;background:${color};color:#fff;margin:1px;">${text}</span>`;
}

export async function GET(req: NextRequest) {
  // Verificar secreto del cron
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const now      = new Date();
    const since    = new Date(now.getTime() - 24 * 60 * 60 * 1000); // últimas 24h

    const reportDate = now.toLocaleDateString("es-PA", {
      timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const periodLabel = `${fmtDateTime(since)} → ${fmtDateTime(now)}`;

    // ── Datos globales en paralelo ──────────────────────────────────────────────
    const [
      dojos,
      visitCount,
      visitByCountry,
      visitByPage,
      activeUsersCount,
      pushLogCount,
    ] = await Promise.all([
      prisma.dojo.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      }),
      prisma.visitorLog.count({ where: { visitedAt: { gte: since } } }),
      prisma.visitorLog.groupBy({
        by: ["country", "countryCode"],
        where: { visitedAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
      prisma.visitorLog.groupBy({
        by: ["path"],
        where: { visitedAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
      prisma.user.count({ where: { lastActiveAt: { gte: since } } }),
      prisma.pushNotificationLog.count({ where: { sentAt: { gte: since } } }),
    ]);

    // ── Datos por dojo ──────────────────────────────────────────────────────────
    const dojoReports = await Promise.all(dojos.map(async dojo => {
      const [
        newStudents,
        attendances,
        paidPayments,
        newBelts,
        rsvpCount,
        examResponses,
        activeUsers,
      ] = await Promise.all([
        prisma.student.count({ where: { dojoId: dojo.id, createdAt: { gte: since } } }),
        prisma.attendance.count({ where: { student: { dojoId: dojo.id }, markedAt: { gte: since } } }),
        prisma.payment.count({ where: { student: { dojoId: dojo.id }, status: "paid", paidDate: { gte: since } } }),
        prisma.beltHistory.count({ where: { student: { dojoId: dojo.id }, changeDate: { gte: since.toISOString().slice(0, 10) } } }),
        prisma.eventRSVP.count({ where: { event: { dojoId: dojo.id }, createdAt: { gte: since } } }),
        prisma.examApplicationInvitee.count({
          where: {
            application: { dojoId: dojo.id },
            respondedAt: { gte: since },
          },
        }),
        prisma.user.count({ where: { dojoId: dojo.id, lastActiveAt: { gte: since } } }),
      ]);

      return { dojo, newStudents, attendances, paidPayments, newBelts, rsvpCount, examResponses, activeUsers };
    }));

    // ── Construir HTML ──────────────────────────────────────────────────────────
    function flag(code: string | null) {
      if (!code || code.length !== 2) return "🌐";
      return Array.from(code.toUpperCase()).map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join("");
    }

    const visitorsHtml = `
      <table style="border-collapse:collapse;width:100%;margin-bottom:12px;">
        <tr>
          ${stat("Visitas totales", visitCount)}
          ${stat("Usuarios activos", activeUsersCount)}
          ${stat("Push enviados", pushLogCount)}
        </tr>
      </table>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
          <p style="font-size:12px;font-weight:bold;color:#666;text-transform:uppercase;margin:0 0 8px;">Top países</p>
          ${visitByCountry.map(r =>
            `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:13px;">
              <span>${flag(r.countryCode)} ${escHtml(r.country ?? r.countryCode ?? "—")}</span>
              <strong>${r._count.id}</strong>
            </div>`
          ).join("") || "<p style='color:#999;font-size:12px;'>Sin visitas</p>"}
        </div>
        <div style="flex:1;min-width:200px;">
          <p style="font-size:12px;font-weight:bold;color:#666;text-transform:uppercase;margin:0 0 8px;">Top páginas</p>
          ${visitByPage.map(r =>
            `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:13px;">
              <span style="font-family:monospace;font-size:12px;">${escHtml(r.path)}</span>
              <strong>${r._count.id}</strong>
            </div>`
          ).join("") || "<p style='color:#999;font-size:12px;'>Sin visitas</p>"}
        </div>
      </div>`;

    const dojosHtml = dojoReports
      .filter(r => r.newStudents + r.attendances + r.paidPayments + r.newBelts + r.rsvpCount + r.examResponses + r.activeUsers > 0)
      .map(r => `
        <div style="margin-bottom:12px;padding:12px;border:1px solid #e5e5e5;border-radius:6px;">
          <p style="margin:0 0 10px;font-size:15px;font-weight:bold;color:#1a1a2e;">
            ${escHtml(r.dojo.name)}
            <span style="font-size:11px;font-weight:normal;color:#888;margin-left:6px;">${r.dojo.slug}</span>
          </p>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${r.activeUsers    > 0 ? badge(`👤 ${r.activeUsers} usuarios activos`,  "#2c3e50") : ""}
            ${r.attendances    > 0 ? badge(`✅ ${r.attendances} asistencias`,       "#27ae60") : ""}
            ${r.paidPayments   > 0 ? badge(`💰 ${r.paidPayments} pagos recibidos`, "#e67e22") : ""}
            ${r.newStudents    > 0 ? badge(`🥋 ${r.newStudents} nuevos alumnos`,    "#8e44ad") : ""}
            ${r.newBelts       > 0 ? badge(`🏅 ${r.newBelts} cintas otorgadas`,     "#C0392B") : ""}
            ${r.rsvpCount      > 0 ? badge(`📅 ${r.rsvpCount} confirmaciones evento`, "#2980b9") : ""}
            ${r.examResponses  > 0 ? badge(`📋 ${r.examResponses} respuestas examen`, "#16a085") : ""}
          </div>
        </div>`)
      .join("") || `<p style="color:#999;font-size:13px;text-align:center;padding:16px;">Sin actividad registrada en el período.</p>`;

    const totalActivity = dojoReports.reduce((acc, r) =>
      acc + r.newStudents + r.attendances + r.paidPayments + r.newBelts + r.rsvpCount + r.examResponses, 0
    );

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:640px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

  <!-- Header -->
  <div style="background:#1a1a2e;padding:28px 24px;text-align:center;">
    <h1 style="margin:0;font-size:24px;color:#C0392B;font-family:Georgia,serif;letter-spacing:3px;">DOJO MASTER</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Reporte diario de actividad</p>
    <p style="margin:6px 0 0;color:#fff;font-size:16px;font-weight:bold;">${reportDate}</p>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.5);font-size:11px;">${periodLabel}</p>
  </div>

  <div style="padding:24px;">

    <!-- Resumen global -->
    ${section("Resumen de la plataforma", `
      <table style="border-collapse:collapse;width:100%;">
        <tr>
          ${stat("Dojos activos", dojos.length)}
          ${stat("Actividad total", totalActivity)}
          ${stat("Visitas web", visitCount)}
          ${stat("Usuarios activos", activeUsersCount)}
        </tr>
      </table>
    `)}

    <!-- Visitantes -->
    ${section("Visitantes del sitio web", visitorsHtml)}

    <!-- Por dojo -->
    ${section("Actividad por dojo", dojosHtml)}

    <!-- Footer -->
    <div style="margin-top:24px;padding:16px;background:#f9f9f9;border-radius:8px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#999;">
        Reporte generado automáticamente el ${fmtDateTime(now)} (hora Panamá)<br>
        <strong style="color:#C0392B;">Dojo Master Online</strong> · soporte@dojomasteronline.com
      </p>
    </div>
  </div>
</div>
</body>
</html>`;

    await sendEmail({
      to:      REPORT_TO,
      subject: `📊 Reporte diario Dojo Master — ${reportDate}`,
      html,
    });

    return NextResponse.json({
      ok:      true,
      dojos:   dojos.length,
      visits:  visitCount,
      active:  activeUsersCount,
      sentTo:  REPORT_TO,
    });

  } catch (err) {
    console.error("[cron/daily-report]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
