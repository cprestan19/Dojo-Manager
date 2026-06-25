"use client";
import { useEffect, useState } from "react";
import { QrCode, Download } from "lucide-react";
import QRCode from "qrcode";
import { toTitleCase } from "@/lib/utils";

interface StudentQRProps {
  studentCode: number | null;
  cardToken: string | null;
  fullName: string;
}

function buildQRText(p: StudentQRProps): string {
  // QR contiene la URL completa del carnet (token impredecible) para que la
  // cámara del celular lo abra. El scanner de asistencia extrae el código
  // del patrón /id/<token> automáticamente.
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/id/${p.cardToken ?? ""}`;
}

export function StudentQR(props: StudentQRProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!props.cardToken) return;
    let cancelled = false;
    QRCode.toDataURL(buildQRText(props), {
      width: 300,
      margin: 2,
      color: { dark: "#0F0F1A", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    }).then((url) => { if (!cancelled) setQrUrl(url); });
    return () => { cancelled = true; };
  }, [props.cardToken]);

  function handleDownload() {
    if (!props.cardToken) return;

    // Generar QR en alta resolución exclusivamente para la descarga
    QRCode.toDataURL(buildQRText(props), {
      width: 800,
      margin: 2,
      color: { dark: "#0F0F1A", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    }).then((hiResUrl) => {
      const img = new Image();
      img.onload = () => {
        // Escala 3× → canvas físico de ~2400×2800 px (≈300 DPI al imprimir a 8cm)
        const SCALE = 3;
        const qrLogical = 400;   // tamaño lógico del QR en el canvas
        const sidePad = 24;
        const topPad = 24;
        const textGap = 12;
        const lineHeight = 30;
        const maxTextWidth = qrLogical;
        const logicalWidth = qrLogical + sidePad * 2;

        const parts = toTitleCase(props.fullName).split(" ");
        const mid = Math.ceil(parts.length / 2);
        const firstLine = parts.slice(0, mid).join(" ");
        const secondLine = parts.slice(mid).join(" ");
        const idLine = `ID: #${props.studentCode ?? "—"}`;

        const textLines = secondLine ? 3 : 2;
        const logicalHeight = topPad + qrLogical + textGap + lineHeight * textLines + 24;

        const canvas = document.createElement("canvas");
        canvas.width = logicalWidth * SCALE;
        canvas.height = logicalHeight * SCALE;
        const ctx = canvas.getContext("2d")!;

        // Todas las instrucciones de dibujo usan coordenadas lógicas;
        // ctx.scale las amplifica al tamaño físico real del canvas.
        ctx.scale(SCALE, SCALE);

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, logicalWidth, logicalHeight);

        // QR centrado
        ctx.drawImage(img, sidePad, topPad, qrLogical, qrLogical);

        ctx.fillStyle = "#0F0F1A";
        ctx.textAlign = "center";

        let fontSize = 22;
        ctx.font = `bold ${fontSize}px sans-serif`;
        const longestLine = firstLine.length >= secondLine.length ? firstLine : secondLine;
        while (ctx.measureText(longestLine).width > maxTextWidth && fontSize > 14) {
          fontSize--;
          ctx.font = `bold ${fontSize}px sans-serif`;
        }

        let y = topPad + qrLogical + textGap + lineHeight;
        ctx.fillText(firstLine, logicalWidth / 2, y, maxTextWidth);

        if (secondLine) {
          y += lineHeight;
          ctx.fillText(secondLine, logicalWidth / 2, y, maxTextWidth);
        }

        ctx.font = `${Math.max(fontSize - 3, 14)}px sans-serif`;
        y += lineHeight;
        ctx.fillText(idLine, logicalWidth / 2, y, maxTextWidth);

        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = `qr-${props.fullName.replace(/\s+/g, "-")}.png`;
        a.click();
      };
      img.src = hiResUrl;
    });
  }

  return (
    <div className="card">
      <p className="section-title flex items-center gap-2 mb-4">
        <QrCode size={13} /> Identificación del Alumno
      </p>

      <div className="flex flex-col items-center gap-4">
        {/* Nombre + ID en la tarjeta */}
        <div className="w-full bg-dojo-darker rounded-lg p-3 text-center border border-dojo-border space-y-1">
          <p className="text-sm font-semibold text-dojo-white">{props.fullName}</p>
          <p className="text-xs text-dojo-muted">ID Único</p>
          <p className="font-display text-2xl font-bold text-dojo-gold tracking-widest">
            #{props.studentCode ?? "—"}
          </p>
        </div>

        {/* QR Code — codifica solo el número */}
        <div className="bg-white rounded-xl p-3 shadow-lg">
          {qrUrl ? (
            <img src={qrUrl} alt="QR Code" width={160} height={160} className="block" />
          ) : (
            <div className="w-40 h-40 flex items-center justify-center">
              <QrCode size={40} className="text-gray-300 animate-pulse" />
            </div>
          )}
        </div>

        <p className="text-xs text-dojo-muted text-center leading-relaxed px-2">
          Escanea este código para registrar asistencia.
        </p>

        <button
          onClick={handleDownload}
          disabled={!qrUrl}
          className="btn-secondary w-full justify-center text-sm py-1.5 disabled:opacity-40"
        >
          <Download size={14} /> Descargar QR
        </button>
      </div>
    </div>
  );
}
