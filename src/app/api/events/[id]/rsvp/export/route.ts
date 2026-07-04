import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import ExcelJS from "exceljs";

type SessionUser = { role?: string; dojoId?: string | null };

const TZ = "America/Panama";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-PA", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
}

// GET /api/events/[id]/rsvp/export — descarga Excel con asistencias del evento
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "admin" && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { id } = await params;

  const event = await prisma.event.findFirst({
    where:  { id, dojoId },
    select: { id: true, title: true, startDate: true },
  });
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  // ── Fetch RSVPs ──────────────────────────────────────────────────────────────
  const rsvps = await prisma.eventRSVP.findMany({
    where:   { eventId: id },
    include: {
      student: { select: { id: true, fullName: true } },
    },
  });

  const attending    = rsvps
    .filter(r => r.status === "attending")
    .sort((a, b) => a.student.fullName.localeCompare(b.student.fullName, "es"));

  const notAttending = rsvps
    .filter(r => r.status === "not_attending")
    .sort((a, b) => a.student.fullName.localeCompare(b.student.fullName, "es"));

  const respondedIds    = new Set(rsvps.map(r => r.studentId));
  const pendingStudents = await prisma.student.findMany({
    where:   { dojoId, active: true, id: { notIn: [...respondedIds] } },
    select:  { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  // ── Build Excel ──────────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator  = "Dojo Master";
  wb.created  = new Date();

  const ws = wb.addWorksheet("Asistencias");
  ws.columns = [
    { key: "num",    width: 6  },
    { key: "nombre", width: 38 },
    { key: "estado", width: 20 },
    { key: "fecha",  width: 24 },
  ];

  // ── Header del evento ────────────────────────────────────────────────────────
  ws.mergeCells("A1:D1");
  const titleCell = ws.getCell("A1");
  titleCell.value = event.title;
  titleCell.font  = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC0392B" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  ws.mergeCells("A2:D2");
  const subCell = ws.getCell("A2");
  subCell.value = `Fecha del evento: ${fmtDate(event.startDate)}   ·   Generado: ${fmtDate(new Date())}`;
  subCell.font  = { italic: true, size: 10, color: { argb: "FF888888" } };
  subCell.alignment = { horizontal: "center" };
  ws.getRow(2).height = 18;

  ws.addRow([]); // fila vacía

  // Helper para agregar encabezado de sección
  function addSectionHeader(label: string, count: number, colorArgb: string) {
    ws.addRow([]);
    const row  = ws.addRow(["", label, "", `Total: ${count}`]);
    row.height = 20;
    ["A","B","C","D"].forEach(col => {
      const cell = ws.getCell(`${col}${row.number}`);
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: colorArgb } };
      cell.font  = { bold: true, size: 11, color: { argb: "FF111111" } };
    });
    ws.getCell(`D${row.number}`).alignment = { horizontal: "right" };
  }

  // Helper para agregar encabezado de columnas
  function addColHeaders() {
    const row  = ws.addRow(["#", "Nombre del alumno", "Estado", "Fecha de respuesta"]);
    row.height = 16;
    ["A","B","C","D"].forEach(col => {
      const cell = ws.getCell(`${col}${row.number}`);
      cell.font  = { bold: true, size: 10, color: { argb: "FF555555" } };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
      cell.border = { bottom: { style: "thin", color: { argb: "FFDDDDDD" } } };
    });
  }

  // Helper para agregar fila de alumno
  function addStudentRow(num: number, nombre: string, estado: string, fecha: string, rowBg: string) {
    const row  = ws.addRow([num, nombre, estado, fecha]);
    row.height = 15;
    ["A","B","C","D"].forEach(col => {
      const cell = ws.getCell(`${col}${row.number}`);
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
      cell.font  = { size: 10 };
    });
    ws.getCell(`A${row.number}`).alignment = { horizontal: "center" };
    ws.getCell(`D${row.number}`).font      = { size: 10, italic: fecha === "Por responder" };
    ws.getCell(`D${row.number}`).font      = { size: 10, color: { argb: fecha === "Por responder" ? "FFAAAAAA" : "FF333333" }, italic: fecha === "Por responder" };
  }

  // ── Sección Confirmados ──────────────────────────────────────────────────────
  addSectionHeader("✅  CONFIRMADOS", attending.length, "FFB7F5C0");
  addColHeaders();
  if (attending.length === 0) {
    ws.addRow(["", "Ningún alumno ha confirmado asistencia.", "", ""]);
  } else {
    attending.forEach((r, i) =>
      addStudentRow(i + 1, r.student.fullName, "Confirmado", fmtDate(r.createdAt), i % 2 === 0 ? "FFFAFFF8" : "FFF0FBF0"),
    );
  }

  // ── Sección No Asistirá ──────────────────────────────────────────────────────
  addSectionHeader("❌  NO ASISTIRÁ", notAttending.length, "FFFFC0C0");
  addColHeaders();
  if (notAttending.length === 0) {
    ws.addRow(["", "Ningún alumno ha declinado.", "", ""]);
  } else {
    notAttending.forEach((r, i) =>
      addStudentRow(i + 1, r.student.fullName, "No asistirá", fmtDate(r.createdAt), i % 2 === 0 ? "FFFFF8F8" : "FFFDF0F0"),
    );
  }

  // ── Sección Sin Respuesta ────────────────────────────────────────────────────
  addSectionHeader("⏳  SIN RESPUESTA", pendingStudents.length, "FFFFF4C0");
  addColHeaders();
  if (pendingStudents.length === 0) {
    ws.addRow(["", "Todos los alumnos respondieron.", "", ""]);
  } else {
    pendingStudents.forEach((s, i) =>
      addStudentRow(i + 1, s.fullName, "Sin respuesta", "Por responder", i % 2 === 0 ? "FFFFFEF5" : "FFFFFBEA"),
    );
  }

  // ── Totales ──────────────────────────────────────────────────────────────────
  ws.addRow([]);
  const totalRow  = ws.addRow(["", "TOTAL DE ALUMNOS", "", attending.length + notAttending.length + pendingStudents.length]);
  totalRow.height = 18;
  ["A","B","C","D"].forEach(col => {
    const cell = ws.getCell(`${col}${totalRow.number}`);
    cell.font  = { bold: true, size: 10 };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } };
    cell.border = { top: { style: "thin", color: { argb: "FFCCCCCC" } } };
  });
  ws.getCell(`D${totalRow.number}`).alignment = { horizontal: "center" };

  // ── Serializar y devolver ────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const slug   = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const filename = `evento-${slug}-asistencias.xlsx`;

  return new NextResponse(buffer, {
    status:  200,
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
