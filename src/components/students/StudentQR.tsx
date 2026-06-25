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
    if (!qrUrl) return;

    const img = new Image();
    img.onload = () => {
      const sidePad = 16;
      const topPad = 16;
      const textGap = -4;
      const lineHeight = 18;
      const canvasWidth = img.width + sidePad * 2;
      const maxTextWidth = img.width;

      const parts = toTitleCase(props.fullName).split(" ");
      const mid = Math.ceil(parts.length / 2);
      const firstLine = parts.slice(0, mid).join(" ");
      const secondLine = parts.slice(mid).join(" ");
      const idLine = `ID: #${props.studentCode ?? "—"}`;

      const lines = secondLine ? 3 : 2;
      const canvasHeight = topPad + img.height + textGap + lineHeight * lines + 12;

      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d")!;

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(img, sidePad, topPad);

      ctx.fillStyle = "#0F0F1A";
      ctx.textAlign = "center";

      let fontSize = 14;
      ctx.font = `bold ${fontSize}px sans-serif`;
      const longestLine = firstLine.length > secondLine.length ? firstLine : secondLine;
      while (ctx.measureText(longestLine).width > maxTextWidth && fontSize > 9) {
        fontSize--;
        ctx.font = `bold ${fontSize}px sans-serif`;
      }

      let y = topPad + img.height + textGap + lineHeight;
      ctx.fillText(firstLine, canvasWidth / 2, y, maxTextWidth);

      if (secondLine) {
        y += lineHeight;
        ctx.fillText(secondLine, canvasWidth / 2, y, maxTextWidth);
      }

      ctx.font = `${Math.max(fontSize - 2, 9)}px sans-serif`;
      y += lineHeight;
      ctx.fillText(idLine, canvasWidth / 2, y, maxTextWidth);

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `qr-${props.fullName.replace(/\s+/g, "-")}.png`;
      a.click();
    };
    img.src = qrUrl;
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
