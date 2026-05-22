/**
 * GET /api/students/import/template
 * Genera y descarga la plantilla Excel para importación masiva de alumnos.
 * Solo admin/sysadmin autenticado.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ExcelJS from "exceljs";
import {
  IMPORT_COLUMNS, VALID_BELT_COLORS, VALID_BLOOD_TYPES, columnLetter,
} from "@/lib/student-import";

type SessionUser = { role?: string };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUser)?.role;
  if (!session?.user || !["admin", "sysadmin"].includes(role ?? "")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "DojoManager";
  wb.created = new Date();

  // ── Hoja 1: Plantilla ────────────────────────────────────────────────
  const ws = wb.addWorksheet("Alumnos", {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  ws.columns = IMPORT_COLUMNS.map(col => ({
    width: Math.max(col.header.length + 4, 22),
  }));

  // Fila 1: Cabecera
  const headerRow = ws.addRow(IMPORT_COLUMNS.map(c => c.header));
  headerRow.eachCell((cell, colIdx) => {
    const col = IMPORT_COLUMNS[colIdx - 1];
    cell.font      = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: col?.required ? "FFC0392B" : "FF2C3E50" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border    = { bottom: { style: "thin", color: { argb: "FFFFFFFF" } }, right: { style: "thin", color: { argb: "FFFFFFFF" } } };
  });
  headerRow.height = 32;

  // Fila 2: Ejemplo
  const exampleRow = ws.addRow(IMPORT_COLUMNS.map(c => c.example));
  exampleRow.eachCell(cell => {
    cell.font      = { italic: true, color: { argb: "FF666666" }, size: 10 };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
    cell.alignment = { vertical: "middle" };
  });
  exampleRow.height = 20;

  // Filas 3-502: datos vacíos
  for (let i = 3; i <= 502; i++) {
    const row = ws.addRow([]);
    row.height = 18;
    if (i % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
      });
    }
  }

  // Validación: Género
  const gIdx = IMPORT_COLUMNS.findIndex(c => c.key === "gender") + 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ws as any).dataValidations?.add?.(`${columnLetter(gIdx)}3:${columnLetter(gIdx)}502`, {
    type: "list", allowBlank: true, formulae: ['"M,F"'],
    showErrorMessage: true, errorTitle: "Género inválido", error: "Use M o F",
  });

  // Validación: Tipo de Sangre
  const bIdx = IMPORT_COLUMNS.findIndex(c => c.key === "bloodType") + 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ws as any).dataValidations?.add?.(`${columnLetter(bIdx)}3:${columnLetter(bIdx)}502`, {
    type: "list", allowBlank: true, formulae: [`"${VALID_BLOOD_TYPES.join(",")}"`],
    showErrorMessage: true, errorTitle: "Tipo de sangre inválido", error: `Use: ${VALID_BLOOD_TYPES.join(", ")}`,
  });

  // Validación: Seguro Privado
  const iIdx = IMPORT_COLUMNS.findIndex(c => c.key === "hasPrivateInsurance") + 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ws as any).dataValidations?.add?.(`${columnLetter(iIdx)}3:${columnLetter(iIdx)}502`, {
    type: "list", allowBlank: true, formulae: ['"SI,NO"'],
  });

  // ── Hoja 2: Instrucciones ────────────────────────────────────────────
  const wsI = wb.addWorksheet("Instrucciones");
  wsI.columns = [{ width: 80 }];

  const lines: [string, boolean?][] = [
    ["INSTRUCCIONES PARA IMPORTAR ALUMNOS — DojoManager", true],
    [""],
    ["CAMPOS OBLIGATORIOS (fondo rojo):", true],
    ["  • Nombre Completo: nombre completo del alumno"],
    ["  • Cédula / Documento: número de identidad único — es la llave de importación"],
    [""],
    ["REGLAS IMPORTANTES:", true],
    ["  • Si la cédula ya existe en TU dojo → fila OMITIDA (no se duplica ni actualiza)"],
    ["  • Si la cédula existe en OTRO dojo → se crea igualmente (aislamiento multi-tenant)"],
    ["  • Nombre Completo o Cédula vacíos → la fila NO se importa"],
    ["  • Campos opcionales vacíos quedan en null — no generan error"],
    ["  • La foto del alumno NO se importa por Excel — agrégala desde el perfil"],
    ["  • Fechas en formato DD/MM/AAAA (ejemplo: 15/03/2009)"],
    ["  • Género: solo M o F"],
    ["  • Seguro Privado: SI o NO"],
    [""],
    ["CINTAS VÁLIDAS:", true],
    ...VALID_BELT_COLORS.map(b => ([`  • ${b}`] as [string])),
    [""],
    [`TIPOS DE SANGRE: ${VALID_BLOOD_TYPES.join(", ")}`, true],
    [""],
    ["PROCESO:", true],
    ["  1. Llena la hoja 'Alumnos' desde la fila 3 (la fila 2 es de ejemplo)"],
    ["  2. Guarda el archivo como .xlsx"],
    ["  3. En DojoManager → Configuración → Importar Alumnos → sube el archivo"],
    ["  4. El sistema procesa y muestra un resumen con creados, omitidos y errores"],
  ];

  lines.forEach(([text, bold]) => {
    const row = wsI.addRow([text]);
    row.getCell(1).font = bold ? { bold: true, size: 11 } : { size: 10 };
    if (text.includes("DojoManager") && bold) {
      row.getCell(1).font = { bold: true, size: 14, color: { argb: "FFC0392B" } };
    }
  });

  const buffer = await wb.xlsx.writeBuffer();

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="DojoManager_Plantilla_Alumnos.xlsx"',
      "Cache-Control":       "no-store",
    },
  });
}
