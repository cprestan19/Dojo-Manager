/**
 * POST /api/students/import
 * Procesa un archivo Excel con alumnos y los crea en el dojo activo.
 * Solo admin/sysadmin autenticado.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveDojoId } from "@/lib/sysadmin-context";
import prisma from "@/lib/prisma";
import ExcelJS from "exceljs";
import {
  IMPORT_COLUMNS,
  ImportSummary, RowResult,
  parseDate, cellToString, normalizeGender,
  normalizeBoolean, normalizeBeltColor,
  VALID_BLOOD_TYPES,
} from "@/lib/student-import";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null; id?: string; email?: string };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user    = session?.user as SessionUser | undefined;

  if (!user || !["admin", "sysadmin"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
  if (!dojoId) {
    return NextResponse.json({ error: "Sin contexto de dojo activo" }, { status: 403 });
  }

  // Leer archivo y modo (create=default | update=actualizar existentes)
  const formData   = await req.formData();
  const file       = formData.get("file") as File | null;
  const updateMode = formData.get("mode") === "update";  // ?mode=update → actualiza existentes

  if (!file) return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });

  if (!file.name.endsWith(".xlsx") && !file.type.includes("spreadsheetml")) {
    return NextResponse.json({ error: "Solo se aceptan archivos .xlsx" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "El archivo no puede superar 10 MB" }, { status: 400 });
  }

  const arrayBuf = await file.arrayBuffer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer   = Buffer.from(arrayBuf) as any;
  const wb       = new ExcelJS.Workbook();

  try {
    await wb.xlsx.load(buffer);
  } catch {
    return NextResponse.json({ error: "No se pudo leer el archivo — verifica que sea un .xlsx válido" }, { status: 400 });
  }

  const ws = wb.getWorksheet("Alumnos") ?? wb.worksheets[0];
  if (!ws) return NextResponse.json({ error: "El archivo no contiene hojas de datos" }, { status: 400 });

  // Pre-cargar alumnos existentes del dojo (una sola query)
  const existingStudents = await prisma.student.findMany({
    where:  { dojoId, cedula: { not: null } },
    select: { id: true, cedula: true },
  });
  const cedulaSet = new Set(existingStudents.map(s => s.cedula!.trim()));
  const cedulaToId = new Map(existingStudents.map(s => [s.cedula!.trim(), s.id]));

  // Obtener studentCode máximo
  const maxCode = await prisma.student.aggregate({ _max: { studentCode: true }, where: { dojoId } });
  let nextCode  = Math.max((maxCode._max.studentCode ?? 999) + 1, 1000);

  // Mapear columnas por header (robusto a reordenamientos)
  const colMap: Record<string, number> = {};
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell, ci) => {
    const h = cellToString(cell.value);
    if (!h) return;
    const col = IMPORT_COLUMNS.find(c =>
      c.header.toLowerCase().replace(" *", "") === h.toLowerCase().replace(" *", "")
    );
    if (col) colMap[col.key] = ci;
  });
  // Fallback: posición por índice
  if (Object.keys(colMap).length < 2) {
    IMPORT_COLUMNS.forEach((col, idx) => { colMap[col.key] = idx + 1; });
  }

  const getCell = (row: ExcelJS.Row, key: string): string | null => {
    const ci = colMap[key];
    if (!ci) return null;
    const cell = row.getCell(ci);

    // Desenvuelve el resultado de fórmulas ExcelJS: { formula, result }
    let val: unknown = cell.value;
    if (val !== null && typeof val === "object" && "result" in (val as object)) {
      val = (val as { result: unknown }).result;
    }

    if (val instanceof Date) {
      // UTC evita el desfase de zona horaria (Excel guarda medianoche UTC)
      return `${String(val.getUTCDate()).padStart(2,"0")}/${String(val.getUTCMonth()+1).padStart(2,"0")}/${val.getUTCFullYear()}`;
    }

    // Serial numérico de Excel (ej: 44927 = 2023-01-01). Rango típico: 15000–60000
    if (typeof val === "number" && Number.isInteger(val) && val > 15000 && val < 60000) {
      const dt = new Date(Math.round((val - 25569) * 86400_000));
      if (!isNaN(dt.getTime())) {
        return `${String(dt.getUTCDate()).padStart(2,"0")}/${String(dt.getUTCMonth()+1).padStart(2,"0")}/${dt.getUTCFullYear()}`;
      }
    }

    return cellToString(val);
  };

  // Procesar filas (saltar filas 1 y 2)
  const rows: RowResult[] = [];

  const dataRows: ExcelJS.Row[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rn) => { if (rn >= 3) dataRows.push(row); });

  for (const row of dataRows) {
    const physicalRow = row.number;
    const fullName    = getCell(row, "fullName");
    const cedula      = getCell(row, "cedula");

    // Fila vacía → skip silencioso
    if (!fullName && !cedula) continue;

    if (!fullName) {
      rows.push({ status: "error", row: physicalRow, cedula: cedula ?? undefined, reason: "Nombre Completo es obligatorio" });
      continue;
    }
    if (!cedula) {
      rows.push({ status: "error", row: physicalRow, fullName, reason: "Cédula/Documento es obligatorio" });
      continue;
    }

    const cedulaTrim = cedula.trim();

    // Leer campos comunes (necesarios tanto en create como en update)
    const birthDate  = parseDate(getCell(row, "birthDate"));
    const genderRaw  = normalizeGender(getCell(row, "gender"));
    const nationality = getCell(row, "nationality") ?? "";
    const bloodType  = VALID_BLOOD_TYPES.includes(getCell(row, "bloodType") as typeof VALID_BLOOD_TYPES[number])
                        ? getCell(row, "bloodType") : null;
    const condition   = getCell(row, "condition");
    const hasIns      = normalizeBoolean(getCell(row, "hasPrivateInsurance"));
    const beltColor   = normalizeBeltColor(getCell(row, "beltColor"));
    const fepakaId    = getCell(row, "fepakaId")?.toUpperCase() ?? null;
    const ryoBukaiId  = getCell(row, "ryoBukaiId")?.toUpperCase() ?? null;
    const monthlyRaw  = parseFloat(getCell(row, "monthlyAmount") ?? "0") || 0;
    const annualRaw   = parseFloat(getCell(row, "annualAmount")  ?? "0") || 0;
    const inscDate    = parseDate(getCell(row, "inscriptionDate")) ?? new Date();
    const firstNameRaw = getCell(row, "firstName");
    const lastNameRaw  = getCell(row, "lastName");
    const parts     = fullName.trim().split(/\s+/);
    const firstName = firstNameRaw ?? parts[0] ?? fullName.trim();
    const lastName  = lastNameRaw  ?? parts.slice(1).join(" ") ?? "";

    // ── Modo actualización: cédula existente → actualizar campos ────────────
    if (cedulaSet.has(cedulaTrim)) {
      if (!updateMode) {
        rows.push({ status: "skipped", row: physicalRow, fullName, cedula: cedulaTrim, reason: "Cédula ya existe en este dojo" });
        continue;
      }

      // Actualizar solo campos informativos, sin tocar studentCode ni foto
      try {
        const existingId = cedulaToId.get(cedulaTrim)!;
        await prisma.student.update({
          where: { id: existingId },
          data: {
            fullName:    fullName.trim(),
            firstName,
            lastName,
            ...(birthDate  ? { birthDate }        : {}),
            ...(genderRaw  ? { gender: genderRaw } : {}),
            ...(nationality ? { nationality }      : {}),
            ...(bloodType  ? { bloodType }         : {}),
            ...(condition  ? { condition }         : {}),
            hasPrivateInsurance: hasIns,
            ...(fepakaId   ? { fepakaId }          : {}),
            ...(ryoBukaiId ? { ryoBukaiId }        : {}),
            ...(getCell(row, "motherName")  ? { motherName:  getCell(row, "motherName")  } : {}),
            ...(getCell(row, "motherPhone") ? { motherPhone: getCell(row, "motherPhone") } : {}),
            ...(getCell(row, "motherEmail") ? { motherEmail: getCell(row, "motherEmail") } : {}),
            ...(getCell(row, "fatherName")  ? { fatherName:  getCell(row, "fatherName")  } : {}),
            ...(getCell(row, "fatherPhone") ? { fatherPhone: getCell(row, "fatherPhone") } : {}),
            ...(getCell(row, "fatherEmail") ? { fatherEmail: getCell(row, "fatherEmail") } : {}),
            ...(getCell(row, "address")     ? { address:     getCell(row, "address")     } : {}),
          },
        });
        rows.push({ status: "created", row: physicalRow, fullName: fullName.trim(), cedula: cedulaTrim, studentCode: 0 });
      } catch (err) {
        rows.push({ status: "error", row: physicalRow, fullName, cedula: cedulaTrim,
          reason: `Error al actualizar: ${err instanceof Error ? err.message.slice(0, 80) : "desconocido"}` });
      }
      continue;
    }

    const studentCode = nextCode++;

    try {
      await prisma.$transaction(async tx => {
        const student = await tx.student.create({
          data: {
            dojoId,
            studentCode,
            fullName:    fullName.trim(),
            firstName,
            lastName,
            cedula:      cedulaTrim,
            birthDate:   birthDate ?? new Date("2000-01-01"),
            gender:      genderRaw ?? "M",
            nationality,
            bloodType,
            condition,
            hasPrivateInsurance: hasIns,
            insuranceName:   hasIns ? (getCell(row, "insuranceName") ?? null) : null,
            insuranceNumber: hasIns ? (getCell(row, "insuranceNumber") ?? null) : null,
            fepakaId,
            ryoBukaiId,
            motherName:  getCell(row, "motherName"),
            motherPhone: getCell(row, "motherPhone"),
            motherEmail: getCell(row, "motherEmail"),
            fatherName:  getCell(row, "fatherName"),
            fatherPhone: getCell(row, "fatherPhone"),
            fatherEmail: getCell(row, "fatherEmail"),
            address:     getCell(row, "address"),
            active:           true,
            attendanceStatus: "ACTIVO",
            photo:            null,  // NUNCA importar fotos por Excel
            // Inscripción
            ...(monthlyRaw > 0 || annualRaw > 0 ? {
              inscription: {
                create: {
                  inscriptionDate: inscDate,
                  monthlyAmount:   isNaN(monthlyRaw) ? 0 : monthlyRaw,
                  annualAmount:    isNaN(annualRaw)  ? 0 : annualRaw,
                  discountAmount:  0,
                  paymentPeriod:   "monthly",
                  biweeklyAmount:  0,
                },
              },
            } : {}),
          },
          select: { id: true },
        });

        // Crear registro de cinta si se proporcionó
        if (beltColor) {
          await tx.beltHistory.create({
            data: {
              studentId:  student.id,
              beltColor,
              changeDate: inscDate,
              isRanking:  false,
            },
          });
        }
      });

      cedulaSet.add(cedulaTrim); // evitar duplicados dentro del mismo archivo
      rows.push({ status: "created", row: physicalRow, fullName: fullName.trim(), cedula: cedulaTrim, studentCode });

    } catch (err) {
      nextCode--; // devolver el código si falló
      rows.push({
        status: "error", row: physicalRow, fullName, cedula: cedulaTrim,
        reason: `Error: ${err instanceof Error ? err.message.slice(0, 100) : "desconocido"}`,
      });
    }
  }

  const createdCount = updateMode
    ? rows.filter(r => r.status === "created" && (r as { studentCode: number }).studentCode > 0).length
    : rows.filter(r => r.status === "created").length;
  const updatedCount = updateMode
    ? rows.filter(r => r.status === "created" && (r as { studentCode: number }).studentCode === 0).length
    : 0;

  const summary: ImportSummary = {
    total:   rows.length,
    created: createdCount,
    skipped: updatedCount > 0 ? 0 : rows.filter(r => r.status === "skipped").length,
    errors:  rows.filter(r => r.status === "error").length,
    rows,
  };

  // logAudit fuera del flujo crítico — nunca debe romper la respuesta
  try {
    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "STUDENTS_IMPORTED",
      module:       AUDIT_MODULE.STUDENTS,
      resourceType: "Student",
      statusCode:   200,
      details:      JSON.stringify({
        fileName: file.name,
        mode:     updateMode ? "update" : "create",
        total:    summary.total,
        created:  summary.created,
        skipped:  summary.skipped,
        errors:   summary.errors,
      }),
    });
  } catch { /* silent */ }

  const msgParts = [];
  if (createdCount > 0)  msgParts.push(`${createdCount} creados`);
  if (updatedCount > 0)  msgParts.push(`${updatedCount} actualizados`);
  if (summary.skipped > 0) msgParts.push(`${summary.skipped} omitidos`);
  if (summary.errors > 0)  msgParts.push(`${summary.errors} con error`);

  return NextResponse.json({
    ok:      true,
    mode:    updateMode ? "update" : "create",
    message: `Importación finalizada — ${msgParts.join(", ")}.`,
    summary,
  });
}
