"use client";
import { useState } from "react";
import { Monitor, Copy, Check, ExternalLink, Settings } from "lucide-react";
import { OVERLAY_PRESETS } from "@/lib/tournament-categories";
type OverlayPreset = typeof OVERLAY_PRESETS[number];

interface Props {
  /** URL base del overlay (sin tatamiId — es el selector) */
  selectorUrl: string;
}

export function OBSSetupGuide({ selectorUrl }: Props) {
  const [copied,       setCopied]       = useState(false);
  const [showPresets,  setShowPresets]  = useState(false);
  const [selectedPreset, setPreset]    = useState<OverlayPreset>(OVERLAY_PRESETS[0]);

  function copy() {
    navigator.clipboard?.writeText(selectorUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const bg     = "#161b22";
  const border = "rgba(255,255,255,0.1)";

  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: "14px",
      padding: "20px 24px",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      marginTop: "32px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
        <Monitor size={18} style={{ color: "#C0392B", flexShrink: 0 }} />
        <p style={{ color: "white", fontWeight: 700, fontSize: "15px", margin: 0 }}>
          📹 Configuración OBS — 3 pasos
        </p>
      </div>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

        {/* Step 1 */}
        <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
          <span style={{
            width: "24px", height: "24px", borderRadius: "50%",
            background: "rgba(192,57,43,0.2)", border: "1px solid rgba(192,57,43,0.5)",
            color: "#C0392B", fontSize: "13px", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>1</span>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", lineHeight: 1.6, margin: 0 }}>
            En OBS: <strong style={{ color: "white" }}>Fuentes → + → Fuente de navegador (Browser Source)</strong>
          </p>
        </div>

        {/* Step 2 — URL */}
        <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
          <span style={{
            width: "24px", height: "24px", borderRadius: "50%",
            background: "rgba(192,57,43,0.2)", border: "1px solid rgba(192,57,43,0.5)",
            color: "#C0392B", fontSize: "13px", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>2</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", marginBottom: "8px" }}>
              Pega la URL del tatami que quieres transmitir:
            </p>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <code style={{
                flex: 1, background: "rgba(0,0,0,0.4)", border: `1px solid ${border}`,
                borderRadius: "6px", padding: "7px 10px",
                color: "rgba(255,255,255,0.6)", fontSize: "11px", fontFamily: "monospace",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {selectorUrl.replace(/^https?:\/\/[^/]+/, "")}/[tatamiId]
              </code>
              <button
                onClick={copy}
                style={{
                  background: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)",
                  border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : border}`,
                  borderRadius: "6px", padding: "7px 12px",
                  color: copied ? "#4ade80" : "white",
                  cursor: "pointer", fontSize: "12px", fontWeight: 600,
                  display: "flex", alignItems: "center", gap: "5px",
                  flexShrink: 0, transition: "all 0.15s",
                }}
              >
                {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
              </button>
            </div>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", marginTop: "5px" }}>
              Obtén la URL exacta de cada tatami en la lista de abajo.
            </p>
          </div>
        </div>

        {/* Step 3 — Dimensiones */}
        <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
          <span style={{
            width: "24px", height: "24px", borderRadius: "50%",
            background: "rgba(192,57,43,0.2)", border: "1px solid rgba(192,57,43,0.5)",
            color: "#C0392B", fontSize: "13px", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>3</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", margin: 0 }}>
                Dimensiones:&nbsp;
                <strong style={{ color: "white" }}>
                  {selectedPreset.width} × {selectedPreset.height}
                </strong>
              </p>
              <button
                onClick={() => setShowPresets(p => !p)}
                style={{
                  background: "rgba(255,255,255,0.06)", border: `1px solid ${border}`,
                  borderRadius: "6px", padding: "3px 8px",
                  color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "11px",
                  display: "flex", alignItems: "center", gap: "4px",
                }}
              >
                <Settings size={11} /> Cambiar
              </button>
            </div>

            {showPresets && (
              <div style={{
                background: "rgba(0,0,0,0.4)", border: `1px solid ${border}`,
                borderRadius: "8px", overflow: "hidden", marginBottom: "8px",
              }}>
                {OVERLAY_PRESETS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => { setPreset(p); setShowPresets(false); }}
                    style={{
                      width: "100%", padding: "9px 14px",
                      background: p.value === selectedPreset.value ? "rgba(192,57,43,0.15)" : "none",
                      border: "none", borderBottom: `1px solid ${border}`,
                      color: p.value === selectedPreset.value ? "white" : "rgba(255,255,255,0.6)",
                      cursor: "pointer", textAlign: "left",
                      fontSize: "12px", display: "flex", justifyContent: "space-between",
                    }}
                  >
                    <span>{p.label}</span>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
                      {p.width}×{p.height}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Transparent background checkbox */}
            <label style={{
              display: "flex", alignItems: "center", gap: "8px",
              cursor: "default", color: "rgba(255,255,255,0.6)", fontSize: "13px",
            }}>
              <span style={{
                width: "16px", height: "16px", borderRadius: "4px",
                background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Check size={10} style={{ color: "#4ade80" }} />
              </span>
              Activar <strong style={{ color: "white" }}>"Enable Background Transparency"</strong>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px" }}>(obligatorio)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div style={{
        display: "flex", gap: "10px", marginTop: "18px",
        paddingTop: "16px", borderTop: `1px solid ${border}`,
      }}>
        <a
          href={selectorUrl}
          target="_blank" rel="noopener noreferrer"
          style={{
            flex: 1, padding: "9px 14px", borderRadius: "8px",
            background: "rgba(255,255,255,0.06)", border: `1px solid ${border}`,
            color: "rgba(255,255,255,0.6)", textDecoration: "none",
            fontSize: "12px", fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "white")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
        >
          <ExternalLink size={13} /> Ver selector de tatamis
        </a>
      </div>
    </div>
  );
}
