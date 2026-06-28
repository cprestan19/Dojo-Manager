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

    // QR en máxima resolución con corrección de errores alta (H = 30%)
    QRCode.toDataURL(buildQRText(props), {
      width: 1600,
      margin: 1,
      color: { dark: "#0D0D14", light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    }).then((hiResUrl) => {
      const img = new Image();
      img.onload = () => {
        const SCALE  = 4;    // 4× → ~300 DPI al imprimir a 7 cm
        const QR_SZ  = 540;  // tamaño lógico del QR
        const PAD    = 36;
        const GAP    = 22;   // espacio entre QR y nombre

        const fullName = toTitleCase(props.fullName);
        const idText   = props.studentCode ? `#${props.studentCode}` : "—";

        // Dividir nombre en 2 líneas por el centro de palabras
        const words = fullName.split(" ");
        const mid   = Math.ceil(words.length / 2);
        const line1 = words.slice(0, mid).join(" ");
        const line2 = words.length > 2 ? words.slice(mid).join(" ") : "";

        const MAX_W  = QR_SZ;           // nombre no excede el ancho del QR
        const CNVS_W = QR_SZ + PAD * 2;

        // ── Calcular fontSize con canvas temporal (sin scale) ──────────
        const mCtx = document.createElement("canvas").getContext("2d")!;
        let nameSz = 48;
        const longest = line1.length >= line2.length ? line1 : line2;
        mCtx.font = `800 ${nameSz}px system-ui, Arial, sans-serif`;
        while (nameSz > 22 && mCtx.measureText(longest).width > MAX_W - 6) {
          nameSz--;
          mCtx.font = `800 ${nameSz}px system-ui, Arial, sans-serif`;
        }
        const idSz     = Math.max(Math.round(nameSz * 0.76), 20);
        const nameLineH = Math.round(nameSz * 1.28);
        const idLineH   = Math.round(idSz  * 1.6);
        const nLines    = line2 ? 2 : 1;
        const CNVS_H    = PAD + QR_SZ + GAP + nameLineH * nLines + idLineH + PAD;

        // ── Canvas final (SCALE ×) ─────────────────────────────────────
        const canvas = document.createElement("canvas");
        canvas.width  = CNVS_W * SCALE;
        canvas.height = CNVS_H * SCALE;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(SCALE, SCALE);

        // Fondo blanco
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, CNVS_W, CNVS_H);

        // QR centrado arriba
        ctx.drawImage(img, PAD, PAD, QR_SZ, QR_SZ);

        // Nombre (negrita, oscuro)
        ctx.fillStyle  = "#0D0D14";
        ctx.textAlign  = "center";
        ctx.font       = `800 ${nameSz}px system-ui, Arial, sans-serif`;
        let y = PAD + QR_SZ + GAP + nameLineH;
        ctx.fillText(line1, CNVS_W / 2, y, MAX_W);
        if (line2) {
          y += nameLineH;
          ctx.fillText(line2, CNVS_W / 2, y, MAX_W);
        }

        // ID (más pequeño, gris)
        ctx.fillStyle = "#444444";
        ctx.font      = `600 ${idSz}px system-ui, Arial, sans-serif`;
        y += idLineH;
        ctx.fillText(idText, CNVS_W / 2, y, MAX_W);

        const a    = document.createElement("a");
        a.href     = canvas.toDataURL("image/png");
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
