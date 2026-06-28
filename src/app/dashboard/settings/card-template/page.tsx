"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/lib/context/AppContext";
import {
  CreditCard, Upload, Save, Trash2, Loader2, RefreshCw,
  Move, Type, Palette, Image as ImageIcon, ChevronDown, Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CARD_FONTS, DEFAULT_CARD_LAYOUT, DEFAULT_LANDSCAPE_LAYOUT,
  CARD_PRESETS, getCardDimensions,
  getFontStack, getGoogleFontsUrl, parseCardLayout,
  type CardLayout, type CardPreset,
} from "@/lib/card-layout";

// ── Tipo de elemento arrastrable ──────────────────────────────────────────────
type DragTarget =
  | "photo" | "photo-se"   // foto: mover + resize esquina inferior-derecha
  | "qr"    | "qr-se"      // QR: mover X+Y + resize esquina inferior-derecha
  | "contact"              // columna de contacto: arrastrar para ajustar ancho del QR
  | "name" | "team" | "footer"
  | null;

// ── Hit detection (función pura) ──────────────────────────────────────────────
const HANDLE_R = 14; // radio de detección del handle de resize (px en espacio carnet)

function getHitElement(
  mx: number, my: number,
  layout: CardLayout, CW: number, CH: number
): DragTarget {
  const ph = layout.photo;
  const qr = layout.qr;

  // ── Photo resize handle (esquina inferior-derecha) ────────────────────
  const photoSeX = ph.x + ph.diameter;
  const photoSeY = ph.y + ph.diameter;
  if (Math.abs(mx - photoSeX) <= HANDLE_R && Math.abs(my - photoSeY) <= HANDLE_R) return "photo-se";

  // ── QR resize handle (esquina inferior-derecha del bloque QR) ─────────
  const qrSeX = qr.x + qr.w;
  const qrSeY = qr.y + qr.height;
  if (Math.abs(mx - qrSeX) <= HANDLE_R && Math.abs(my - qrSeY) <= HANDLE_R) return "qr-se";

  // ── Foto (hit circular) ───────────────────────────────────────────────
  const photoCX = ph.x + ph.diameter / 2;
  const photoCY = ph.y + ph.diameter / 2;
  if (Math.sqrt((mx - photoCX) ** 2 + (my - photoCY) ** 2) <= ph.diameter / 2 + 20) return "photo";

  // ── QR (hit rectangular) ──────────────────────────────────────────────
  if (mx >= qr.x - 10 && mx <= qr.x + qr.w + 10 && my >= qr.y - 10 && my <= qr.y + qr.height + 10) return "qr";

  // ── Contacto (posición independiente) ────────────────────────────────
  const ct = layout.contact;
  if (mx >= ct.x - 8 && mx <= ct.x + ct.width + 8 && my >= ct.y - 10 && my <= ct.y + qr.height + 10) return "contact";

  // ── Nombre ────────────────────────────────────────────────────────────
  if (my >= layout.name.y - 10 && my <= layout.name.y + layout.name.fontSize + 20) return "name";

  // ── Línea de equipo ───────────────────────────────────────────────────
  if (my >= layout.team.y - 20 && my <= layout.team.y + 20) return "team";

  // ── Footer ────────────────────────────────────────────────────────────
  if (my >= layout.footer.y - 20 && my <= CH) return "footer";

  void CW;
  return null;
}

// ── Snap helper ───────────────────────────────────────────────────────────────
const SNAP_PX = 14;

