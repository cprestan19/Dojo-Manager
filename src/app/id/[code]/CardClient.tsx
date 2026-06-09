"use client";

import { useRef, useState } from "react";

// 55×85mm a 7px/mm = 385×595px (ratio exacto 55:85)
const W = 385;
const H = 595;

const RED  = "#D90416";
const DARK = "#0A0A0A";
const GRAY = "#F3F3F3";

function ToriiGate() {
  return (
    <svg viewBox="0 0 240 200" style={{ width: "100%", height: "100%" }} fill="currentColor">
      <rect x="38"  y="68"  width="14" height="132" rx="4" />
      <rect x="188" y="68"  width="14" height="132" rx="4" />
      <path d="M10,72 Q120,28 230,72 L230,86 Q120,42 10,86 Z" />
      <rect x="24" y="86" width="192" height="10" rx="3" />
      <rect x="44" y="108" width="152" height="12" rx="4" />
      <ellipse cx="45"  cy="68" rx="11" ry="7" />
      <ellipse cx="195" cy="68" rx="11" ry="7" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={RED}>
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
    </svg>
  );
}

function KarateIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={RED}>
      <circle cx="12" cy="4" r="2.5" />
      <path d="M15,9H9c-1.1,0-2,.9-2,2v5h2v-4h1v10h2v-5h1v5h2V12h1v4h2v-5C19,9.9,16.1,9,15,9z" />
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
  const dojoInitials = dojo.name.split(/\s+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0].toUpperCase()).join("");

  async function downloadPDF() {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(cardRef.current, {
        scale: 4,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: "#FFFFFF",
        imageTimeout: 15000,
        width: W,
        height: H,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      // PDF exactamente 55×85mm — tamaño carnet estándar ISO 7810
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

      {/* Card 385×595px = 55×85mm */}
      <div
        ref={cardRef}
        style={{
          position: "relative",
          width: W, height: H,
          background: `linear-gradient(170deg, #FFFFFF 0%, ${GRAY} 100%)`,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          fontFamily: "'Montserrat', 'Segoe UI', sans-serif",
          flexShrink: 0,
        }}
      >

        {/* ══ DECORATIVOS ════════════════════════════════════ */}

        {/* — Capa negra abstracta (base, detrás del rojo) — */}
        {/* Triángulo negro esquina top-right */}
        <div style={{
          position: "absolute", top: 0, right: 0,
          width: 260, height: 180,
          background: DARK,
          clipPath: "polygon(100% 0, 100% 100%, 55% 0)",
          opacity: 0.88,
        }} />
        {/* Barra negra diagonal */}
        <div style={{
          position: "absolute", top: -10, right: 60,
          width: 18, height: 220,
          background: DARK,
          transform: "rotate(28deg)",
          transformOrigin: "top center",
          opacity: 0.12,
          borderRadius: 4,
        }} />
        {/* Rectángulo negro esquina */}
        <div style={{
          position: "absolute", top: 0, right: 0,
          width: 90, height: 90,
          background: DARK,
          clipPath: "polygon(100% 0, 100% 100%, 0% 0)",
          opacity: 0.95,
        }} />

        {/* — Splash rojo (sobre el negro) — */}
        <div style={{
          position: "absolute", top: 0, right: 0,
          width: 192, height: 240, background: RED,
          clipPath: "polygon(100% 0, 100% 60%, 42% 95%, 55% 45%, 22% 0)",
        }} />
        <div style={{
          position: "absolute", top: 0, right: 0,
          width: 104, height: 136, background: RED,
          clipPath: "polygon(100% 0, 100% 100%, 0% 45%)",
          opacity: 0.75,
        }} />
        {/* Gotas de tinta roja */}
        <div style={{ position: "absolute", top: 168, right: 46, width: 10, height: 22, background: RED, borderRadius: "50% 50% 60% 60%", transform: "rotate(-12deg)" }} />
        <div style={{ position: "absolute", top: 194, right: 56, width: 6,  height: 14, background: RED, borderRadius: "50% 50% 60% 60%", transform: "rotate(8deg)", opacity: 0.7 }} />

        {/* Círculos decorativos top-left */}
        <div style={{ position: "absolute", top: -30, left: -30, width: 112, height: 112, borderRadius: "50%", border: `2.5px solid ${DARK}`, opacity: 0.06 }} />
        <div style={{ position: "absolute", top:   6, left:   6, width:  56, height:  56, borderRadius: "50%", border: `2px solid ${DARK}`,   opacity: 0.05 }} />

        {/* Kanji fondo */}
        <div style={{
          position: "absolute", left: 8, top: "44%",
          writingMode: "vertical-rl" as const,
          fontSize: 54, fontWeight: 900, color: DARK, opacity: 0.055,
          letterSpacing: "0.04em", userSelect: "none", pointerEvents: "none",
        }}>道場夏月</div>

        {/* Torii fondo */}
        <div style={{
          position: "absolute", bottom: 45, left: "50%",
          transform: "translateX(-50%)",
          width: 104, height: 88, color: DARK, opacity: 0.055, pointerEvents: "none",
        }}>
          <ToriiGate />
        </div>

        {/* ══ CONTENIDO ═══════════════════════════════════════ */}
        <div style={{
          position: "relative", zIndex: 1,
          padding: "18px 18px 16px",
          height: "100%", boxSizing: "border-box" as const,
          display: "flex", flexDirection: "column",
        }}>

          {/* Fila top: logo izquierda + badge ID derecha */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>

            {/* Logo arriba-izquierda */}
            {dojo.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dojo.logo} alt={dojo.name} crossOrigin="anonymous"
                style={{ height: 58, width: "auto", objectFit: "contain", maxWidth: 112 }} />
            ) : (
              <div>
                <div style={{ fontSize: 7, fontWeight: 600, color: RED, letterSpacing: "0.35em", textTransform: "uppercase" }}>DOJO</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: DARK, lineHeight: 1.1, maxWidth: 104 }}>{dojo.name}</div>
                <div style={{ marginTop: 4, width: 45, height: 2, background: RED, borderRadius: 2 }} />
                <div style={{ fontSize: 6, fontWeight: 600, color: "#777", letterSpacing: "0.25em", marginTop: 2, textTransform: "uppercase" }}>KARATE DO</div>
              </div>
            )}

            {/* Badge ID */}
            <div style={{
              background: RED, borderRadius: 8, padding: "8px 14px",
              textAlign: "center", marginTop: 35, minWidth: 70,
              boxShadow: "0 5px 16px rgba(217,4,22,0.4)",
            }}>
              <div style={{ fontSize: 7, fontWeight: 600, color: "rgba(255,255,255,0.75)", letterSpacing: "0.2em", textTransform: "uppercase" }}>ID</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.06em", marginTop: 1 }}>{student.studentId}</div>
            </div>
          </div>

          {/* Foto circular — sin badge */}
          <div style={{ display: "flex", justifyContent: "center", margin: "12px 0 14px", flexShrink: 0 }}>
            <div style={{
              width: 200, height: 200, borderRadius: "50%",
              border: `6px solid ${RED}`,
              overflow: "hidden",
              boxShadow: "0 14px 40px rgba(0,0,0,0.30)",
              background: "#D9D9D9",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {student.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={student.photo} alt={student.fullName} crossOrigin="anonymous"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 58, fontWeight: 800, color: "#888" }}>{initials}</span>
              )}
            </div>
          </div>

          {/* Nombre */}
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{
              fontSize: 27, fontWeight: 800, color: DARK,
              letterSpacing: "0.5px", lineHeight: 1.1,
              textTransform: "uppercase", wordBreak: "break-word",
            }}>
              {student.fullName}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 }}>
              <div style={{ height: 1.5, width: 35, background: RED, borderRadius: 2 }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: RED, letterSpacing: "0.4em", textTransform: "uppercase" }}>{teamName}</span>
              <div style={{ height: 1.5, width: 35, background: RED, borderRadius: 2 }} />
            </div>
          </div>

          {/* QR + Contacto */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 13px", flex: 1, minHeight: 0 }}>

            {/* Texto vertical izquierda */}
            <div style={{ width: 20, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "stretch" }}>
              <div style={{
                writingMode: "vertical-lr" as const, transform: "rotate(180deg)",
                fontSize: 5.5, fontWeight: 600, color: "#555",
                letterSpacing: "0.3em", textTransform: "uppercase",
                opacity: 0.65, whiteSpace: "nowrap",
              }}>
                DISCIPLINA · RESPETO · CONSTANCIA
              </div>
            </div>

            {/* QR */}
            <div style={{
              flex: 1, background: "#FFFFFF",
              borderRadius: 16, border: `3px solid ${RED}`,
              padding: 10, boxShadow: "0 5px 20px rgba(0,0,0,0.12)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR" style={{ width: "100%", height: "auto", display: "block" }} />
              <div style={{ fontSize: 6, color: "#999", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                escanear · scan · スキャン
              </div>
            </div>

            {/* Pill contacto */}
            {(contact.name || contact.phone) ? (
              <div style={{ width: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "stretch" }}>
                <div style={{
                  background: "#FFFFFF", border: `2px solid ${RED}`,
                  borderRadius: 999, padding: "10px 7px",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 4, height: "100%", minHeight: 100,
                  boxSizing: "border-box" as const,
                }}>
                  <KarateIcon />
                  {contact.name && (
                    <div style={{ writingMode: "vertical-lr" as const, transform: "rotate(180deg)", fontSize: 7, fontWeight: 700, color: DARK, lineHeight: 1.2, textAlign: "center" }}>
                      {contact.name}
                    </div>
                  )}
                  {contact.phone && (
                    <div style={{ writingMode: "vertical-lr" as const, transform: "rotate(180deg)", fontSize: 7, fontWeight: 500, color: "#555" }}>
                      {contact.phone}
                    </div>
                  )}
                  <PhoneIcon />
                </div>
              </div>
            ) : (
              <div style={{ width: 28, flexShrink: 0 }} />
            )}
          </div>

          {/* Pie */}
          <div style={{ textAlign: "center", borderTop: "1px solid #E0E0E0", paddingTop: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 7, color: "#999", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 3 }}>
              PERFECCIONA TU CARÁCTER CON
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: RED, letterSpacing: "0.22em", textTransform: "uppercase" }}>
              DISCIPLINA Y CONSTANCIA
            </div>
          </div>
        </div>
      </div>

      {/* Botón descarga */}
      <button
        onClick={() => void downloadPDF()}
        disabled={busy}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          background: busy ? "#a00010" : RED, color: "#FFFFFF",
          border: "none", borderRadius: 14, padding: "14px 36px",
          fontSize: 15, fontWeight: 700,
          cursor: busy ? "not-allowed" : "pointer",
          letterSpacing: "0.04em",
          fontFamily: "'Montserrat', sans-serif",
          boxShadow: "0 8px 24px rgba(217,4,22,0.4)",
          transition: "background 0.2s",
        }}
      >
        {busy ? (
          <><Spinner /> Generando PDF...</>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Descargar Carnet PDF
          </>
        )}
      </button>

      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center", maxWidth: 320 }}>
        Comparte este enlace o el QR del carnet para verificarlo desde cualquier cámara.
      </p>
    </>
  );
}
