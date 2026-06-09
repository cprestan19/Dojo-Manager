"use client";

import { useRef, useState } from "react";

// 55×85mm a 7px/mm = 385×595px
// Diseño basado en referencia visual: Carnet Final.png
const W = 385;
const H = 595;
const RED  = "#D90416";
const DARK = "#0A0A0A";

// Foto grande centrada
const PHOTO_D = 174;                            // diámetro
const PHOTO_X = Math.floor((W - PHOTO_D) / 2); // = 105 (centrado)
const PHOTO_Y = 60;                             // borde superior foto

// QR section
const QR_TOP  = 335;
const QR_H    = 200;

// Footer
const FOOTER_TOP = 540;  // QR_TOP + QR_H + 5 = 540

function ToriiSVG({ size = 38, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={Math.round(size * 0.84)} viewBox="0 0 240 200" fill={color}>
      <rect x="38"  y="68" width="14" height="132" rx="4" />
      <rect x="188" y="68" width="14" height="132" rx="4" />
      <path d="M10,72 Q120,28 230,72 L230,86 Q120,42 10,86 Z" />
      <rect x="24"  y="86" width="192" height="10" rx="3" />
      <rect x="44"  y="108" width="152" height="12" rx="4" />
      <ellipse cx="45"  cy="68" rx="11" ry="7" />
      <ellipse cx="195" cy="68" rx="11" ry="7" />
    </svg>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 18, height: 18,
      border: "3px solid rgba(255,255,255,0.3)",
      borderTopColor: "#fff", borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }} />
  );
}

interface CardProps {
  student: { fullName: string; studentCode: number; studentId: string; photo: string | null; beltColor: string; active: boolean };
  dojo:    { name: string; logo: string | null; phone: string | null; slogan: string | null };
  contact: { name: string | null; phone: string | null };
  qrDataUrl: string;
}

