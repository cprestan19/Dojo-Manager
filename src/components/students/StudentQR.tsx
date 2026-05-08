"use client";
import { useEffect, useState } from "react";
import { QrCode, Download } from "lucide-react";
import QRCode from "qrcode";

interface StudentQRProps {
  studentCode: number | null;
  fullName: string;
  cedula: string | null;
  address: string | null;
  motherName: string | null;
  motherPhone: string | null;
  fatherName: string | null;
  fatherPhone: string | null;
  dojoName: string;
  dojoPhone: string | null;
}

function buildQRText(p: StudentQRProps): string {
  const lines: string[] = [
    `DOJO MASTER`,
    `Dojo: ${p.dojoName}`,
    `ID Alumno: #${p.studentCode ?? "—"}`,
    `Nombre: ${p.fullName}`,
  ];
  if (p.cedula)      lines.push(`Cédula: ${p.cedula}`);
  if (p.address)     lines.push(`Dirección: ${p.address}`);
  lines.push("---");
  if (p.motherName)  lines.push(`Madre: ${p.motherName}${p.motherPhone ? ` | Tel: ${p.motherPhone}` : ""}`);
  if (p.fatherName)  lines.push(`Padre: ${p.fatherName}${p.fatherPhone ? ` | Tel: ${p.fatherPhone}` : ""}`);
  if (p.dojoPhone)   lines.push(`Tel. Dojo: ${p.dojoPhone}`);
  return lines.join("\n");
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.studentCode, props.fullName, props.cedula, props.address,
      props.motherName, props.motherPhone, props.fatherName, props.fatherPhone,
      props.dojoName, props.dojoPhone]);

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
        {/* Student code badge */}
        <div className="w-full bg-dojo-darker rounded-lg p-3 text-center border border-dojo-border">
          <p className="text-xs text-dojo-muted mb-1">ID Único</p>
          <p className="font-display text-2xl font-bold text-dojo-gold tracking-widest">
            #{props.studentCode ?? "—"}
          </p>
        </div>

        {/* Cedula */}
        {props.cedula && (
          <div className="w-full bg-dojo-darker rounded-lg p-3 text-center border border-dojo-border">
            <p className="text-xs text-dojo-muted mb-1">Cédula / Pasaporte</p>
            <p className="font-mono text-dojo-white font-semibold tracking-wider">{props.cedula}</p>
          </div>
        )}

        {/* QR Code */}
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
          Escanea para ver datos del alumno,<br />contactos y dojo.
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
