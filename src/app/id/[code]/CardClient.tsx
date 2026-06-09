"use client";

import { useRef, useState } from "react";

// 55×85mm a 7px/mm → 385×595px en pantalla
// Layout vertical (px):
//   pad-top 16 | logo-row 60 | gap 10 | photo 140 | gap 10 |
//   name 50 | gap 8 | qr-section 249 | footer 36 | pad-bot 16
//   = 595 exacto

const W = 385;
const H = 595;
const RED  = "#D90416";
const DARK = "#0A0A0A";

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
  const [busy, setBusy]   = useState(false);

  const initials    = student.fullName.split(/\s+/).slice(0, 2).map(n => n[0]?.toUpperCase() ?? "").join("");
  const teamName    = `TEAM ${dojo.name.toUpperCase()}`;
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

      {/* ── CARD 385×595px ────────────────────────────────────── */}
      <div
        ref={cardRef}
        style={{
          position: "relative",
          width: W, height: H,
          background: "linear-gradient(170deg,#ffffff 0%,#f3f3f3 100%)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
          fontFamily: "'Montserrat','Segoe UI',sans-serif",
          flexShrink: 0,
        }}
      >

        {/* ── DECORATIVOS (absolute, no empujan layout) ─────── */}

        {/* Negro abstracto top-right — capas base */}
        <div style={{ position:"absolute", top:0, right:0, width:220, height:160,
          background:DARK, clipPath:"polygon(100% 0,100% 100%,48% 0)", opacity:0.9 }} />
        <div style={{ position:"absolute", top:0, right:0, width:80, height:80,
          background:DARK, opacity:0.95 }} />
        {/* Barra diagonal negra */}
        <div style={{ position:"absolute", top:-8, right:52, width:14, height:200,
          background:DARK, transform:"rotate(26deg)", transformOrigin:"top center",
          opacity:0.13, borderRadius:4 }} />

        {/* Rojo — splash encima del negro */}
        <div style={{ position:"absolute", top:0, right:0, width:180, height:220,
          background:RED, clipPath:"polygon(100% 0,100% 55%,40% 92%,52% 42%,20% 0)" }} />
        <div style={{ position:"absolute", top:0, right:0, width:96, height:124,
          background:RED, clipPath:"polygon(100% 0,100% 100%,0% 42%)", opacity:0.72 }} />
        {/* Gotas */}
        <div style={{ position:"absolute", top:154, right:42, width:9, height:20,
          background:RED, borderRadius:"50% 50% 60% 60%", transform:"rotate(-12deg)" }} />
        <div style={{ position:"absolute", top:177, right:51, width:6, height:13,
          background:RED, borderRadius:"50% 50% 60% 60%", transform:"rotate(8deg)", opacity:0.7 }} />

        {/* Círculos sutiles top-left */}
        <div style={{ position:"absolute", top:-26, left:-26, width:100, height:100,
          borderRadius:"50%", border:`2px solid ${DARK}`, opacity:0.06 }} />
        <div style={{ position:"absolute", top:5, left:5, width:50, height:50,
          borderRadius:"50%", border:`1.5px solid ${DARK}`, opacity:0.05 }} />

        {/* Kanji decorativo fondo */}
        <div style={{ position:"absolute", left:7, top:"43%",
          writingMode:"vertical-rl" as const, fontSize:50, fontWeight:900,
          color:DARK, opacity:0.05, letterSpacing:"0.04em",
          userSelect:"none", pointerEvents:"none" }}>道場夏月</div>

        {/* Torii fondo */}
        <div style={{ position:"absolute", bottom:42, left:"50%",
          transform:"translateX(-50%)", width:96, height:82,
          color:DARK, opacity:0.05, pointerEvents:"none" }}>
          <ToriiGate />
        </div>

        {/* ── CONTENIDO PRINCIPAL (relative, flex column) ────── */}
        <div style={{
          position:"relative", zIndex:1,
          width:"100%", height:"100%",
          padding:"16px 18px",
          boxSizing:"border-box" as const,
          display:"flex", flexDirection:"column",
          gap:0,
        }}>

          {/* ① Logo row — altura fija 60px */}
          <div style={{
            height:60, flexShrink:0,
            display:"flex", justifyContent:"space-between", alignItems:"flex-start",
          }}>
            {/* Logo arriba-izquierda */}
            {dojo.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dojo.logo} alt={dojo.name} crossOrigin="anonymous"
                style={{ height:50, width:"auto", objectFit:"contain", maxWidth:110 }} />
            ) : (
              <div style={{ paddingTop:2 }}>
                <div style={{ fontSize:6.5, fontWeight:600, color:RED, letterSpacing:"0.3em", textTransform:"uppercase" }}>DOJO</div>
                <div style={{ fontSize:14, fontWeight:800, color:DARK, lineHeight:1.15, maxWidth:100 }}>{dojo.name}</div>
                <div style={{ marginTop:3, width:42, height:1.5, background:RED, borderRadius:2 }} />
                <div style={{ fontSize:5.5, fontWeight:600, color:"#777", letterSpacing:"0.22em", marginTop:2, textTransform:"uppercase" }}>KARATE DO</div>
              </div>
            )}

            {/* Badge ID */}
            <div style={{
              background:RED, borderRadius:7, padding:"7px 13px",
              textAlign:"center", marginTop:22, flexShrink:0,
              boxShadow:"0 4px 14px rgba(217,4,22,0.45)",
            }}>
              <div style={{ fontSize:6.5, fontWeight:600, color:"rgba(255,255,255,0.75)", letterSpacing:"0.18em", textTransform:"uppercase" }}>ID</div>
              <div style={{ fontSize:14, fontWeight:800, color:"#fff", letterSpacing:"0.06em", marginTop:1 }}>{student.studentId}</div>
            </div>
          </div>

          {/* GAP 10 */}
          <div style={{ height:10, flexShrink:0 }} />

          {/* ② Foto — altura fija 140px (círculo 130px + border 5px × 2) */}
          <div style={{ height:140, flexShrink:0, display:"flex", justifyContent:"center", alignItems:"center" }}>
            <div style={{
              width:130, height:130, borderRadius:"50%",
              border:`5px solid ${RED}`,
              overflow:"hidden",
              boxShadow:"0 12px 36px rgba(0,0,0,0.30)",
              background:"#D9D9D9",
              display:"flex", alignItems:"center", justifyContent:"center",
              flexShrink:0,
            }}>
              {student.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={student.photo} alt={student.fullName} crossOrigin="anonymous"
                  style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              ) : (
                <span style={{ fontSize:44, fontWeight:800, color:"#888" }}>{initials}</span>
              )}
            </div>
          </div>

          {/* GAP 10 */}
          <div style={{ height:10, flexShrink:0 }} />

          {/* ③ Nombre — altura fija 50px */}
          <div style={{ height:50, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
            <div style={{
              fontSize:22, fontWeight:800, color:DARK,
              letterSpacing:"0.4px", lineHeight:1.1,
              textTransform:"uppercase", textAlign:"center",
              wordBreak:"break-word", width:"100%",
            }}>
              {student.fullName}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6 }}>
              <div style={{ height:1.5, width:28, background:RED, borderRadius:2 }} />
              <span style={{ fontSize:8.5, fontWeight:600, color:RED, letterSpacing:"0.38em", textTransform:"uppercase", whiteSpace:"nowrap" }}>{teamName}</span>
              <div style={{ height:1.5, width:28, background:RED, borderRadius:2 }} />
            </div>
          </div>

          {/* GAP 8 */}
          <div style={{ height:8, flexShrink:0 }} />

          {/* ④ QR section — ocupa 249px exactos (595-16-60-10-140-10-50-8-36-16) */}
          <div style={{
            height:249, flexShrink:0,
            display:"flex", alignItems:"stretch", gap:7,
          }}>
            {/* Texto vertical izquierda */}
            <div style={{ width:16, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{
                writingMode:"vertical-lr" as const, transform:"rotate(180deg)",
                fontSize:5, fontWeight:600, color:"#666",
                letterSpacing:"0.3em", textTransform:"uppercase",
                opacity:0.6, whiteSpace:"nowrap",
              }}>DISCIPLINA · RESPETO · CONSTANCIA</div>
            </div>

            {/* QR Code — ancho flex:1, alto 249px contenido */}
            <div style={{
              flex:1,
              background:"#fff",
              borderRadius:14, border:`3px solid ${RED}`,
              padding:"8px 8px 6px",
              boxShadow:"0 4px 18px rgba(0,0,0,0.11)",
              display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center",
              gap:5, overflow:"hidden",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR"
                style={{
                  // Máx 195px para que quepa: 195 + 8+8 pad + 5 gap + 10 text = 226 < 249
                  width:"100%", maxWidth:195,
                  height:"auto", display:"block",
                }}
              />
              <div style={{ fontSize:5.5, color:"#aaa", letterSpacing:"0.18em", textTransform:"uppercase" }}>
                escanear · scan · スキャン
              </div>
            </div>

            {/* Pill contacto derecha */}
            {(contact.name || contact.phone) ? (
              <div style={{ width:26, flexShrink:0, display:"flex", alignItems:"stretch" }}>
                <div style={{
                  width:"100%",
                  background:"#fff", border:`2px solid ${RED}`,
                  borderRadius:999, padding:"9px 6px",
                  display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center",
                  gap:4, boxSizing:"border-box" as const,
                }}>
                  {/* Icono karate */}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill={RED}>
                    <circle cx="12" cy="4" r="2.5" />
                    <path d="M15,9H9c-1.1,0-2,.9-2,2v5h2v-4h1v10h2v-5h1v5h2V12h1v4h2v-5C19,9.9,16.1,9,15,9z" />
                  </svg>
                  {contact.name && (
                    <div style={{ writingMode:"vertical-lr" as const, transform:"rotate(180deg)",
                      fontSize:6.5, fontWeight:700, color:DARK, lineHeight:1.2, textAlign:"center" }}>
                      {contact.name}
                    </div>
                  )}
                  {contact.phone && (
                    <div style={{ writingMode:"vertical-lr" as const, transform:"rotate(180deg)",
                      fontSize:6.5, fontWeight:500, color:"#555" }}>
                      {contact.phone}
                    </div>
                  )}
                  {/* Icono teléfono */}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill={RED}>
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                  </svg>
                </div>
              </div>
            ) : (
              <div style={{ width:26, flexShrink:0 }} />
            )}
          </div>

          {/* ⑤ Footer — altura fija 36px */}
          <div style={{
            height:36, flexShrink:0,
            display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center",
            borderTop:"1px solid #e0e0e0", marginTop:0,
          }}>
            <div style={{ fontSize:6.5, color:"#aaa", letterSpacing:"0.16em", textTransform:"uppercase", marginBottom:2 }}>
              PERFECCIONA TU CARÁCTER CON
            </div>
            <div style={{ fontSize:9, fontWeight:800, color:RED, letterSpacing:"0.2em", textTransform:"uppercase" }}>
              DISCIPLINA Y CONSTANCIA
            </div>
          </div>

        </div>{/* fin contenido */}
      </div>{/* fin card */}

      {/* Botón descarga */}
      <button
        onClick={() => void downloadPDF()}
        disabled={busy}
        style={{
          display:"flex", alignItems:"center", gap:12,
          background: busy ? "#a00010" : RED, color:"#fff",
          border:"none", borderRadius:14, padding:"14px 36px",
          fontSize:15, fontWeight:700, cursor: busy ? "not-allowed" : "pointer",
          letterSpacing:"0.04em", fontFamily:"'Montserrat',sans-serif",
          boxShadow:"0 8px 24px rgba(217,4,22,0.4)", transition:"background 0.2s",
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

      <p style={{ fontSize:12, color:"rgba(255,255,255,0.4)", textAlign:"center", maxWidth:320 }}>
        Comparte este enlace o escanea el QR para verificar el carnet desde cualquier cámara.
      </p>
    </>
  );
}
