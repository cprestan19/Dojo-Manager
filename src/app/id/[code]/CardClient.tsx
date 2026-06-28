"use client";

import { parseCardLayout, getFontStack, getGoogleFontsUrl, getCardDimensions, type CardLayout } from "@/lib/card-layout";

// ─── Dimensiones CR80 a 300 DPI ───────────────────────────────────────────────
// 54mm × 85.6mm → 638 × 1009 px  (300 DPI exacto)
// Impresión nativa via window.print() con @media print a 300 DPI
// En pantalla se escala al 60% con CSS transform
const W  = 638;
const H  = 1009;
const DS = 0.60;  // display scale → 383 × 605 px en pantalla

// ─── Paleta por defecto (dojos sin colores propios configurados) ──────────────
const DEFAULT_RED   = "#CC0000";
const DEFAULT_BLACK = "#000000";
const DEFAULT_GOLD  = "#D4AF37";
const BG            = "#F5F5F5";

const DEFAULT_SLOGAN_NEW = "DISCIPLINA, RESPETO Y CONSTANCIA";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** Convierte un color hex (#RRGGBB) a rgba() con la opacidad indicada */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Hash simple y determinístico de un string → entero positivo */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ─── Layout (coordenadas en espacio 638 × 1009) ───────────────────────────────
// Foto (centrada, ~58 % del ancho — cerca del 60 % del spec)
const PD = 420;                           // diámetro
const PX = Math.floor((W - PD) / 2);     // = 119 (centrado)
const QH = 310;                           // QR height

/** Patrón de rombos gris (watermark decorativo zona media-izquierda) */
function DiamondWatermark() {
  return (
    <svg width="240" height="280" style={{ display: "block" }}>
      <defs>
        <pattern id="dmnd" x="0" y="0" width="34" height="34" patternUnits="userSpaceOnUse">
          <polygon points="17,3 31,17 17,31 3,17" fill="none" stroke="#888" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect width="240" height="280" fill="url(#dmnd)" />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface CardProps {
  student: {
    fullName: string;
    photo: string | null;
  };
  dojo: {
    id: string;
    slug: string;
    name: string;
    logo: string | null;
    slogan: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    tertiaryColor: string | null;
    cardTemplateImage: string | null;
    cardLayout?: unknown;
  };
  contact: { name: string | null; phone: string | null };
  qrDataUrl: string;
}

export default function CardClient({ student, dojo, contact, qrDataUrl }: CardProps) {
  // Colores de marca del dojo, con fallback a la paleta roja/negra/dorada por defecto
  const RED   = dojo.primaryColor   && HEX_RE.test(dojo.primaryColor)   ? dojo.primaryColor   : DEFAULT_RED;
  const BLACK = dojo.secondaryColor && HEX_RE.test(dojo.secondaryColor) ? dojo.secondaryColor : DEFAULT_BLACK;
  const GOLD  = dojo.tertiaryColor  && HEX_RE.test(dojo.tertiaryColor)  ? dojo.tertiaryColor  : DEFAULT_GOLD;

  // Layout personalizado del carnet (todos los dojos pueden configurarlo)
  const customLayout: CardLayout | null = dojo.cardLayout
    ? parseCardLayout(dojo.cardLayout)
    : null;

  // Dimensiones dinámicas según preset del layout
  const isLandscape = customLayout?.preset === "landscape";
  const W_card = isLandscape ? H : W;   // H=1009, W=638
  const H_card = isLandscape ? W : H;

  // Posiciones base (se sobreescriben si hay customLayout)
  const PY = 120;
  const qh = QH;
  const NT = PY + PD + 12;
  const TT = NT + 48;
  const QT = TT + 24;
  const FT = QT + qh + 6;

  // Valores finales de posición/tamaño/color — custom layout tiene prioridad
  const PY_f  = customLayout ? customLayout.photo.y        : PY;
  const PX_f  = customLayout ? customLayout.photo.x        : PX;
  const PD_f  = customLayout ? customLayout.photo.diameter : PD;
  const NT_f  = customLayout ? customLayout.name.y         : NT;
  const TT_f  = customLayout ? customLayout.team.y         : TT;
  const QT_f  = customLayout ? customLayout.qr.y           : QT;
  const QH_f  = customLayout ? customLayout.qr.height      : qh;
  const FT_f  = customLayout ? customLayout.footer.y       : FT;

  const nameColor    = customLayout ? customLayout.name.color    : BLACK;
  const teamColor    = customLayout ? customLayout.team.color    : RED;
  const sloganColor  = customLayout ? customLayout.slogan.color  : "#ffffff";
  const footerBg     = customLayout ? customLayout.footer.background : BLACK;
  const contactColor = customLayout ? customLayout.contactColor  : BLACK;
  const nameFontStack   = customLayout ? getFontStack(customLayout.name.fontFamily)   : "'Montserrat','Segoe UI',Arial,sans-serif";
  const sloganFontStack = customLayout ? getFontStack(customLayout.slogan.fontFamily) : "'Montserrat','Segoe UI',Arial,sans-serif";
  const nameFontSize    = customLayout ? customLayout.name.fontSize   : 38;
  const sloganFontSize  = customLayout ? customLayout.slogan.fontSize : 15;
  const nameLetterSpacing_f = customLayout?.name.letterSpacing
    ? `${customLayout.name.letterSpacing * 0.01}em` : "0.5px";
  const nameTextShadow_f = customLayout?.name.shadowEnabled
    ? `${customLayout.name.shadowX}px ${customLayout.name.shadowY}px ${customLayout.name.shadowBlur}px ${customLayout.name.shadowColor}`
    : undefined;
  const nameTextStroke_f = customLayout?.name.outlineEnabled
    ? `${customLayout.name.outlineWidth}px ${customLayout.name.outlineColor}` : undefined;
  const photoShape_f  = customLayout ? customLayout.photo.shape : "circle";
  const photoRadius_f: string | number = photoShape_f === "rectangle" ? 12 : "50%";
  const photoBorderColor_f = customLayout ? customLayout.photo.borderColor : RED;
  const photoBorderWidth_f = customLayout ? customLayout.photo.borderWidth : 4;

  // Google Fonts adicionales para el layout personalizado
  const extraFontUrl = customLayout
    ? getGoogleFontsUrl([customLayout.name.fontFamily, customLayout.slogan.fontFamily])
    : "";

  // Variables QR
  const qrBorderStr_f = (customLayout && customLayout.qr.frameBorderWidth > 0 && customLayout.qr.frameBorderColor)
    ? `${customLayout.qr.frameBorderWidth}px solid ${customLayout.qr.frameBorderColor}`
    : `2px solid ${RED}`;
  const qrBg_f = customLayout?.qr.bgTransparent ? "transparent" : "#ffffff";

  // Plantilla de fondo personalizada — oculta capas decorativas y superpone datos del alumno
  const hasTemplate = !!dojo.cardTemplateImage;

  // Variante de layout determinística por dojo: alterna posición del logo
  // y orientación de las esquinas decorativas.
  const variantB = hashString(dojo.id) % 2 === 1;
  const corners = variantB
    ? {
        tl: { top: 0, left: 0, width: 96,  height: 202, clipPath: "polygon(0 0, 0 100%, 100% 0)" },
        tr: { top: 0, right: 0, width: 191, height: 252, clipPath: "polygon(100% 0, 100% 100%, 0 0)" },
        bl: { bottom: 0, left: 0, width: 255, height: 303, clipPath: "polygon(0 0, 0 100%, 100% 100%)" },
        br: { bottom: 0, right: 0, width: 55,  height: 88,  clipPath: "polygon(100% 100%, 100% 0, 0 100%)" },
      }
    : {
        tl: { top: 0, left: 0, width: 191, height: 252, clipPath: "polygon(0 0, 0 100%, 100% 0)" },
        tr: { top: 0, right: 0, width: 96,  height: 202, clipPath: "polygon(100% 0, 100% 100%, 0 0)" },
        bl: { bottom: 0, left: 0, width: 55,  height: 88,  clipPath: "polygon(0 100%, 0 0, 100% 100%)" },
        br: { bottom: 0, right: 0, width: 255, height: 303, clipPath: "polygon(100% 0, 100% 100%, 0 100%)" },
      };

  const initials  = student.fullName.split(/\s+/).slice(0, 2).map(n => n[0]?.toUpperCase() ?? "").join("");
  const teamLabel = `TEAM ${dojo.name.toUpperCase()}`;

  const sloganText = (customLayout?.slogan.text?.trim() || dojo.slogan?.trim() || DEFAULT_SLOGAN_NEW).toUpperCase();

  function printCard() {
    window.print();
  }

  return (
    <>
      <style>{`
        ${extraFontUrl ? `@import url('${extraFontUrl}');` : ""}
        @keyframes spin { to { transform: rotate(360deg); } }

        @media print {
          @page { size: ${isLandscape ? "85mm 55mm" : "55mm 85mm"}; margin: 0; }

          html, body {
            width: ${isLandscape ? "85mm" : "55mm"} !important; height: ${isLandscape ? "53.74mm" : "85mm"} !important;
            margin: 0 !important; padding: 0 !important;
            background: white !important; overflow: hidden !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }

          /* Anular el layout del main (flex + padding + bg oscuro de page.tsx) */
          main {
            display: block !important;
            min-height: unset !important;
            background: white !important;
            padding: 0 !important; margin: 0 !important;
            width: ${isLandscape ? "85mm" : "55mm"} !important; height: ${isLandscape ? "53.74mm" : "85mm"} !important;
            overflow: hidden !important;
          }

          /* Wrapper del carnet: centrado horizontalmente en la página */
          .card-print-wrapper {
            position: fixed !important;
            top: 0 !important; left: 50% !important;
            transform: translateX(-50%) !important;
            width: ${isLandscape ? "86mm" : "53.74mm"} !important; height: ${isLandscape ? "53.74mm" : "85mm"} !important;
            overflow: hidden !important;
            margin: 0 !important; padding: 0 !important;
          }

          /* Escala limitada por la altura: 638px → 53.74mm (portrait) o 1009px → 85mm (portrait)
             En landscape H_card=638, mismo scale 0.3184 */
          .card-print-scale {
            transform-origin: top left !important;
            transform: scale(0.3184) !important;
          }

          /* Quitar sombra y bordes redondeados (generan franja gris al imprimir) */
          .id-card-surface {
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      {/* ── Wrapper: ocupa el espacio visual escalado ─────────────────────── */}
      <div className="card-print-wrapper" style={{
        width:  Math.round(W_card * DS),
        height: Math.round(H_card * DS),
        flexShrink: 0,
        overflow: "visible",
      }}>
        {/* ── Escala visual ────────────────────────────────────────────────── */}
        <div className="card-print-scale" style={{ transformOrigin: "top left", transform: `scale(${DS})` }}>

          {/* ════════════════════════════════════════════════════════════════
              CARNET  W_card × H_card px  (CR80 @ 300 DPI)
              ════════════════════════════════════════════════════════════════ */}
          <div
            className="id-card-surface"
            style={{
              position: "relative",
              width: W_card, height: H_card,
              background: hasTemplate ? undefined : BG,
              overflow: "hidden",
              fontFamily: "'Montserrat','Segoe UI',Arial,sans-serif",
              borderRadius: 10,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* Template background image — fills entire card when configured */}
            {hasTemplate && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dojo.cardTemplateImage!}
                alt=""
                crossOrigin="anonymous"
                style={{
                  position: "absolute",
                  top: 0, left: 0,
                  width: W_card, height: H_card,
                  objectFit: "cover",
                  zIndex: 0,
                }}
              />
            )}

            {/* ── LAYER 1: Triángulos decorativos en las 4 esquinas (orientación según variante del dojo) ── */}
            {!hasTemplate && (
              <>
                <div style={{ position: "absolute", zIndex: 1, background: RED, ...corners.tl }} />
                <div style={{ position: "absolute", zIndex: 1, background: RED, ...corners.tr }} />
                <div style={{ position: "absolute", zIndex: 4, background: RED, ...corners.bl }} />
                <div style={{ position: "absolute", zIndex: 4, background: RED, ...corners.br }} />
              </>
            )}

            {/* ── LAYER 2: Patrón de rombos gris (watermark) ───────────── */}
            {!hasTemplate && (
              <div style={{
                position: "absolute", left: 0, top: 520, zIndex: 2,
                opacity: 0.18, pointerEvents: "none",
              }}>
                <DiamondWatermark />
              </div>
            )}

            {/* ── LAYER 3: Banner negro inferior (footer) ───────────────── */}
            {!hasTemplate && (
              <div style={{
                position: "absolute",
                top: FT_f, left: 0, width: W_card, height: H_card - FT_f,
                background: footerBg,
                zIndex: 3,
              }} />
            )}
            {/* Texto del footer (sobre el negro, z=8) */}
            <div style={{
              position: "absolute",
              top: FT_f, left: 0, width: W_card, height: H_card - FT_f,
              zIndex: 8,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 4,
            }}>
              <>
                {!hasTemplate && <div style={{ width: 50, height: 3, borderRadius: 2, background: GOLD, marginBottom: 6 }} />}
                <div style={{
                  fontSize: sloganFontSize, fontStyle: "italic", fontWeight: 700,
                  color: sloganColor, letterSpacing: "0.08em", lineHeight: 1.35,
                  textTransform: "uppercase", textAlign: "center",
                  padding: "0 36px", maxWidth: W_card - 48,
                  fontFamily: sloganFontStack,
                  ...(hasTemplate ? { textShadow: "0 1px 4px rgba(0,0,0,0.7)" } : {}),
                }}>{sloganText}</div>
              </>
            </div>

            {/* ── LAYER 5: Foto del alumno ───────────────────────────────── */}
            {/* Borde y anillo de la foto */}
            {photoBorderWidth_f > 0 && (
              <>
                <div style={{
                  position: "absolute",
                  top: PY_f - photoBorderWidth_f - 4, left: PX_f - photoBorderWidth_f - 4,
                  width: PD_f + (photoBorderWidth_f + 4) * 2, height: PD_f + (photoBorderWidth_f + 4) * 2,
                  borderRadius: photoRadius_f,
                  border: `2px solid ${hexToRgba(photoBorderColor_f, 0.22)}`,
                  zIndex: 5,
                }} />
                <div style={{
                  position: "absolute",
                  top: PY_f - photoBorderWidth_f, left: PX_f - photoBorderWidth_f,
                  width: PD_f + photoBorderWidth_f * 2, height: PD_f + photoBorderWidth_f * 2,
                  borderRadius: photoRadius_f,
                  border: `${photoBorderWidth_f}px solid ${photoBorderColor_f}`,
                  zIndex: 6,
                  boxShadow: `0 6px 28px ${hexToRgba(photoBorderColor_f, 0.30)}`,
                }} />
              </>
            )}
            {/* Foto */}
            <div style={{
              position: "absolute",
              top: PY_f, left: PX_f,
              width: PD_f, height: PD_f,
              borderRadius: photoRadius_f,
              overflow: "hidden",
              background: "#CCCCCC",
              zIndex: 7,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {student.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={student.photo}
                  alt={student.fullName}
                  crossOrigin="anonymous"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: 90, fontWeight: 800, color: "#888" }}>{initials}</span>
              )}
            </div>

            {/* ── LAYER 6: Nombre del alumno ────────────────────────────── */}
            <div style={{
              position: "absolute",
              top: NT_f, left: 20, right: 20,
              zIndex: 7, textAlign: "center",
            }}>
              <div style={{
                fontSize: nameFontSize, fontWeight: 800,
                color: nameColor,
                letterSpacing: nameLetterSpacing_f, lineHeight: 1.1,
                textTransform: "uppercase", wordBreak: "break-word",
                fontFamily: nameFontStack,
                ...(nameTextShadow_f ? { textShadow: nameTextShadow_f } : {}),
                ...(nameTextStroke_f ? { WebkitTextStroke: nameTextStroke_f, paintOrder: "stroke fill" as const } : {}),
              }}>
                {student.fullName}
              </div>
            </div>

            {/* ── LAYER 7: Línea TEAM ───────────────────────────────────── */}
            <div style={{
              position: "absolute",
              top: TT_f, left: 20, right: 20,
              zIndex: 7,
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 12,
            }}>
              <div style={{ flex: 1, height: 1.5, background: teamColor, borderRadius: 2 }} />
              <span style={{
                fontSize: 14, fontWeight: 700, color: teamColor,
                letterSpacing: "0.42em", textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}>{teamLabel}</span>
              <div style={{ flex: 1, height: 1.5, background: teamColor, borderRadius: 2 }} />
            </div>

            {/* ── LAYER 8: Zona QR — 3 columnas ─────────────────────────── */}
            <div style={{
              position: "absolute",
              top: QT_f, left: 0, right: 0, height: QH_f,
              zIndex: 7,
              display: "flex", alignItems: "stretch",
              padding: "0 0 0 16px",
              gap: 8,
              boxSizing: "border-box" as const,
            }}>

              {/* Columna izquierda 20%: espacio para el lema vertical */}
              <div style={{ width: "20%", flexShrink: 0 }} />

              {/* Columna central 55%: QR con borde de color */}
              <div style={{
                flex: "0 0 55%",
                background: qrBg_f,
                border: qrBorderStr_f,
                borderRadius: 12,
                padding: 0,
                boxShadow: `0 4px 22px ${hexToRgba(RED, 0.15)}`,
                overflow: "hidden",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="QR"
                  style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>

              {/* Columna derecha 25%: contacto pegado al borde derecho */}
              <div style={{
                flex: "0 0 25%",
                display: "flex", alignItems: "center", justifyContent: "flex-end",
                paddingRight: 0,
              }}>
                {(contact.name || contact.phone) ? (
                  <div style={{
                    width: "100%", height: "auto",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    gap: 10, marginRight: -10, marginTop: 60,
                  }}>
                    {/* Nombre del tutor (texto vertical) */}
                    {contact.name && (
                      <div style={{
                        writingMode: "vertical-lr" as const,
                        transform: "rotate(180deg)",
                        fontSize: 18, fontWeight: 700, color: contactColor,
                        lineHeight: 1.2, textAlign: "center",
                        maxHeight: 200, overflow: "hidden",
                      }}>{contact.name}</div>
                    )}
                    {/* Teléfono (texto vertical) */}
                    {contact.phone && (
                      <div style={{
                        writingMode: "vertical-lr" as const,
                        transform: "rotate(180deg)",
                        fontSize: 18, fontWeight: 500, color: contactColor,
                        maxHeight: 130, overflow: "hidden",
                      }}>{contact.phone}</div>
                    )}
                    {/* Ícono WhatsApp */}
                    <svg width="46" height="46" viewBox="0 0 32 32" fill="none">
                      <circle cx="16" cy="16" r="16" fill="#25D366"/>
                      <path d="M23.5 8.5A10.44 10.44 0 0 0 16 5.5C10.75 5.5 6.5 9.75 6.5 15a9.44 9.44 0 0 0 1.27 4.75L6.5 26.5l6.93-1.82A9.5 9.5 0 0 0 16 25.5c5.25 0 9.5-4.25 9.5-9.5a9.44 9.44 0 0 0-2-5.5zm-7.5 14.62a7.88 7.88 0 0 1-4.02-1.1l-.29-.17-3 .79.8-2.93-.19-.3A7.88 7.88 0 0 1 8.12 15c0-4.35 3.53-7.88 7.88-7.88S23.88 10.65 23.88 15 20.35 23.12 16 23.12zm4.33-5.9c-.24-.12-1.4-.69-1.61-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1-.37-1.91-1.18-.7-.63-1.18-1.4-1.32-1.64-.14-.24-.01-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.52.1.46-.07 1.4-.57 1.6-1.12.2-.55.2-1.02.14-1.12-.06-.1-.22-.16-.46-.28z" fill="#fff"/>
                    </svg>
                  </div>
                ) : null}
              </div>

            </div>{/* fin zona QR */}

            {/* ── Lema vertical — borde izquierdo ──────────────────────── */}
            <div style={{
              position: "absolute",
              left: 4, top: QT_f,
              height: QH_f,
              zIndex: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                writingMode: "vertical-lr" as const,
                transform: "rotate(180deg)",
                fontSize: 9, fontWeight: 600,
                color: "#999", letterSpacing: "0.32em",
                textTransform: "uppercase", whiteSpace: "nowrap",
                opacity: 0.85,
              }}>DISCIPLINA · RESPETO · CONSTANCIA</div>
            </div>

          </div>{/* fin card */}
        </div>{/* fin scale */}
      </div>{/* fin wrapper */}

      {/* ── Botón imprimir / guardar PDF ─────────────────────────────────── */}
      <button
        className="no-print"
        onClick={printCard}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          background: RED, color: "#fff",
          border: "none", borderRadius: 12, padding: "14px 36px",
          fontSize: 15, fontWeight: 700,
          cursor: "pointer", letterSpacing: "0.04em",
          fontFamily: "'Montserrat','Segoe UI',Arial,sans-serif",
          boxShadow: `0 8px 24px ${hexToRgba(RED, 0.40)}`,
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/>
        </svg>
        Imprimir / Guardar PDF
      </button>

      <p className="no-print" style={{
        fontSize: 12, color: "rgba(255,255,255,0.4)",
        textAlign: "center", maxWidth: 340,
        fontFamily: "'Montserrat','Segoe UI',Arial,sans-serif",
      }}>
        Selecciona &quot;Guardar como PDF&quot; en el diálogo de impresión · CR80 54 × 85.6 mm
      </p>
    </>
  );
}
