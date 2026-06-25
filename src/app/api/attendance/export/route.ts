import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import ExcelJS from "exceljs";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const dateFrom   = searchParams.get("dateFrom");
  const dateTo     = searchParams.get("dateTo");
  const type       = searchParams.get("type");
  const scheduleId = searchParams.get("scheduleId");

  const attendances = await prisma.attendance.findMany({
    where: {
      student: { dojoId },
      ...(dateFrom || dateTo ? {
        markedAt: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo   ? { lte: new Date(dateTo) }   : {}),
        },
      } : {}),
      ...(type && type !== "all" ? { type } : {}),
      ...(scheduleId && scheduleId !== "all" ? { scheduleId } : {}),
    },
    include: {
      student: {
        select: {
          fullName: true, studentCode: true,
          beltHistory: { orderBy: { changeDate: "desc" }, take: 1, select: { beltColor: true } },
        },
      },
      schedule: { select: { name: true } },
    },
    orderBy: { markedAt: "desc" },
    take: 5000,
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Dojo Master";
  const ws = wb.addWorksheet("Asistencia");

  ws.columns = [
    { header: "Código",     key: "code",     width: 10 },
    { header: "Alumno",     key: "name",     width: 30 },
    { header: "Cinta",      key: "belt",     width: 16 },
    { header: "Tipo",       key: "type",     width: 10 },
    { header: "Fecha",      key: "date",     width: 14 },
    { header: "Hora",       key: "time",     width: 10 },
    { header: "Horario",    key: "schedule", width: 22 },
    { header: "Nota",       key: "note",     width: 25 },
    { header: "Corregida",  key: "corrected", width: 12 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC0392B" } };
  headerRow.alignment = { horizontal: "center" };

  const TZ = "America/Panama";
  for (const a of attendances) {
    const dt = new Date(a.markedAt);
    const belt = a.student.beltHistory[0]?.beltColor ?? "";
    ws.addRow({
      code:      a.student.studentCode ?? "",
      name:      a.student.fullName,
      belt:      belt.charAt(0).toUpperCase() + belt.slice(1).replace(/-/g, " "),
      type:      a.type === "entry" ? "Entrada" : "Salida",
      date:      dt.toLocaleDateString("es-PA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }),
      time:      dt.toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit", timeZone: TZ }),
      schedule:  a.schedule?.name ?? "",
      note:      a.note ?? "",
      corrected: a.corrected ? "Sí" : "No",
    });
  }

  ws.autoFilter = { from: "A1", to: "I1" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await wb.xlsx.writeBuffer() as any;

  const today = new Date().toISOString().split("T")[0];
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="asistencia-${today}.xlsx"`,
    },
  });
}
