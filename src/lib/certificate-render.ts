import { jsPDF } from "jspdf";

export interface CertElement {
  id:             string;
  type:           "studentName" | "belt" | "date" | "instructor" | "customText";
  label:          string;
  xPct:           number;
  yPct:           number;
  fontSize:       number;
  fontFamily:     string;
  color:          string;
  fontWeight:     "normal" | "bold";
  fontStyle:      "normal" | "italic";
  textDecoration: "none" | "underline";
  textAlign:      "left" | "center" | "right";
  rotation:       number;
}

export interface CertificateTemplateData {
  imageUrl:     string;
  canvasWidth:  number;
  canvasHeight: number;
  elements:     CertElement[];
}

export interface CertificateValues {
  studentName: string;
  belt:        string;
  date:        string;
  instructor:  string;
}

// El editor de plantillas (dashboard/settings/certificados) solo ofrece las
// fuentes de CERT_FONTS — ninguna está embebida en el PDF (sin pipeline de
// embedding de fuentes), así que se aproxima a la familia base14 más cercana.
function mapFont(fontFamily: string): { name: "helvetica" | "times"; italic: boolean } {
  if (fontFamily === "Dancing Script" || fontFamily === "Great Vibes") return { name: "times", italic: true };
  if (["serif", "Cinzel", "Cormorant Garamond", "Playfair Display"].includes(fontFamily)) return { name: "times", italic: false };
  return { name: "helvetica", italic: false };
}

export function detectImageFormat(bytes: Uint8Array): "PNG" | "JPEG" | "WEBP" {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "PNG";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "JPEG";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "WEBP";
  return "PNG";
}

function elementText(el: CertElement, values: CertificateValues): string {
  switch (el.type) {
    case "studentName": return values.studentName;
    case "belt":         return values.belt;
    case "date":         return values.date;
    case "instructor":   return values.instructor;
    case "customText":   return el.label;
    default:             return "";
  }
}

export async function renderCertificatePdf(
  template: CertificateTemplateData,
  values:   CertificateValues,
): Promise<Buffer> {
  const imgRes = await fetch(template.imageUrl);
  if (!imgRes.ok) throw new Error("No se pudo descargar la imagen de la plantilla");
  const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
  const format   = detectImageFormat(imgBytes);

  const doc = new jsPDF({
    unit:     "px",
    format:   [template.canvasWidth, template.canvasHeight],
    compress: true,
  });

  doc.addImage(imgBytes, format, 0, 0, template.canvasWidth, template.canvasHeight);

  for (const el of template.elements) {
    const text = elementText(el, values);
    if (!text) continue;

    const font  = mapFont(el.fontFamily);
    const bold  = el.fontWeight === "bold";
    const ital  = el.fontStyle === "italic" || font.italic;
    const style = bold ? (ital ? "bolditalic" : "bold") : (ital ? "italic" : "normal");

    doc.setFont(font.name, style);
    doc.setFontSize(el.fontSize);
    doc.setTextColor(el.color);

    const x = (el.xPct / 100) * template.canvasWidth;
    const y = (el.yPct / 100) * template.canvasHeight;

    doc.text(text, x, y, {
      align:    el.textAlign,
      baseline: "middle",
      // CSS rotate() gira en sentido horario; el ángulo de jsPDF es antihorario.
      angle:    el.rotation ? -el.rotation : undefined,
    });

    if (el.textDecoration === "underline") {
      const width = doc.getTextWidth(text);
      const underlineY = y + el.fontSize * 0.35;
      const lineX = el.textAlign === "center" ? x - width / 2
        : el.textAlign === "right" ? x - width
        : x;
      doc.setDrawColor(el.color);
      doc.setLineWidth(Math.max(1, el.fontSize * 0.04));
      doc.line(lineX, underlineY, lineX + width, underlineY);
    }
  }

  return Buffer.from(doc.output("arraybuffer"));
}
