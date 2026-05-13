"use client";
import { useEffect, useState } from "react";
import { QrCode, Download } from "lucide-react";
import QRCode from "qrcode";

interface StudentQRProps {
  studentCode: number | null;
  fullName: string;
}

function buildQRText(p: StudentQRProps): string {
  // QR contiene solo el código numérico único del alumno.
  // El scanner lo envía directamente al API sin ningún parsing.
  return String(p.studentCode ?? "0");
}

export function StudentQR(props: StudentQRProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(buildQRText(props), {
      width: 200,
      margin: 2,
      color: { dark: "#0F0F1A", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    }).then((url) => { if (!cancelled) setQrUrl(url); });
    return () => { cancelled = true; };
  }, [props.studentCode]);

  function handleDownload() {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `qr-${props.fullName.replace(/\s+/g, "-")}.png`;
    a.click();
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