export default function CardClient({ student, dojo, contact, qrDataUrl }: CardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const initials = student.fullName.split(/\s+/).slice(0, 2).map(n => n[0]?.toUpperCase() ?? "").join("");
  const teamName = `TEAM ${dojo.name.toUpperCase()}`;

  async function downloadPDF() {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(cardRef.current, {
        scale: 4, useCORS: true, allowTaint: false, logging: false,
        backgroundColor: "#FFFFFF", imageTimeout: 15000, width: W, height: H,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [55, 85] });
      pdf.addImage(imgData, "JPEG", 0, 0, 55, 85);
      pdf.save(`carnet-${student.studentId}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Error al generar el PDF. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ═══════════════════════════════════════════════════════
          CARNET  385 × 595 px  (55 × 85 mm)
          ═══════════════════════════════════════════════════════ */}
      <div
        ref={cardRef}
        style={{
          position: "relative",
          width: W, height: H,
          background: "#ffffff",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
          fontFamily: "'Montserrat','Segoe UI',sans-serif",
          flexShrink: 0,
        }}
      >

        {/* Fondo con gradiente sutil */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(160deg,#f7f7f7 0%,#ffffff 55%,#f2f2f2 100%)",
        }} />

        {/* NEGRO abstracto — esquina superior-izquierda */}
        <div style={{
          position: "absolute", top: 0, left: 0,
          width: 185, height: 180,
          background: DARK,
          clipPath: "polygon(0 0,78% 0,58% 44%,42% 100%,0 100%)",
          opacity: 0.93,
        }} />
        <div style={{
          position: "absolute", top: 0, left: 0,
          width: 118, height: 135,
          background: DARK,
          clipPath: "polygon(0 0,100% 0,72% 100%,0 100%)",
        }} />
        <div style={{
          position: "absolute", top: 125, left: -8,
          width: 16, height: 90,
          background: DARK, opacity: 0.15, borderRadius: 4,
          transform: "rotate(-7deg)",
        }} />
        {/* Anillos decorativos sobre el negro */}
        <div style={{
          position: "absolute", top: 3, left: 3,
          width: 52, height: 52, borderRadius: "50%",
          border: "1.5px solid rgba(255,255,255,0.09)",
        }} />
        <div style={{
          position: "absolute", top: 14, left: 14,
          width: 28, height: 28, borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.07)",
        }} />

        {/* ROJO — salpicaduras esquina superior-derecha */}
        <div style={{
          position: "absolute", top: 0, right: 0,
          width: 230, height: 295,
          background: RED,
          clipPath: "polygon(100% 0,100% 66%,58% 44%,68% 94%,42% 100%,32% 76%,48% 52%,20% 30%,30% 0)",
        }} />
        <div style={{
          position: "absolute", top: 0, right: 0,
          width: 138, height: 168,
          background: RED,
          clipPath: "polygon(100% 0,100% 100%,28% 62%,48% 0)",
          opacity: 0.78,
        }} />
        <div style={{
          position: "absolute", top: 0, right: 0,
          width: 72, height: 72, background: RED, opacity: 0.92,
        }} />
        {/* Gotas de tinta */}
        <div style={{
          position: "absolute", top: 205, right: 36,
          width: 10, height: 23,
          background: RED, borderRadius: "50% 50% 62% 62%",
          transform: "rotate(-16deg)",
        }} />
        <div style={{
          position: "absolute", top: 234, right: 54,
          width: 7, height: 16,
          background: RED, borderRadius: "50% 50% 62% 62%",
          transform: "rotate(11deg)", opacity: 0.72,
        }} />
        <div style={{
          position: "absolute", top: 263, right: 28,
          width: 5, height: 11,
          background: RED, borderRadius: "50% 50% 62% 62%",
          transform: "rotate(-4deg)", opacity: 0.55,
        }} />

        {/* LOGO del dojo — arriba-izquierda sobre el negro */}
        <div style={{
          position: "absolute", top: 8, left: 10, zIndex: 10,
          maxWidth: 150, display: "flex", flexDirection: "column",
          alignItems: "flex-start",
        }}>
          {dojo.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dojo.logo} alt={dojo.name} crossOrigin="anonymous"
              style={{ height: 95, width: "auto", maxWidth: 148, objectFit: "contain" }} />
          ) : (
            <>
              <ToriiSVG size={40} color="#fff" />
              <div style={{ marginTop: 2 }}>
                <div style={{ fontSize: 7.5, fontWeight: 600, color: "rgba(255,255,255,0.72)", letterSpacing: "0.22em", textTransform: "uppercase" }}>DOJO</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{dojo.name}</div>
                <div style={{ marginTop: 4, width: 46, height: 1.5, background: RED, borderRadius: 2 }} />
                <div style={{ fontSize: 6, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.32em", marginTop: 3, textTransform: "uppercase" }}>KARATE DO</div>
              </div>
            </>
          )}
        </div>

        {/* FOTO — grande, centrada
            PHOTO_Y=60  PHOTO_D=174  →  bottom=234                */}
        {/* Anillo exterior decorativo */}
        <div style={{
          position: "absolute",
          top: PHOTO_Y - 10, left: PHOTO_X - 10,
          width: PHOTO_D + 20, height: PHOTO_D + 20,
          borderRadius: "50%",
          border: "2px solid rgba(217,4,22,0.22)",
          zIndex: 8,
        }} />
        {/* Marco rojo prominente */}
        <div style={{
          position: "absolute",
          top: PHOTO_Y - 6, left: PHOTO_X - 6,
          width: PHOTO_D + 12, height: PHOTO_D + 12,
          borderRadius: "50%",
          border: `6px solid ${RED}`,
          zIndex: 9,
          boxShadow: `0 8px 32px rgba(217,4,22,0.38)`,
        }} />
        {/* Círculo con la foto */}
        <div style={{
          position: "absolute",
          top: PHOTO_Y, left: PHOTO_X,
          width: PHOTO_D, height: PHOTO_D,
          borderRadius: "50%",
          overflow: "hidden",
          background: "#C8C8C8",
          zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {student.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={student.photo} alt={student.fullName} crossOrigin="anonymous"
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 62, fontWeight: 800, color: "#777" }}>{initials}</span>
          )}
        </div>

        {/* BADGE ID — derecha, zona inferior de la foto
            PHOTO_Y + 95 = 155                                     */}
        <div style={{
          position: "absolute",
          top: PHOTO_Y + 95, right: 14,
          zIndex: 11,
          background: RED,
          borderRadius: 9, padding: "9px 15px",
          textAlign: "center",
          boxShadow: "0 6px 20px rgba(217,4,22,0.50)",
        }}>
          <div style={{ fontSize: 7, fontWeight: 600, color: "rgba(255,255,255,0.72)", letterSpacing: "0.22em", textTransform: "uppercase" }}>ID</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "0.04em", marginTop: 1 }}>{student.studentId}</div>
        </div>

        {/* NOMBRE DEL ALUMNO
            top = PHOTO_Y + PHOTO_D + 12 = 60+174+12 = 246        */}
        <div style={{
          position: "absolute",
          top: PHOTO_Y + PHOTO_D + 12,
          left: 14, right: 14,
          zIndex: 10,
          textAlign: "center",
        }}>
          <div style={{
            fontSize: 27, fontWeight: 800, color: DARK,
            letterSpacing: "0.4px", lineHeight: 1.1,
            textTransform: "uppercase", wordBreak: "break-word",
          }}>
            {student.fullName}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, justifyContent: "center" }}>
            <div style={{ height: 1.5, width: 28, background: RED, borderRadius: 2 }} />
            <span style={{ fontSize: 8.5, fontWeight: 700, color: RED, letterSpacing: "0.38em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              {teamName}
            </span>
            <div style={{ height: 1.5, width: 28, background: RED, borderRadius: 2 }} />
          </div>
        </div>

        {/* Kanji decorativo de fondo */}
        <div style={{
          position: "absolute", left: 14, top: 285,
          writingMode: "vertical-rl" as const,
          fontSize: 52, fontWeight: 900, color: DARK,
          opacity: 0.045, letterSpacing: "0.04em",
          userSelect: "none", pointerEvents: "none", zIndex: 3,
        }}>道場夏月</div>

        {/* SECCIÓN QR
            QR_TOP=335, QR_H=200, bottom=535                      */}
        <div style={{
          position: "absolute",
          top: QR_TOP, left: 0, right: 0, height: QR_H,
          zIndex: 10,
          display: "flex", alignItems: "stretch",
          padding: "0 13px",
          gap: 6,
          boxSizing: "border-box" as const,
        }}>
          {/* Columna izq: kanji + lema */}
          <div style={{
            width: 40, flexShrink: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 8,
          }}>
            <div style={{
              writingMode: "vertical-rl" as const, transform: "rotate(180deg)",
              fontSize: 21, fontWeight: 900, color: DARK,
              opacity: 0.28, letterSpacing: "0.06em", userSelect: "none",
            }}>道場夏月</div>
            <div style={{
              writingMode: "vertical-lr" as const, transform: "rotate(180deg)",
              fontSize: 5.5, fontWeight: 600, color: "#999",
              letterSpacing: "0.30em", textTransform: "uppercase",
              opacity: 0.8, whiteSpace: "nowrap",
            }}>DISCIPLINA · RESPETO · CONSTANCIA</div>
          </div>

          {/* QR Box con MARCO ROJO
              Ancho: 385-13-13-40-6-6-34 = 273px
              Imagen limitada a 158×158px
              Check h: 4+10+158+5+10+8+4 = 199 < 200 ✓           */}
          <div style={{
            flex: 1,
            background: "#ffffff",
            border: `4px solid ${RED}`,
            borderRadius: 13,
            padding: "10px 10px 8px",
            boxShadow: `0 4px 22px rgba(217,4,22,0.18)`,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 5, overflow: "hidden",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="QR"
              style={{
                width: "100%",
                maxWidth: 158, maxHeight: 158,
                height: "auto", display: "block",
              }}
            />
            <div style={{ fontSize: 5.5, color: "#ccc", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              escanear · scan · スキャン
            </div>
          </div>

          {/* Columna der: pill contacto */}
          {(contact.name || contact.phone) ? (
            <div style={{ width: 34, flexShrink: 0 }}>
              <div style={{
                width: "100%", height: "100%",
                background: "#fff",
                border: `2px solid ${RED}`,
                borderRadius: 999, padding: "10px 0",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 5, boxSizing: "border-box" as const,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill={RED}>
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
                {contact.name && (
                  <div style={{
                    writingMode: "vertical-lr" as const, transform: "rotate(180deg)",
                    fontSize: 7, fontWeight: 700, color: DARK,
                    lineHeight: 1.2, textAlign: "center",
                    maxHeight: 105, overflow: "hidden",
                  }}>{contact.name}</div>
                )}
                {contact.phone && (
                  <div style={{
                    writingMode: "vertical-lr" as const, transform: "rotate(180deg)",
                    fontSize: 7, fontWeight: 500, color: "#555",
                    maxHeight: 60, overflow: "hidden",
                  }}>{contact.phone}</div>
                )}
                <svg width="12" height="12" viewBox="0 0 24 24" fill={RED}>
                  <circle cx="12" cy="4" r="2.5"/>
                  <path d="M15,9H9c-1.1,0-2,.9-2,2v5h2v-4h1v10h2v-5h1v5h2V12h1v4h2v-5C19,9.9,16.1,9,15,9z"/>
                </svg>
              </div>
            </div>
          ) : (
            <div style={{ width: 34, flexShrink: 0 }} />
          )}
        </div>

        {/* FOOTER
            FOOTER_TOP=540, height=55, bottom=595 ✓               */}
        <div style={{
          position: "absolute",
          top: FOOTER_TOP, left: 0, right: 0, height: H - FOOTER_TOP,
          zIndex: 10,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          borderTop: "1.5px solid #e0e0e0",
          gap: 2,
        }}>
          <ToriiSVG size={18} color={DARK} />
          <div style={{ fontSize: 6.5, color: "#aaa", letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 1 }}>
            PERFECCIONA TU CARÁCTER CON
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: RED, letterSpacing: "0.20em", textTransform: "uppercase" }}>
            DISCIPLINA Y CONSTANCIA
          </div>
        </div>

      </div>{/* fin card */}

      {/* Botón descarga */}
      <button
        onClick={() => void downloadPDF()}
        disabled={busy}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          background: busy ? "#a00010" : RED, color: "#fff",
          border: "none", borderRadius: 14, padding: "14px 36px",
          fontSize: 15, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
          letterSpacing: "0.04em", fontFamily: "'Montserrat',sans-serif",
          boxShadow: "0 8px 24px rgba(217,4,22,0.4)", transition: "background 0.2s",
        }}
      >
        {busy ? (
          <><Spinner /> Generando PDF...</>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Descargar Carnet PDF
          </>
        )}
      </button>

      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center", maxWidth: 320 }}>
        Comparte este enlace o escanea el QR para verificar el carnet desde cualquier cámara.
      </p>
    </>
  );
}
