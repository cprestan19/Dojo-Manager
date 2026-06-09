"use client";

import { useRef, useState } from "react";

/* ── SVG Torii ─────────────────────────────────────────────── */
function ToriiGate() {
  return (
    <svg viewBox="0 0 240 200" style={{ width: "100%", height: "100%" }} fill="currentColor">
      {/* columnas */}
      <rect x="38"  y="68"  width="14" height="132" rx="4" />
      <rect x="188" y="68"  width="14" height="132" rx="4" />
      {/* kasagi curvo superior */}
      <path d="M10,72 Q120,28 230,72 L230,86 Q120,42 10,86 Z" />
      {/* shimaki */}
      <rect x="24" y="86" width="192" height="10" rx="3" />
      {/* nuki central */}
      <rect x="44" y="108" width="152" height="12" rx="4" />
      {/* terminales columnas */}
      <ellipse cx="45"  cy="68" rx="11" ry="7" />
      <ellipse cx="195" cy="68" rx="11" ry="7" />
    </svg>
  );
}

/* ── Icono teléfono ──────────────────────────────────────────  */
function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#D90416">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
    </svg>
  );
}

/* ── Icono persona/karate ────────────────────────────────────  */
function KarateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#D90416">
      <circle cx="12" cy="4" r="2.5" />
      <path d="M15,9H9c-1.1,0-2,.9-2,2v5h2v-4h1v10h2v-5h1v5h2V12h1v4h2v-5C19,9.9,16.1,9,15,9z" />
    </svg>
  );
}

/* ── Spinner ─────────────────────────────────────────────────  */
function Spinner() {
  return (
    <span style={{
      display: "inline-block",
      width: 18, height: 18,
      border: "3px solid rgba(255,255,255,0.3)",
      borderTopColor: "#fff",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }} />
  );
}

/* ── Types ───────────────────────────────────────────────────  */
interface CardProps {
  student: {
    fullName: string;
    studentCode: number;
    studentId: string;
    photo: string | null;
    beltColor: string;
    active: boolean;
  };
  dojo: {
    name: string;
    logo: string | null;
    phone: string | null;
    slogan: string | null;
  };
  contact: { name: string | null; phone: string | null };
  qrDataUrl: string;
}

const RED  = "#D90416";
const DARK = "#0A0A0A";
const GRAY = "#F3F3F3";