function snapVal(val: number, center: number, enabled: boolean): number {
  return enabled && Math.abs(val - center) <= SNAP_PX ? center : val;
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function ToggleRow({ label, checked, onChange, hint }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <span className="text-xs text-dojo-muted">{label}</span>
        {hint && <span className="block text-[10px] text-dojo-muted/60">{hint}</span>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-9 h-5 rounded-full transition-colors flex-shrink-0",
          checked ? "bg-dojo-red" : "bg-dojo-border"
        )}
      >
        <span className={cn(
          "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )} />
      </button>
    </div>
  );
}

// ── Vista previa del carnet ───────────────────────────────────────────────────
function CardPreview({
  layout,
  templateUrl,
  dojoName,
  draggingEl,
  hoverEl,
  showGrid,
  showGuides,
  snapCenter,
  dragCoords,
  onPreviewMouseDown,
  onPreviewMouseMove,
  onPreviewMouseUp,
  previewRef,
}: {
  layout: CardLayout;
  templateUrl: string | null;
  dojoName: string;
  draggingEl: DragTarget;
  hoverEl: DragTarget;
  showGrid: boolean;
  showGuides: boolean;
  snapCenter: boolean;
  dragCoords: { x?: number; y: number } | null;
  onPreviewMouseDown: (e: React.MouseEvent) => void;
  onPreviewMouseMove: (e: React.MouseEvent) => void;
  onPreviewMouseUp: () => void;
  previewRef: React.RefObject<HTMLDivElement>;
}) {
  const { w: CW, h: CH } = getCardDimensions(layout.preset);
  const scale = Math.min(420 / CW, 520 / CH);

  const ph = layout.photo;
  const nm = layout.name;
  const footerH = CH - layout.footer.y;
  const photoRadius = ph.shape === "rectangle" ? 12 : "50%";

  // QR border — sin borde cuando frameBorderWidth === 0
  const qrBorder = (layout.qr.frameBorderWidth > 0 && layout.qr.frameBorderColor)
    ? `${layout.qr.frameBorderWidth}px solid ${layout.qr.frameBorderColor}`
    : "none";
  const qrBg = layout.qr.bgTransparent ? "transparent" : "#fff";

  // Name styles
  const nameLetterSpacing = nm.letterSpacing ? `${nm.letterSpacing * 0.01}em` : undefined;
  const nameTextShadow = nm.shadowEnabled
    ? `${nm.shadowX}px ${nm.shadowY}px ${nm.shadowBlur}px ${nm.shadowColor}`
    : undefined;
  const nameTextStroke = nm.outlineEnabled
    ? `${nm.outlineWidth}px ${nm.outlineColor}` : undefined;

  const allFontKeys = CARD_FONTS.filter(f => f.key !== "Montserrat").map(f => f.key);
  const googleFontsUrl = getGoogleFontsUrl(allFontKeys);

  // Cursor dinámico
  const cursor = draggingEl
    ? (draggingEl === "photo-se" || draggingEl === "qr-se") ? "nwse-resize"
      : draggingEl === "photo" ? "grabbing"
      : draggingEl === "qr" ? "move"
      : draggingEl === "contact" ? "ew-resize"
      : "ns-resize"
    : hoverEl === "photo-se" || hoverEl === "qr-se" ? "nwse-resize"
    : hoverEl === "photo" ? "grab"
    : hoverEl === "qr" ? "move"
    : hoverEl === "contact" ? "ew-resize"
    : hoverEl ? "ns-resize"
    : "default";

  return (
    <>
      {googleFontsUrl && (
        <style>{`@import url('${googleFontsUrl}');`}</style>
      )}
      {/* Wrapper visual escalado */}
      <div style={{
        width: Math.round(CW * scale),
        height: Math.round(CH * scale),
        flexShrink: 0,
        overflow: "hidden",
      }}>
        <div
          ref={previewRef}
          style={{
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            cursor,
          }}
          onMouseDown={onPreviewMouseDown}
          onMouseMove={onPreviewMouseMove}
          onMouseUp={onPreviewMouseUp}
          onMouseLeave={onPreviewMouseUp}
        >
          {/* Carnet CW × CH */}
          <div style={{
            position: "relative", width: CW, height: CH,
            background: templateUrl ? undefined : "#F0F0F0",
            overflow: "hidden", borderRadius: 10,
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            userSelect: "none",
          }}>
            {/* Fondo template */}
            {templateUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={templateUrl} alt="" style={{
                position: "absolute", inset: 0,
                width: CW, height: CH,
                objectFit: "cover", zIndex: 0,
              }} />
            )}

            {/* Sin template: fondo gris con texto */}
            {!templateUrl && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 1,
              }}>
                <p style={{ fontSize: 22, color: "#bbb", fontFamily: "sans-serif" }}>Sin plantilla</p>
              </div>
            )}

            {/* ── Grid + guías de centro ─────────────────────────────── */}
            {(showGrid || showGuides) && (
              <svg
                style={{
                  position: "absolute", inset: 0,
                  width: CW, height: CH,
                  zIndex: 20, pointerEvents: "none",
                }}
                viewBox={`0 0 ${CW} ${CH}`}
              >
                {/* Cuadrícula */}
                {showGrid && (() => {
                  const STEP = 50;
                  const lines: React.ReactNode[] = [];
                  for (let x = STEP; x < CW; x += STEP) {
                    lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={CH}
                      stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />);
                  }
                  for (let y = STEP; y < CH; y += STEP) {
                    lines.push(<line key={`h${y}`} x1={0} y1={y} x2={CW} y2={y}
                      stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />);
                  }
                  return lines;
                })()}

                {/* Guía vertical de centro */}
                {showGuides && (
                  <line x1={CW / 2} y1={0} x2={CW / 2} y2={CH}
                    stroke="rgba(99,179,237,0.5)" strokeWidth="1"
                    strokeDasharray="6 4" />
                )}
                {/* Guía horizontal de centro */}
                {showGuides && (
                  <line x1={0} y1={CH / 2} x2={CW} y2={CH / 2}
                    stroke="rgba(99,179,237,0.5)" strokeWidth="1"
                    strokeDasharray="6 4" />
                )}

                {/* Zona segura (margen 20px) */}
                {showGuides && (
                  <rect x={20} y={20} width={CW - 40} height={CH - 40}
                    fill="none" stroke="rgba(255,200,0,0.2)" strokeWidth="1"
                    strokeDasharray="8 6" />
                )}

                {/* Flash de snap: línea naranja cuando foto está centrada H */}
                {draggingEl === "photo" && snapCenter &&
                  Math.abs(ph.x - (CW - ph.diameter) / 2) < 2 && (
                  <line x1={CW / 2} y1={0} x2={CW / 2} y2={CH}
                    stroke="#FF6B35" strokeWidth="2" strokeDasharray="6 3" opacity={0.9} />
                )}
                {draggingEl === "photo" && snapCenter &&
                  Math.abs(ph.y - (CH - ph.diameter) / 2) < 2 && (
                  <line x1={0} y1={CH / 2} x2={CW} y2={CH / 2}
                    stroke="#FF6B35" strokeWidth="2" strokeDasharray="6 3" opacity={0.9} />
                )}
              </svg>
            )}

            {/* ── Footer ───────────────────────────── */}
            <div style={{
              position: "absolute", top: layout.footer.y, left: 0,
              width: CW, height: footerH,
              background: layout.footer.background, zIndex: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{
                fontSize: layout.slogan.fontSize, fontStyle: "italic", fontWeight: 700,
                color: layout.slogan.color, textTransform: "uppercase",
                fontFamily: getFontStack(layout.slogan.fontFamily),
                padding: "0 32px", textAlign: "center", lineHeight: 1.35,
              }}>
                {layout.slogan.text.trim() || "SLOGAN DEL DOJO"}
              </span>
            </div>

            {/* Footer hover/drag indicator */}
            {(hoverEl === "footer" || draggingEl === "footer") && (
              <div style={{
                position: "absolute", top: layout.footer.y - 4, left: 10, right: 10,
                height: footerH + 8, zIndex: 25,
                border: "2px dashed rgba(99,179,237,0.7)",
                borderRadius: 4, pointerEvents: "none",
              }}>
                <span style={{
                  position: "absolute", top: -14, left: 4,
                  fontSize: 9, color: "rgba(99,179,237,0.9)",
                  background: "rgba(0,0,0,0.5)", padding: "1px 4px", borderRadius: 3,
                  fontFamily: "monospace", whiteSpace: "nowrap",
                }}>↕ FOOTER — Y:{layout.footer.y}</span>
              </div>
            )}

            {/* ── QR — absolutamente posicionado ──────────── */}
            <div style={{
              position: "absolute",
              left: layout.qr.x, top: layout.qr.y,
              width: layout.qr.w, height: layout.qr.height,
              background: qrBg, border: qrBorder,
              borderRadius: 12, zIndex: 7,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 14, color: "#aaa", fontFamily: "monospace" }}>QR</span>
            </div>

            {/* ── Contacto — posición independiente ──────── */}
            {(() => {
              const ctPos = layout.contact;
              return (
                <div style={{
                  position: "absolute",
                  left: ctPos.x, top: ctPos.y,
                  width: ctPos.width, height: layout.qr.height,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 8, zIndex: 7,
                  background: "rgba(128,128,128,0.08)",
                  borderRadius: 8,
                }}>
                  <div style={{
                    writingMode: "vertical-lr" as const,
                    transform: "rotate(180deg)",
                    fontSize: 16, fontWeight: 700,
                    color: layout.contactColor,
                    lineHeight: 1.2, textAlign: "center",
                    maxHeight: layout.qr.height * 0.45, overflow: "hidden",
                  }}>NOMBRE ACUDIENTE</div>
                  <div style={{
                    writingMode: "vertical-lr" as const,
                    transform: "rotate(180deg)",
                    fontSize: 13,
                    color: layout.contactColor,
                    maxHeight: layout.qr.height * 0.30, overflow: "hidden",
                  }}>+507 6000-0000</div>
                  <svg width="26" height="26" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="16" cy="16" r="16" fill="#25D366"/>
                    <path d="M23.5 8.5A10.44 10.44 0 0 0 16 5.5C10.75 5.5 6.5 9.75 6.5 15a9.44 9.44 0 0 0 1.27 4.75L6.5 26.5l6.93-1.82A9.5 9.5 0 0 0 16 25.5c5.25 0 9.5-4.25 9.5-9.5a9.44 9.44 0 0 0-2-5.5z" fill="#fff"/>
                  </svg>
                  {/* Hover/drag indicator */}
                  {(hoverEl === "contact" || draggingEl === "contact") && (
                    <div style={{
                      position: "absolute", inset: -3,
                      border: "2px dashed rgba(99,179,237,0.8)",
                      borderRadius: 10, pointerEvents: "none",
                    }}>
                      <span style={{
                        position: "absolute", top: -14, left: 2,
                        fontSize: 9, color: "rgba(99,179,237,0.9)",
                        background: "rgba(0,0,0,0.6)", padding: "1px 4px", borderRadius: 3,
                        fontFamily: "monospace", whiteSpace: "nowrap",
                      }}>&#8596;&#8597; CONTACTO — X:{ctPos.x} Y:{ctPos.y}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* QR hover/drag indicator */}
            {(hoverEl === "qr" || draggingEl === "qr" || hoverEl === "qr-se" || draggingEl === "qr-se") && (
              <div style={{
                position: "absolute",
                left: layout.qr.x - 3, top: layout.qr.y - 3,
                width: layout.qr.w + 6, height: layout.qr.height + 6,
                border: "2px dashed rgba(99,179,237,0.8)",
                borderRadius: 14, zIndex: 19, pointerEvents: "none",
              }}>
                <span style={{
                  position: "absolute", top: -14, left: 4,
                  fontSize: 9, color: "rgba(99,179,237,0.9)",
                  background: "rgba(0,0,0,0.5)", padding: "1px 4px", borderRadius: 3,
                  fontFamily: "monospace", whiteSpace: "nowrap",
                }}>&#8596;&#8597; QR — X:{layout.qr.x} Y:{layout.qr.y} W:{layout.qr.w}</span>
              </div>
            )}

            {/* ── Línea TEAM ───────────────────────── */}
            <div style={{
              position: "absolute", top: layout.team.y, left: 20, right: 20, zIndex: 7,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ flex: 1, height: 1.5, background: layout.team.color }} />
              <span style={{
                fontSize: 14, fontWeight: 700, color: layout.team.color,
                letterSpacing: "0.42em", textTransform: "uppercase", whiteSpace: "nowrap",
              }}>
                TEAM {dojoName.toUpperCase()}
              </span>
              <div style={{ flex: 1, height: 1.5, background: layout.team.color }} />
            </div>

            {/* Team hover/drag indicator */}
            {(hoverEl === "team" || draggingEl === "team") && (
              <div style={{
                position: "absolute", top: layout.team.y - 10, left: 10, right: 10,
                height: 24, zIndex: 25,
                border: "2px dashed rgba(99,179,237,0.7)",
                borderRadius: 4, pointerEvents: "none",
              }}>
                <span style={{
                  position: "absolute", top: -14, left: 4,
                  fontSize: 9, color: "rgba(99,179,237,0.9)",
                  background: "rgba(0,0,0,0.5)", padding: "1px 4px", borderRadius: 3,
                  fontFamily: "monospace", whiteSpace: "nowrap",
                }}>↕ TEAM — Y:{layout.team.y}</span>
              </div>
            )}

            {/* ── Nombre ───────────────────────────── */}
            <div style={{
              position: "absolute", top: nm.y, left: 20, right: 20, zIndex: 7,
              textAlign: "center",
              fontSize: nm.fontSize, fontWeight: 800,
              color: nm.color, textTransform: "uppercase",
              fontFamily: getFontStack(nm.fontFamily), lineHeight: 1.1,
              ...(nameLetterSpacing ? { letterSpacing: nameLetterSpacing } : {}),
              ...(nameTextShadow ? { textShadow: nameTextShadow } : {}),
              ...(nameTextStroke ? { WebkitTextStroke: nameTextStroke } : {}),
            }}>
              NOMBRE DEL ALUMNO
            </div>

            {/* Nombre hover/drag indicator */}
            {(hoverEl === "name" || draggingEl === "name") && (
              <div style={{
                position: "absolute", top: nm.y - 4, left: 10, right: 10,
                height: nm.fontSize + 12, zIndex: 25,
                border: "2px dashed rgba(99,179,237,0.7)",
                borderRadius: 4, pointerEvents: "none",
              }}>
                <span style={{
                  position: "absolute", top: -14, left: 4,
                  fontSize: 9, color: "rgba(99,179,237,0.9)",
                  background: "rgba(0,0,0,0.5)", padding: "1px 4px", borderRadius: 3,
                  fontFamily: "monospace", whiteSpace: "nowrap",
                }}>↕ NOMBRE — Y:{nm.y}</span>
              </div>
            )}

            {/* ── Foto ─────────────────────────────── */}
            {ph.borderWidth > 0 && (
              <>
                {/* Anillo exterior */}
                <div style={{
                  position: "absolute",
                  top: ph.y - ph.borderWidth - 4, left: ph.x - ph.borderWidth - 4,
                  width: ph.diameter + (ph.borderWidth + 4) * 2,
                  height: ph.diameter + (ph.borderWidth + 4) * 2,
                  borderRadius: photoRadius,
                  border: `2px solid rgba(204,0,0,0.22)`,
                  zIndex: 5,
                }} />
                {/* Borde sólido */}
                <div style={{
                  position: "absolute",
                  top: ph.y - ph.borderWidth, left: ph.x - ph.borderWidth,
                  width: ph.diameter + ph.borderWidth * 2,
                  height: ph.diameter + ph.borderWidth * 2,
                  borderRadius: photoRadius,
                  border: `${ph.borderWidth}px solid ${ph.borderColor}`,
                  zIndex: 6,
                  boxShadow: `0 6px 28px rgba(204,0,0,0.30)`,
                }} />
              </>
            )}
            <div style={{
              position: "absolute", top: ph.y, left: ph.x,
              width: ph.diameter, height: ph.diameter,
              borderRadius: photoRadius, overflow: "hidden",
              background: "#CCCCCC", zIndex: 7,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 20, color: "#888", fontFamily: "sans-serif" }}>Foto</span>
            </div>

            {/* Foto hover/drag indicator */}
            {(hoverEl === "photo" || draggingEl === "photo" || hoverEl === "photo-se" || draggingEl === "photo-se") && (
              <div style={{
                position: "absolute",
                top: ph.y - 4, left: ph.x - 4,
                width: ph.diameter + 8, height: ph.diameter + 8,
                borderRadius: ph.shape === "circle" ? "50%" : 16,
                border: "2px dashed rgba(99,179,237,0.8)",
                zIndex: 19, pointerEvents: "none",
              }}>
                <span style={{
                  position: "absolute", bottom: -16, left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: 9, color: "rgba(99,179,237,0.9)",
                  background: "rgba(0,0,0,0.5)", padding: "1px 4px", borderRadius: 3,
                  fontFamily: "monospace", whiteSpace: "nowrap",
                }}>&#8596;&#8597; FOTO — X:{ph.x} Y:{ph.y}</span>
              </div>
            )}

            {/* ── Handle resize foto ───────────────────────────── */}
            {(hoverEl === "photo" || hoverEl === "photo-se" || draggingEl === "photo" || draggingEl === "photo-se") && (
              <div style={{
                position: "absolute",
                left: ph.x + ph.diameter - 10,
                top:  ph.y + ph.diameter - 10,
                width: 20, height: 20,
                background: "#3B82F6",
                border: "2px solid #fff",
                borderRadius: 4,
                zIndex: 25,
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                cursor: "nwse-resize",
              }} />
            )}

            {/* ── Handle resize QR ─────────────────────────────── */}
            {(hoverEl === "qr" || hoverEl === "qr-se" || draggingEl === "qr" || draggingEl === "qr-se") && (
              <div style={{
                position: "absolute",
                left: layout.qr.x + layout.qr.w - 10,
                top:  layout.qr.y + layout.qr.height - 10,
                width: 20, height: 20,
                background: "#3B82F6",
                border: "2px solid #fff",
                borderRadius: 4,
                zIndex: 25,
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                cursor: "nwse-resize",
              }} />
            )}

            {/* ── Badge de coordenadas en tiempo real ──────────────────── */}
            {draggingEl && dragCoords && (
              <div style={{
                position: "absolute", top: 8, right: 8, zIndex: 30,
                background: "rgba(0,0,0,0.75)", color: "#fff",
                fontSize: 10, fontFamily: "monospace",
                padding: "3px 7px", borderRadius: 4, pointerEvents: "none",
              }}>
                {draggingEl === "photo-se" ? `⌀ ${dragCoords.y}` :
                 draggingEl === "qr-se"   ? `W:${dragCoords.x} H:${dragCoords.y}` :
                 dragCoords.x !== undefined ? `X:${dragCoords.x} Y:${dragCoords.y}` :
                 `Y:${dragCoords.y}`}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Control deslizante ────────────────────────────────────────────────────────
function SliderRow({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-dojo-muted">
        <span>{label}</span>
        <span className="font-mono text-dojo-white">{value}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 accent-dojo-red"
        />
        <input
          type="number" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-16 text-xs text-center bg-dojo-dark border border-dojo-border rounded px-1 py-0.5 text-dojo-white"
        />
      </div>
    </div>
  );
}

// ── Selector de color ─────────────────────────────────────────────────────────
function ColorRow({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-dojo-muted">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded border border-dojo-border overflow-hidden">
          <input
            type="color" value={value}
            onChange={e => onChange(e.target.value)}
            className="w-8 h-8 -translate-x-1 -translate-y-1 cursor-pointer"
          />
        </div>
        <input
          type="text" value={value}
          onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onChange(e.target.value); }}
          className="w-24 text-xs font-mono bg-dojo-dark border border-dojo-border rounded px-2 py-0.5 text-dojo-white uppercase"
          maxLength={7}
        />
      </div>
    </div>
  );
}

// ── Selector de fuente ────────────────────────────────────────────────────────
function FontRow({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-dojo-muted">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs bg-dojo-dark border border-dojo-border rounded px-2 py-1 text-dojo-white"
      >
        {CARD_FONTS.map(f => (
          <option key={f.key} value={f.key}>{f.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Sección colapsable ────────────────────────────────────────────────────────
function CollapsibleSection({ title, icon: Icon, children, defaultOpen = true, hint }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  hint?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 text-dojo-white font-semibold text-sm"
      >
        <Icon size={16} className="text-dojo-red flex-shrink-0" />
        <span className="flex-1 text-left">{title}</span>
        {hint && <span className="text-[10px] text-dojo-muted font-normal mr-1">{hint}</span>}
        <ChevronDown size={14} className={cn("text-dojo-muted transition-transform duration-200 flex-shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-dojo-border space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Tipo de slot de diseño ────────────────────────────────────────────────────
type CardSlot = { layout: CardLayout; templateUrl: string | null };
const EMPTY_SLOT: CardSlot = { layout: DEFAULT_CARD_LAYOUT, templateUrl: null };

// ── Página principal ──────────────────────────────────────────────────────────
export default function CardTemplatePage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const router = useRouter();
  const { refreshDojo } = useAppContext();

  const [dojoList,   setDojoList]   = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [dojoName,   setDojoName]   = useState("Mi Dojo");

  const [slots,       setSlots]       = useState<[CardSlot, CardSlot, CardSlot]>([EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT]);
  const [currentTab,  setCurrentTab]  = useState<1 | 2 | 3>(1);
  const [activeSlot,  setActiveSlot]  = useState<1 | 2 | 3>(1);
  const [tplUploading, setTplUploading] = useState(false);
  const [tplError,     setTplError]     = useState("");
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);

  // Derivados del slot actual
  const currentSlot = slots[currentTab - 1];
  const layout      = currentSlot.layout;
  const templateUrl = currentSlot.templateUrl;

  // ── Drag state ────────────────────────────────────────────────────────────
  const [draggingEl, setDraggingEl]   = useState<DragTarget>(null);
  const [hoverEl,    setHoverEl]      = useState<DragTarget>(null);
  const [showGrid,   setShowGrid]     = useState(false);
  const [showGuides, setShowGuides]   = useState(true);
  const [snapCenter, setSnapCenter]   = useState(true);
  const [dragCoords, setDragCoords]   = useState<{ x?: number; y: number } | null>(null);
  const draggingElRef = useRef<DragTarget>(null);
  const dragOffsetX   = useRef(0);
  const dragOffsetY   = useRef(0);

  const tplFileRef      = useRef<HTMLInputElement>(null);
  const previewRef      = useRef<HTMLDivElement>(null);
  const previewScaleRef = useRef(0.44);

  // Ref del índice de tab actual (0-based) para uso seguro en useCallback de drag
  const currentTabRef = useRef(0);
  currentTabRef.current = currentTab - 1;

  // Helper para actualizar solo el slot actual
  function updateCurrentSlot(updater: (s: CardSlot) => CardSlot) {
    setSlots(prev => {
      const next = [...prev] as [CardSlot, CardSlot, CardSlot];
      next[currentTab - 1] = updater(next[currentTab - 1]);
      return next;
    });
  }

  // Dimensiones dinámicas según preset actual
  const { w: CW, h: CH } = getCardDimensions(layout.preset);
  // Actualizar scale en cada render para que los drag handlers la usen
  previewScaleRef.current = Math.min(420 / CW, 520 / CH);

  // ── Cargar lista de dojos para sysadmin ──────────────────────────────────
  useEffect(() => {
    if (role !== "sysadmin") return;
    Promise.all([
      fetch("/api/dojos").then(r => r.ok ? r.json() : []),
      fetch("/api/dojo").then(r => r.ok ? r.json() : null),
    ]).then(([list, ctx]: [Array<{ id: string; name: string; slug: string }>, { id: string } | null]) => {
      setDojoList(list);
      if (ctx?.id) setSelectedId(ctx.id);
      else if (list.length > 0) setSelectedId(list[0].id);
    });
  }, [role]);

  // ── Cargar config del dojo ────────────────────────────────────────────────
  useEffect(() => {
    if (role === "sysadmin" && !selectedId) { setLoading(false); return; }
    setLoading(true);
    const url = role === "sysadmin" && selectedId
      ? `/api/dojo?id=${selectedId}&logo=1`
      : "/api/dojo?logo=1";
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setDojoName(data.name ?? "Mi Dojo");
          setActiveSlot((data.activeCardSlot ?? 1) as 1 | 2 | 3);
          setSlots([
            {
              layout:      parseCardLayout(data.cardLayout)  ?? DEFAULT_CARD_LAYOUT,
              templateUrl: data.cardTemplateImage  ?? null,
            },
            {
              layout:      parseCardLayout(data.cardLayout2) ?? DEFAULT_CARD_LAYOUT,
              templateUrl: data.cardTemplateImage2 ?? null,
            },
            {
              layout:      parseCardLayout(data.cardLayout3) ?? DEFAULT_CARD_LAYOUT,
              templateUrl: data.cardTemplateImage3 ?? null,
            },
          ]);
        }
        setLoading(false);
      });
  }, [role, selectedId]);

  // ── Subir imagen de fondo ─────────────────────────────────────────────────
  async function handleTplFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("El archivo supera 5 MB"); return; }
    const tabAtStart = currentTab; // capturar tab al inicio (async-safe)
    setTplError(""); setTplUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "image");
      fd.append("purpose", "card-template");
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        const idx = tabAtStart - 1;
        setSlots(prev => {
          const next = [...prev] as [CardSlot, CardSlot, CardSlot];
          next[idx] = { ...next[idx], templateUrl: data.url };
          return next;
        });
      } else {
        setTplError(data.error ?? "Error al subir la imagen");
      }
    } catch {
      setTplError("Error de conexión");
    } finally {
      setTplUploading(false);
      if (tplFileRef.current) tplFileRef.current.value = "";
    }
  }

  // ── Guardar todo ──────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true); setSaved(false);
    const url = role === "sysadmin" && selectedId ? `/api/dojo?id=${selectedId}` : "/api/dojo";
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardTemplateImage:  slots[0].templateUrl,
        cardLayout:         slots[0].layout,
        cardTemplateImage2: slots[1].templateUrl,
        cardLayout2:        slots[1].layout,
        cardTemplateImage3: slots[2].templateUrl,
        cardLayout3:        slots[2].layout,
        activeCardSlot:     activeSlot,
      }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      refreshDojo();
      router.refresh();
    }
    setSaving(false);
  }

  // ── Cambiar preset (portrait / landscape) ────────────────────────────────
  function handlePresetChange(preset: CardPreset) {
    updateCurrentSlot(s => ({ ...s, layout: preset === "landscape" ? DEFAULT_LANDSCAPE_LAYOUT : DEFAULT_CARD_LAYOUT }));
  }

  // ── Drag-and-drop en el preview ──────────────────────────────────────────
  const handlePreviewMouseDown = useCallback((e: React.MouseEvent) => {
    if (!previewRef.current) return;
    const rect  = previewRef.current.getBoundingClientRect();
    const scale = previewScaleRef.current;
    const mx    = (e.clientX - rect.left)  / scale;
    const my    = (e.clientY - rect.top)   / scale;
    const { w: dCW, h: dCH } = getCardDimensions(layout.preset);
    const hit = getHitElement(mx, my, layout, dCW, dCH);
    if (!hit) return;

    draggingElRef.current = hit;
    setDraggingEl(hit);

    if (hit === "photo") {
      dragOffsetX.current = mx - layout.photo.x;
      dragOffsetY.current = my - layout.photo.y;
    } else if (hit === "qr") {
      dragOffsetX.current = mx - layout.qr.x;
      dragOffsetY.current = my - layout.qr.y;
    } else if (hit === "name") {
      dragOffsetY.current = my - layout.name.y;
    } else if (hit === "team") {
      dragOffsetY.current = my - layout.team.y;
    } else if (hit === "footer") {
      dragOffsetY.current = my - layout.footer.y;
    } else if (hit === "contact") {
      dragOffsetX.current = mx - layout.contact.x;
      dragOffsetY.current = my - layout.contact.y;
    }
    // photo-se y qr-se: sin offset, usan posición raw del mouse
    e.preventDefault();
  }, [layout]);

  const handlePreviewMouseMove = useCallback((e: React.MouseEvent) => {
    if (!previewRef.current) return;
    const rect  = previewRef.current.getBoundingClientRect();
    const scale = previewScaleRef.current;
    const mx    = (e.clientX - rect.left)  / scale;
    const my    = (e.clientY - rect.top)   / scale;
    const { w: dCW, h: dCH } = getCardDimensions(layout.preset);

    if (!draggingElRef.current) {
      setHoverEl(getHitElement(mx, my, layout, dCW, dCH));
      return;
    }

    const hit = draggingElRef.current;

    // Helper local para actualizar el slot activo durante el drag
    function dragUpdate(updater: (s: CardSlot) => CardSlot) {
      setSlots(prev => {
        const next = [...prev] as [CardSlot, CardSlot, CardSlot];
        const i = currentTabRef.current;
        next[i] = updater(next[i]);
        return next;
      });
    }

    if (hit === "photo") {
      const rawX   = mx - dragOffsetX.current;
      const rawY   = my - dragOffsetY.current;
      const cX     = (dCW - layout.photo.diameter) / 2;
      const cY     = (dCH - layout.photo.diameter) / 2;
      const newX   = Math.max(0, Math.min(dCW - layout.photo.diameter, Math.round(snapVal(rawX, cX, snapCenter))));
      const newY   = Math.max(0, Math.min(dCH - layout.photo.diameter, Math.round(snapVal(rawY, cY, snapCenter))));
      setDragCoords({ x: newX, y: newY });
      dragUpdate(s => ({ ...s, layout: { ...s.layout, photo: { ...s.layout.photo, x: newX, y: newY } } }));

    } else if (hit === "photo-se") {
      // Resize: distancia desde el centro de la foto hasta el mouse = nuevo radio
      const photoCX = layout.photo.x + layout.photo.diameter / 2;
      const photoCY = layout.photo.y + layout.photo.diameter / 2;
      const newD    = Math.max(60, Math.round(2 * Math.max(Math.abs(mx - photoCX), Math.abs(my - photoCY))));
      setDragCoords({ y: newD }); // reutilizamos dragCoords para mostrar el diámetro
      dragUpdate(s => ({ ...s, layout: { ...s.layout, photo: { ...s.layout.photo, diameter: newD } } }));

    } else if (hit === "qr") {
      const rawX  = mx - dragOffsetX.current;
      const rawY  = my - dragOffsetY.current;
      const cX    = (dCW - layout.qr.w) / 2;
      const cY    = (dCH - layout.qr.height) / 2;
      const newX  = Math.max(0, Math.min(dCW - layout.qr.w, Math.round(snapVal(rawX, cX, snapCenter))));
      const newY  = Math.max(0, Math.min(dCH - layout.qr.height - 10, Math.round(snapVal(rawY, cY, snapCenter))));
      setDragCoords({ x: newX, y: newY });
      dragUpdate(s => ({ ...s, layout: { ...s.layout, qr: { ...s.layout.qr, x: newX, y: newY } } }));

    } else if (hit === "qr-se") {
      // Resize QR: anchor top-left, mouse define esquina inferior-derecha
      const newW = Math.max(80,  Math.round(mx - layout.qr.x));
      const newH = Math.max(60,  Math.round(my - layout.qr.y));
      const clampedW = Math.min(dCW - layout.qr.x, newW);
      const clampedH = Math.min(dCH - layout.qr.y, newH);
      setDragCoords({ x: clampedW, y: clampedH });
      dragUpdate(s => ({ ...s, layout: { ...s.layout, qr: { ...s.layout.qr, w: clampedW, height: clampedH } } }));

    } else if (hit === "name") {
      const rawY = my - dragOffsetY.current;
      const newY = Math.max(0, Math.min(dCH - 60, Math.round(rawY)));
      setDragCoords({ y: newY });
      dragUpdate(s => ({ ...s, layout: { ...s.layout, name: { ...s.layout.name, y: newY } } }));

    } else if (hit === "team") {
      const rawY = my - dragOffsetY.current;
      const newY = Math.max(0, Math.min(dCH - 30, Math.round(rawY)));
      setDragCoords({ y: newY });
      dragUpdate(s => ({ ...s, layout: { ...s.layout, team: { ...s.layout.team, y: newY } } }));

    } else if (hit === "footer") {
      const rawY = my - dragOffsetY.current;
      const newY = Math.max(400, Math.min(dCH - 40, Math.round(rawY)));
      setDragCoords({ y: newY });
      dragUpdate(s => ({ ...s, layout: { ...s.layout, footer: { ...s.layout.footer, y: newY } } }));

    } else if (hit === "contact") {
      const rawX   = mx - dragOffsetX.current;
      const rawY   = my - dragOffsetY.current;
      const cXCenter = (dCW - layout.contact.width) / 2;
      const newX   = Math.max(0, Math.min(dCW - layout.contact.width, Math.round(snapVal(rawX, cXCenter, snapCenter))));
      const newY   = Math.max(0, Math.min(dCH - 50, Math.round(rawY)));
      setDragCoords({ x: newX, y: newY });
      dragUpdate(s => ({ ...s, layout: { ...s.layout, contact: { ...s.layout.contact, x: newX, y: newY } } }));
    }
  }, [layout, snapCenter]);

  const handlePreviewMouseUp = useCallback(() => {
    draggingElRef.current = null;
    setDraggingEl(null);
    setHoverEl(null);
    setDragCoords(null);
  }, []);

  function updatePhoto(key: keyof CardLayout["photo"], value: number | string | boolean) {
    updateCurrentSlot(s => ({ ...s, layout: { ...s.layout, photo: { ...s.layout.photo, [key]: value } as CardLayout["photo"] } }));
  }
  function updateQr(key: keyof CardLayout["qr"], value: number | string | boolean) {
    updateCurrentSlot(s => ({ ...s, layout: { ...s.layout, qr: { ...s.layout.qr, [key]: value } as CardLayout["qr"] } }));
  }
  function updateName(key: keyof CardLayout["name"], value: number | string | boolean) {
    updateCurrentSlot(s => ({ ...s, layout: { ...s.layout, name: { ...s.layout.name, [key]: value } as CardLayout["name"] } }));
  }
  function updateTeam(key: keyof CardLayout["team"], value: number | string | boolean) {
    updateCurrentSlot(s => ({ ...s, layout: { ...s.layout, team: { ...s.layout.team, [key]: value } as CardLayout["team"] } }));
  }
  function updateSlogan(key: keyof CardLayout["slogan"], value: number | string | boolean) {
    updateCurrentSlot(s => ({ ...s, layout: { ...s.layout, slogan: { ...s.layout.slogan, [key]: value } as CardLayout["slogan"] } }));
  }
  function updateFooter(key: keyof CardLayout["footer"], value: number | string | boolean) {
    updateCurrentSlot(s => ({ ...s, layout: { ...s.layout, footer: { ...s.layout.footer, [key]: value } as CardLayout["footer"] } }));
  }
  function updateContact(key: keyof CardLayout["contact"], value: number) {
    updateCurrentSlot(s => ({ ...s, layout: { ...s.layout, contact: { ...s.layout.contact, [key]: value } as CardLayout["contact"] } }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-dojo-muted">Cargando editor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
          <CreditCard size={28} className="text-dojo-red" /> Diseño de Carnet
        </h1>
        <p className="text-dojo-muted text-sm mt-1">
          Personaliza la posición de los elementos del carnet para este dojo
        </p>
      </div>

      {/* Selector de dojo (sysadmin) */}
      {role === "sysadmin" && (
        <div className="card">
          <label className="form-label mb-2 block">Seleccionar Dojo</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="form-input"
          >
            {dojoList.map(d => <option key={d.id} value={d.id}>{d.name} ({d.slug})</option>)}
          </select>
        </div>
      )}

      {/* ── Tabs de diseños ─────────────────────────────────────────────── */}
      <div className="flex gap-2 items-center flex-wrap">
        {([1, 2, 3] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setCurrentTab(tab)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors",
              currentTab === tab
                ? "bg-dojo-red text-white border-dojo-red"
                : "bg-transparent text-dojo-muted border-dojo-border hover:border-dojo-red/50"
            )}
          >
            Diseño {tab}
            {activeSlot === tab && (
              <span className="inline-flex items-center gap-0.5 text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded-full font-normal">
                ✓ Activo
              </span>
            )}
          </button>
        ))}
        {activeSlot !== currentTab && (
          <button
            onClick={() => setActiveSlot(currentTab)}
            className="ml-2 px-3 py-2 rounded-lg text-xs font-semibold border border-green-600/50 text-green-400 hover:bg-green-600/10 transition-colors"
          >
            ✓ Usar este diseño
          </button>
        )}
        {activeSlot === currentTab && (
          <span className="ml-2 text-xs text-green-500">Este diseño está activo en el carnet</span>
        )}

        {/* Botón Guardar — también arriba para no tener que bajar */}
        <div className="ml-auto flex items-center gap-3">
          {saved && <span className="text-green-400 text-sm">¡Guardado!</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Save size={14} /> {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-start">

        {/* ── Preview ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 sticky top-4">
          <div className="bg-dojo-darker border border-dojo-border rounded-2xl p-4 shadow-xl">
            <CardPreview
              layout={layout}
              templateUrl={templateUrl}
              dojoName={dojoName}
              draggingEl={draggingEl}
              hoverEl={hoverEl}
              showGrid={showGrid}
              showGuides={showGuides}
              snapCenter={snapCenter}
              dragCoords={dragCoords}
              onPreviewMouseDown={handlePreviewMouseDown}
              onPreviewMouseMove={handlePreviewMouseMove}
              onPreviewMouseUp={handlePreviewMouseUp}
              previewRef={previewRef}
            />
          </div>

          {/* ── Toolbar de herramientas ─────────────── */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
            {/* Toggle grid */}
            <button
              onClick={() => setShowGrid(g => !g)}
              title="Cuadrícula (50px)"
              className={cn(
                "px-2 py-1 rounded text-[10px] font-semibold border transition-colors",
                showGrid ? "bg-blue-500/20 border-blue-400 text-blue-300" : "border-dojo-border text-dojo-muted hover:border-dojo-muted"
              )}
            >&#8862; Grid</button>

            {/* Toggle guías */}
            <button
              onClick={() => setShowGuides(g => !g)}
              title="Guías de centro"
              className={cn(
                "px-2 py-1 rounded text-[10px] font-semibold border transition-colors",
                showGuides ? "bg-blue-500/20 border-blue-400 text-blue-300" : "border-dojo-border text-dojo-muted hover:border-dojo-muted"
              )}
            >&#8853; Guías</button>

            {/* Toggle snap */}
            <button
              onClick={() => setSnapCenter(s => !s)}
              title="Snap al centro"
              className={cn(
                "px-2 py-1 rounded text-[10px] font-semibold border transition-colors",
                snapCenter ? "bg-orange-500/20 border-orange-400 text-orange-300" : "border-dojo-border text-dojo-muted hover:border-dojo-muted"
              )}
            >&#8891; Snap</button>

            <div className="w-px h-4 bg-dojo-border" />

            {/* Centrar foto H */}
            <button
              onClick={() => updateCurrentSlot(s => ({
                ...s,
                layout: { ...s.layout, photo: { ...s.layout.photo, x: Math.round((CW - s.layout.photo.diameter) / 2) } },
              }))}
              title="Centrar foto horizontalmente"
              className="px-2 py-1 rounded text-[10px] font-semibold border border-dojo-border text-dojo-muted hover:border-dojo-red/60 hover:text-dojo-white transition-colors"
            >&#8859; Foto H</button>

            {/* Foto posición estándar Y */}
            <button
              onClick={() => updateCurrentSlot(s => ({
                ...s,
                layout: { ...s.layout, photo: { ...s.layout.photo, y: Math.round(CH * 0.12) } },
              }))}
              title="Foto en posición estándar (arriba)"
              className="px-2 py-1 rounded text-[10px] font-semibold border border-dojo-border text-dojo-muted hover:border-dojo-red/60 hover:text-dojo-white transition-colors"
            >&#8859; Foto Y</button>
          </div>

          <p className="text-[10px] text-dojo-muted text-center">
            Arrastra foto · QR · contacto · nombre · team · footer · usa &#9632; para redimensionar · {CW} &times; {CH} px
          </p>

          {/* Botón reset */}
          <button
            onClick={() => updateCurrentSlot(s => ({ ...s, layout: s.layout.preset === "landscape" ? DEFAULT_LANDSCAPE_LAYOUT : DEFAULT_CARD_LAYOUT }))}
            className="btn-ghost text-xs flex items-center gap-1.5 text-dojo-muted"
          >
            <RefreshCw size={13} /> Restablecer posiciones por defecto
          </button>
        </div>

        {/* ── Controles — scroll independiente para que el preview quede siempre visible */}
        <div className="space-y-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1 lg:pb-4">

          {/* 1. Dimensiones del carnet */}
          <CollapsibleSection title="Dimensiones del Carnet" icon={Maximize2} defaultOpen={false}>
            <p className="text-xs text-dojo-muted">
              Cambiar orientación restablece posiciones a valores por defecto.
            </p>
            <div className="flex gap-2">
              {CARD_PRESETS.map(p => (
                <button
                  key={p.key}
                  onClick={() => handlePresetChange(p.key)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded text-xs font-semibold border transition-colors",
                    layout.preset === p.key
                      ? "bg-dojo-red text-white border-dojo-red"
                      : "bg-transparent text-dojo-muted border-dojo-border hover:border-dojo-red/50"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </CollapsibleSection>

          {/* 2. Plantilla de fondo */}
          <CollapsibleSection title="Plantilla de Fondo" icon={ImageIcon}>
            <p className="text-dojo-muted text-xs">
              Imagen de fondo del carnet. Recomendado: {CW} &times; {CH} px &middot; Máximo 5 MB
            </p>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => !tplUploading && tplFileRef.current?.click()}
                disabled={tplUploading}
                className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-60"
              >
                {tplUploading
                  ? <><Loader2 size={14} className="animate-spin" /> Subiendo...</>
                  : <><Upload size={14} /> Subir imagen</>
                }
              </button>
              {templateUrl && !tplUploading && (
                <button
                  onClick={() => updateCurrentSlot(s => ({ ...s, templateUrl: null }))}
                  className="btn-ghost text-red-400 hover:text-red-300 flex items-center gap-1.5 text-sm"
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              )}
            </div>
            {tplError && <p className="text-xs text-red-400">{tplError}</p>}
            {templateUrl && <p className="text-xs text-green-400">&#10003; Plantilla cargada</p>}
            <input
              ref={tplFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleTplFileChange}
            />
          </CollapsibleSection>

          {/* 3. Foto del alumno */}
          <CollapsibleSection title="Foto del Alumno" icon={Move} hint="Arrastrar en preview">
            {/* Shape toggle */}
            <div className="flex gap-2">
              {(["circle", "rectangle"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => updatePhoto("shape", s)}
                  className={cn(
                    "flex-1 py-1.5 px-3 rounded text-xs font-semibold border transition-colors",
                    layout.photo.shape === s
                      ? "bg-dojo-red text-white border-dojo-red"
                      : "bg-transparent text-dojo-muted border-dojo-border hover:border-dojo-red/50"
                  )}
                >
                  {s === "circle" ? "Círculo" : "Cuadrado"}
                </button>
              ))}
            </div>
            <SliderRow
              label="Posición X (izquierda)"
              value={layout.photo.x}
              min={0} max={CW - layout.photo.diameter}
              onChange={v => updatePhoto("x", v)}
            />
            <SliderRow
              label="Posición Y (arriba)"
              value={layout.photo.y}
              min={0} max={CH - layout.photo.diameter}
              onChange={v => updatePhoto("y", v)}
            />
            <SliderRow
              label="Diámetro"
              value={layout.photo.diameter}
              min={100} max={500}
              onChange={v => updatePhoto("diameter", v)}
            />
            <ToggleRow
              label="Marco de la foto"
              checked={layout.photo.borderWidth > 0}
              onChange={v => updateCurrentSlot(s => ({
                ...s,
                layout: { ...s.layout, photo: { ...s.layout.photo, borderWidth: v ? (s.layout.photo.borderWidth || 4) : 0 } },
              }))}
            />
            {layout.photo.borderWidth > 0 && (
              <>
                <SliderRow
                  label="Grosor"
                  value={layout.photo.borderWidth}
                  min={1} max={12}
                  onChange={v => updatePhoto("borderWidth", v)}
                />
                <ColorRow
                  label="Color del marco"
                  value={layout.photo.borderColor}
                  onChange={v => updatePhoto("borderColor", v)}
                />
              </>
            )}
          </CollapsibleSection>

          {/* 4. Nombre del alumno */}
          <CollapsibleSection title="Nombre del Alumno" icon={Type}>
            <SliderRow
              label="Posición Y"
              value={layout.name.y}
              min={0} max={CH - 60}
              onChange={v => updateName("y", v)}
            />
            <SliderRow
              label="Tamaño de fuente"
              value={layout.name.fontSize}
              min={16} max={70}
              onChange={v => updateName("fontSize", v)}
            />
            <ColorRow label="Color" value={layout.name.color} onChange={v => updateName("color", v)} />
            <FontRow  label="Fuente" value={layout.name.fontFamily} onChange={v => updateName("fontFamily", v)} />
            <SliderRow
              label="Espaciado de letras"
              value={layout.name.letterSpacing}
              min={-5} max={30}
              onChange={v => updateName("letterSpacing", v)}
            />
            <div className="border-t border-dojo-border/50 pt-2 space-y-2">
              <ToggleRow
                label="Sombra"
                checked={layout.name.shadowEnabled}
                onChange={v => updateName("shadowEnabled", v)}
              />
              {layout.name.shadowEnabled && (
                <>
                  <ColorRow
                    label="Color sombra"
                    value={layout.name.shadowColor}
                    onChange={v => updateName("shadowColor", v)}
                  />
                  <SliderRow
                    label="X sombra"
                    value={layout.name.shadowX}
                    min={-20} max={20}
                    onChange={v => updateName("shadowX", v)}
                  />
                  <SliderRow
                    label="Y sombra"
                    value={layout.name.shadowY}
                    min={-20} max={20}
                    onChange={v => updateName("shadowY", v)}
                  />
                  <SliderRow
                    label="Desenfoque"
                    value={layout.name.shadowBlur}
                    min={0} max={30}
                    onChange={v => updateName("shadowBlur", v)}
                  />
                </>
              )}
            </div>
            <div className="border-t border-dojo-border/50 pt-2 space-y-2">
              <ToggleRow
                label="Contorno"
                checked={layout.name.outlineEnabled}
                onChange={v => updateName("outlineEnabled", v)}
              />
              {layout.name.outlineEnabled && (
                <>
                  <ColorRow
                    label="Color contorno"
                    value={layout.name.outlineColor}
                    onChange={v => updateName("outlineColor", v)}
                  />
                  <SliderRow
                    label="Grosor"
                    value={layout.name.outlineWidth}
                    min={1} max={8}
                    onChange={v => updateName("outlineWidth", v)}
                  />
                </>
              )}
            </div>
          </CollapsibleSection>

          {/* 5. Línea de equipo */}
          <CollapsibleSection title="Línea de Equipo" icon={Palette}>
            <SliderRow
              label="Posición Y"
              value={layout.team.y}
              min={0} max={CH - 30}
              onChange={v => updateTeam("y", v)}
            />
            <ColorRow label="Color" value={layout.team.color} onChange={v => updateTeam("color", v)} />
          </CollapsibleSection>

          {/* 6. Zona QR */}
          <CollapsibleSection title="Zona QR" icon={CreditCard}>
            <SliderRow
              label="Posición X (izquierda)"
              value={layout.qr.x}
              min={0} max={CW - 80}
              onChange={v => updateQr("x", v)}
            />
            <SliderRow
              label="Posición Y (inicio)"
              value={layout.qr.y}
              min={200} max={800}
              onChange={v => updateQr("y", v)}
            />
            <SliderRow
              label="Ancho"
              value={layout.qr.w}
              min={80} max={CW - layout.qr.x}
              onChange={v => updateQr("w", v)}
            />
            <SliderRow
              label="Altura"
              value={layout.qr.height}
              min={100} max={450}
              onChange={v => updateQr("height", v)}
            />
            <div className="border-t border-dojo-border/50 pt-2 space-y-2">
              <ToggleRow
                label="Marco del QR"
                checked={layout.qr.frameBorderWidth > 0}
                onChange={v => updateCurrentSlot(s => ({
                  ...s,
                  layout: {
                    ...s.layout,
                    qr: {
                      ...s.layout.qr,
                      frameBorderWidth: v ? (s.layout.qr.frameBorderWidth || 2) : 0,
                      frameBorderColor: s.layout.qr.frameBorderColor || "#CC0000",
                    },
                  },
                }))}
              />
              {layout.qr.frameBorderWidth > 0 && (
                <>
                  <SliderRow
                    label="Grosor"
                    value={layout.qr.frameBorderWidth}
                    min={1} max={8}
                    onChange={v => updateQr("frameBorderWidth", v)}
                  />
                  <ColorRow
                    label="Color del marco"
                    value={layout.qr.frameBorderColor || "#CC0000"}
                    onChange={v => updateQr("frameBorderColor", v)}
                  />
                </>
              )}
              <ToggleRow
                label="Fondo transparente"
                checked={layout.qr.bgTransparent}
                onChange={v => updateQr("bgTransparent", v)}
              />
            </div>
          </CollapsibleSection>

          {/* 7. Footer y Slogan */}
          <CollapsibleSection title="Footer y Slogan" icon={Palette}>
            <div className="space-y-1">
              <label className="text-xs text-dojo-muted block">Texto del slogan</label>
              <input
                type="text"
                value={layout.slogan.text}
                onChange={e => updateSlogan("text", e.target.value)}
                placeholder="(usa el slogan del dojo si está vacío)"
                className="form-input text-sm w-full"
              />
            </div>
            <SliderRow
              label="Inicio del footer"
              value={layout.footer.y}
              min={600} max={CH - 40}
              onChange={v => updateFooter("y", v)}
            />
            <ColorRow
              label="Color del fondo"
              value={layout.footer.background}
              onChange={v => updateFooter("background", v)}
            />
            <SliderRow
              label="Tamaño del slogan"
              value={layout.slogan.fontSize}
              min={9} max={24}
              onChange={v => updateSlogan("fontSize", v)}
            />
            <ColorRow
              label="Color del slogan"
              value={layout.slogan.color}
              onChange={v => updateSlogan("color", v)}
            />
            <FontRow
              label="Fuente del slogan"
              value={layout.slogan.fontFamily}
              onChange={v => updateSlogan("fontFamily", v)}
            />
          </CollapsibleSection>

          {/* 8. Acudiente / Contacto */}
          <CollapsibleSection title="Acudiente / Contacto" icon={Palette}>
            <ColorRow
              label="Color del texto"
              value={layout.contactColor}
              onChange={v => updateCurrentSlot(s => ({ ...s, layout: { ...s.layout, contactColor: v } }))}
            />
            <SliderRow label="Posición X" value={layout.contact.x} min={0} max={CW - 40} step={1}
              onChange={v => updateContact("x", v)} />
            <SliderRow label="Posición Y" value={layout.contact.y} min={0} max={CH - 40} step={1}
              onChange={v => updateContact("y", v)} />
            <SliderRow label="Ancho" value={layout.contact.width} min={40} max={CW} step={1}
              onChange={v => updateContact("width", v)} />
          </CollapsibleSection>

          {/* Guardar */}
          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              <Save size={16} /> {saving ? "Guardando..." : "Guardar diseño"}
            </button>
            {saved && <span className="text-green-400 text-sm">¡Diseño guardado!</span>}
          </div>

          <div className="card bg-dojo-darker/50">
            <p className="text-xs text-dojo-muted leading-relaxed">
              <strong className="text-dojo-white">Nota:</strong> Estos cambios aplican únicamente a este dojo.
              Todos los dojos comparten el mismo sistema de diseño configurable.
              Los cambios se verán reflejados en el carnet de cada alumno al regenerar la página de su carnet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
