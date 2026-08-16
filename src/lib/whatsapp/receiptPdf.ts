/**
 * Genera el recibo de pago en PDF que se adjunta como HEADER de tipo
 * documento del template confirmacion_pago_dojomaster (ver sendTemplate.ts).
 * Formato de ticket angosto — pensado para verse bien dentro del visor de
 * documentos de WhatsApp, no para impresión formal.
 */
import { jsPDF } from "jspdf";
import { uploadBuffer } from "@/lib/imagekit";
import { detectImageFormat } from "@/lib/certificate-render";
import { isOwnMediaUrl } from "@/lib/upload-validation";

export interface PaymentReceiptData {
  dojoName:    string;
  dojoSlug?:   string | null; // slug del dojo — organiza la carpeta de ImageKit por dojo
  dojoLogoUrl?: string | null; // URL de Cloudinary o base64 legado — ver loadDojoLogo()
  receiptNo:   string;
  studentName: string;
  studentCode: number | null;
  concept:     string;
  paidDate:    string;
  amount:      number;
}

const PAGE_WIDTH  = 105; // mm
const PAGE_HEIGHT = 174; // mm
const MARGIN      = 12;

// Header negro (marca del recibo), rojo de marca para el filo bajo el
// header, y verde oscuro para el sello "PAGADO".
const HEADER_BLACK = [17, 17, 17]  as const;
const DARK_GREEN   = [11, 110, 45] as const;
const BRAND_RED     = [192, 57, 43] as const;

/**
 * Descarga el logo del dojo para embeberlo en el PDF. Acepta tanto URL de
 * Cloudinary (dojos nuevos) como base64 legado con o sin prefijo data:
 * (dojos viejos — ver comentario de Dojo.logo en schema.prisma). Nunca
 * lanza: si el logo no se puede cargar, el recibo se genera igual sin él.
 *
 * Defensa en profundidad: aunque los endpoints que escriben Dojo.logo ya
 * validan con isOwnMediaUrl() (ver src/lib/upload-validation.ts), este es el
 * único punto del código que hace un fetch() server-side sobre ese valor —
 * se revalida acá también para no depender de que todo caller de escritura
 * lo haga bien, y así evitar que el campo se use como vector de SSRF.
 */
async function loadDojoLogo(logoValue: string): Promise<Uint8Array | null> {
  try {
    if (logoValue.startsWith("http")) {
      if (!isOwnMediaUrl(logoValue)) return null;
      const res = await fetch(logoValue);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    }
    const base64 = logoValue.includes(",") ? logoValue.split(",")[1] : logoValue;
    return new Uint8Array(Buffer.from(base64, "base64"));
  } catch {
    return null;
  }
}

export async function renderPaymentReceiptPdf(data: PaymentReceiptData): Promise<Buffer> {
  const doc = new jsPDF({ unit: "mm", format: [PAGE_WIDTH, PAGE_HEIGHT], compress: true });
  const centerX = PAGE_WIDTH / 2;

  // ── Header negro con logo centrado ─────────────────────────────
  const BAND_HEIGHT = 36;
  doc.setFillColor(...HEADER_BLACK);
  doc.rect(0, 0, PAGE_WIDTH, BAND_HEIGHT, "F");
  doc.setFillColor(...BRAND_RED);
  doc.rect(0, BAND_HEIGHT, PAGE_WIDTH, 1, "F"); // filo rojo al pie del header

  const logoBytes = data.dojoLogoUrl ? await loadDojoLogo(data.dojoLogoUrl) : null;
  let textTop = 16; // posición por defecto del nombre del dojo, sin logo

  if (logoBytes) {
    try {
      const format = detectImageFormat(logoBytes);
      const props  = doc.getImageProperties(logoBytes);
      const maxH = 14, maxW = 46;
      let h = maxH, w = h * (props.width / props.height);
      if (w > maxW) { w = maxW; h = w * (props.height / props.width); }
      const logoY = 6;
      doc.addImage(logoBytes, format, centerX - w / 2, logoY, w, h);
      textTop = logoY + h + 5;
    } catch {
      textTop = 16; // logo corrupto/formato no soportado — sigue sin él
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(logoBytes ? 10 : 15);
  doc.setTextColor(255, 255, 255);
  doc.text(data.dojoName, centerX, textTop, { align: "center", maxWidth: PAGE_WIDTH - MARGIN * 2 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(logoBytes ? 8 : 9.5);
  doc.setTextColor(185, 185, 185);
  doc.text("R E C I B O   D E   P A G O", centerX, textTop + (logoBytes ? 5.5 : 8), { align: "center" });

  let y = BAND_HEIGHT + 10;

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`N.º ${data.receiptNo}`, centerX, y, { align: "center" });
  y += 10;

  // ── Cuerpo blanco / texto negro — tarjeta de datos ──────────────
  const cardTop    = y - 6;
  const cardHeight = data.studentCode ? 34 : 27;
  doc.setDrawColor(224, 224, 224);
  doc.setLineWidth(0.35);
  doc.roundedRect(MARGIN - 2, cardTop, PAGE_WIDTH - (MARGIN - 2) * 2, cardHeight, 2, 2, "S");

  doc.setFontSize(9);
  const row = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15);
    doc.text(value, PAGE_WIDTH - MARGIN, y, { align: "right", maxWidth: 55 });
    y += 7;
  };

  row("Alumno", data.studentName);
  if (data.studentCode) row("Código", `#${data.studentCode}`);
  row("Concepto", data.concept);
  row("Fecha de pago", data.paidDate);

  y = cardTop + cardHeight + 13;

  // ── Total pagado ────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(130);
  doc.text("T O T A L   P A G A D O", centerX, y, { align: "center" });

  y += 12;
  doc.setFontSize(27);
  doc.setTextColor(...DARK_GREEN);
  doc.text(`$${data.amount.toFixed(2)}`, centerX, y, { align: "center" });

  // ── Sello "PAGADO" en verde oscuro ──────────────────────────────
  y += 23; // suficiente para que el círculo no pise el monto (27pt) de arriba
  const stampR = 18;
  doc.setDrawColor(...DARK_GREEN);
  doc.setLineWidth(1.1);
  doc.circle(centerX, y, stampR, "S");
  doc.setLineWidth(0.35);
  doc.circle(centerX, y, stampR - 3, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...DARK_GREEN);
  doc.text("PAGADO", centerX, y + 1.5, { align: "center", angle: 6 });

  y += stampR + 13;

  // ── Footer ──────────────────────────────────────────────────
  doc.setDrawColor(228, 228, 234);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(
    "Comprobante generado automáticamente por Dojo Master Online",
    centerX, y,
    { align: "center", maxWidth: PAGE_WIDTH - MARGIN * 2 },
  );

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Renderiza y sube el recibo a ImageKit — a diferencia de Cloudinary (ver
 * historial de este archivo), ImageKit no bloquea por defecto la entrega
 * pública de PDFs, así que la URL resultante sirve directo como link de
 * documento para la Graph API de Meta sin pasos extra de firma.
 */
export async function generateAndUploadReceiptPdf(
  data: PaymentReceiptData,
): Promise<{ link: string; filename: string; publicId: string }> {
  const buffer   = await renderPaymentReceiptPdf(data);
  const filename = `recibo-${data.receiptNo}.pdf`;
  const folder   = data.dojoSlug ? `dojo-manager/${data.dojoSlug}/receipts` : "receipts";
  const { url, fileId } = await uploadBuffer(buffer, filename, folder, "application/pdf");
  return { link: url, filename, publicId: fileId };
}