export default function CardClient({ student, dojo, contact, qrDataUrl }: CardProps) {
  const cardRef   = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const initials  = student.fullName.split(/\s+/).slice(0, 2).map(n => n[0]?.toUpperCase() ?? "").join("");
  const teamName  = `TEAM ${dojo.name.toUpperCase()}`;

  /* ── PDF Download ────────────────────────────────────────── */
  async function downloadPDF() {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: "#FFFFFF",
        imageTimeout: 15000,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.97);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const cardW  = pw - margin * 2;
      const cardH  = (canvas.height / canvas.width) * cardW;
      const y      = (ph - cardH) / 2;

      pdf.addImage(imgData, "JPEG", margin, y, cardW, cardH);
      pdf.save(`carnet-${student.studentId}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Error al generar el PDF. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  /* ── Card ────────────────────────────────────────────────── */
  return (
    <>
      {/* Estilos globales para la animación */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Card */}
      <div
        ref={cardRef}
        style={{
          position: "relative",
          width: 480,
          background: `linear-gradient(170deg, #FFFFFF 0%, ${GRAY} 100%)`,
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          fontFamily: "'Montserrat', 'Segoe UI', sans-serif",
        }}
      >

        {/* ══ FONDO DECORATIVO ════════════════════════════════ */}

        {/* Splash rojo top-right */}
        <div style={{
          position: "absolute", top: 0, right: 0,
          width: 240, height: 300,
          background: RED,
          clipPath: "polygon(100% 0, 100% 60%, 42% 95%, 55% 45%, 22% 0)",
        }} />
        <div style={{
          position: "absolute", top: 0, right: 0,
          width: 130, height: 170,
          background: RED,
          clipPath: "polygon(100% 0, 100% 100%, 0% 45%)",
          opacity: 0.7,
        }} />
        {/* Gota de tinta */}
        <div style={{
          position: "absolute", top: 210, right: 58,
          width: 12, height: 28,
          background: RED,
          borderRadius: "50% 50% 60% 60%",
          transform: "rotate(-12deg)",
        }} />
        <div style={{
          position: "absolute", top: 242, right: 70,
          width: 8, height: 18,
          background: RED,
          borderRadius: "50% 50% 60% 60%",
          transform: "rotate(8deg)",
          opacity: 0.7,
        }} />

        {/* Círculos decorativos top-left */}
        <div style={{
          position: "absolute", top: -38, left: -38,
          width: 140, height: 140, borderRadius: "50%",
          border: `3px solid ${DARK}`, opacity: 0.06,
        }} />
        <div style={{
          position: "absolute", top: 8, left: 8,
          width: 70, height: 70, borderRadius: "50%",
          border: `2px solid ${DARK}`, opacity: 0.05,
        }} />

        {/* Kanji vertical (decorativo, fondo) */}
        <div style={{
          position: "absolute",
          left: 10, top: "44%",
          writingMode: "vertical-rl" as const,
          fontSize: 68,
          fontWeight: 900,
          color: DARK,
          opacity: 0.055,
          letterSpacing: "0.04em",
          userSelect: "none",
          pointerEvents: "none",
        }}>
          道場夏月
        </div>

        {/* Torii (fondo, muy suave) */}
        <div style={{
          position: "absolute",
          bottom: 56, left: "50%",
          transform: "translateX(-50%)",
          width: 130, height: 110,
          color: DARK, opacity: 0.055,
          pointerEvents: "none",
        }}>
          <ToriiGate />
        </div>

        {/* ══ CONTENIDO PRINCIPAL ═════════════════════════════ */}
        <div style={{ position: "relative", zIndex: 1, padding: "22px 22px 20px" }}>

          {/* ── Fila top: logo + badge ID ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>

            {/* Logo / nombre dojo */}
            {dojo.logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={dojo.logo}
                alt={dojo.name}
                crossOrigin="anonymous"
                style={{ height: 72, width: "auto", objectFit: "contain", maxWidth: 140 }}
              />
            ) : (
              <div>
                <div style={{ fontSize: 9, fontWeight: 600, color: RED, letterSpacing: "0.35em", textTransform: "uppercase" }}>DOJO</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: DARK, lineHeight: 1.1, maxWidth: 130 }}>{dojo.name}</div>
                <div style={{ marginTop: 5, width: 56, height: 2.5, background: RED, borderRadius: 2 }} />
                <div style={{ fontSize: 8, fontWeight: 600, color: "#777", letterSpacing: "0.25em", marginTop: 3, textTransform: "uppercase" }}>KARATE DO</div>
              </div>
            )}

            {/* Badge ID */}
            <div style={{
              background: RED,
              borderRadius: 10,
              padding: "10px 18px",
              textAlign: "center",
              marginTop: 44,
              minWidth: 88,
              boxShadow: "0 6px 20px rgba(217,4,22,0.4)",
            }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.75)", letterSpacing: "0.2em", textTransform: "uppercase" }}>ID</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.06em", marginTop: 2 }}>{student.studentId}</div>
            </div>
          </div>

          {/* ── Foto centrada con logo en esquina ── */}
          <div style={{ display: "flex", justifyContent: "center", margin: "14px 0 20px" }}>
            <div style={{ position: "relative", width: 250, height: 250, flexShrink: 0 }}>

              {/* Foto circular */}
              <div style={{
                width: 250,
                height: 250,
                borderRadius: "50%",
                border: `8px solid ${RED}`,
                overflow: "hidden",
                boxShadow: "0 18px 48px rgba(0,0,0,0.30)",
                background: "#D9D9D9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                {student.photo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={student.photo}
                    alt={student.fullName}
                    crossOrigin="anonymous"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ fontSize: 72, fontWeight: 800, color: "#888" }}>{initials}</span>
                )}
              </div>

              {/* Logo del dojo — badge esquina inferior derecha */}
              <div style={{
                position: "absolute",
                bottom: 8,
                right: 8,
                width: 58,
                height: 58,
                borderRadius: "50%",
                background: "#FFFFFF",
                border: `3px solid ${RED}`,
                boxShadow: "0 4px 16px rgba(0,0,0,0.22)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                padding: dojo.logo ? 4 : 0,
              }}>
                {dojo.logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={dojo.logo}
                    alt={dojo.name}
                    crossOrigin="anonymous"
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <span style={{
                    fontSize: 16, fontWeight: 900,
                    color: RED, letterSpacing: "-0.5px",
                  }}>
                    {dojo.name.split(/\s+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0].toUpperCase()).join("")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Nombre ── */}
          <div style={{ textAlign: "center", marginBottom: 10 }}>
            <div style={{
              fontSize: 34,
              fontWeight: 800,
              color: DARK,
              letterSpacing: "0.5px",
              lineHeight: 1.1,
              textTransform: "uppercase",
              wordBreak: "break-word",
            }}>
              {student.fullName}
            </div>

            {/* Team con líneas */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 10 }}>
              <div style={{ height: 1.5, width: 44, background: RED, borderRadius: 2 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: RED, letterSpacing: "0.4em", textTransform: "uppercase" }}>
                {teamName}
              </span>
              <div style={{ height: 1.5, width: 44, background: RED, borderRadius: 2 }} />
            </div>
          </div>

          {/* ── Sección QR + Contacto ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 16px" }}>

            {/* Columna izquierda: texto vertical */}
            <div style={{
              width: 28, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              alignSelf: "stretch",
            }}>
              <div style={{
                writingMode: "vertical-lr" as const,
                transform: "rotate(180deg)",
                fontSize: 7.5,
                fontWeight: 600,
                color: "#555",
                letterSpacing: "0.35em",
                textTransform: "uppercase",
                opacity: 0.65,
                whiteSpace: "nowrap",
              }}>
                DISCIPLINA · RESPETO · CONSTANCIA
              </div>
            </div>

            {/* QR Code */}
            <div style={{
              flex: 1,
              background: "#FFFFFF",
              borderRadius: 22,
              border: `3.5px solid ${RED}`,
              padding: 14,
              boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR Carnet"
                style={{ width: "100%", height: "auto", display: "block" }}
              />
              <div style={{ fontSize: 8, color: "#999", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                escanear · scan · スキャン
              </div>
            </div>

            {/* Columna derecha: pill de contacto */}
            {(contact.name || contact.phone) ? (
              <div style={{
                width: 38, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                alignSelf: "stretch",
              }}>
                <div style={{
                  background: "#FFFFFF",
                  border: `2.5px solid ${RED}`,
                  borderRadius: 999,
                  padding: "14px 10px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  height: "100%",
                  minHeight: 130,
                  boxSizing: "border-box" as const,
                }}>
                  <KarateIcon />
                  {contact.name && (
                    <div style={{
                      writingMode: "vertical-lr" as const,
                      transform: "rotate(180deg)",
                      fontSize: 9, fontWeight: 700, color: DARK,
                      lineHeight: 1.2, textAlign: "center",
                    }}>
                      {contact.name}
                    </div>
                  )}
                  {contact.phone && (
                    <div style={{
                      writingMode: "vertical-lr" as const,
                      transform: "rotate(180deg)",
                      fontSize: 9, fontWeight: 500, color: "#555",
                      letterSpacing: "0.05em",
                    }}>
                      {contact.phone}
                    </div>
                  )}
                  <PhoneIcon />
                </div>
              </div>
            ) : (
              <div style={{ width: 38, flexShrink: 0 }} />
            )}
          </div>

          {/* ── Pie del carnet ── */}
          <div style={{
            textAlign: "center",
            borderTop: `1px solid #E0E0E0`,
            paddingTop: 14,
          }}>
            <div style={{ fontSize: 9, color: "#999", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 4 }}>
              PERFECCIONA TU CARÁCTER CON
            </div>
            <div style={{
              fontSize: 13, fontWeight: 800, color: RED,
              letterSpacing: "0.22em", textTransform: "uppercase",
            }}>
              DISCIPLINA Y CONSTANCIA
            </div>
          </div>
        </div>
      </div>

      {/* ── Botón descarga ── */}
      <button
        onClick={() => void downloadPDF()}
        disabled={busy}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: busy ? "#a00010" : RED,
          color: "#FFFFFF",
          border: "none",
          borderRadius: 14,
          padding: "14px 36px",
          fontSize: 15,
          fontWeight: 700,
          cursor: busy ? "not-allowed" : "pointer",
          letterSpacing: "0.04em",
          fontFamily: "'Montserrat', sans-serif",
          boxShadow: "0 8px 24px rgba(217,4,22,0.4)",
          transition: "background 0.2s",
        }}
      >
        {busy ? (
          <>
            <Spinner />
            Generando PDF...
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Descargar Carnet PDF
          </>
        )}
      </button>

      {/* Instrucción share */}
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center", maxWidth: 320 }}>
        Comparte este enlace o el QR del carnet para que cualquier persona pueda verificarlo desde su cámara.
      </p>
    </>
  );
}
