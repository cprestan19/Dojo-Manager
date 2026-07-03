"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { OBSSetupGuide } from "@/components/tournaments/OBSSetupGuide";

interface Tatami {
  id: string;
  name: string;
  color: string;
  streamStatus: string;
  currentMatchId: string | null;
}

interface Tournament {
  name: string;
}

export default function OverlaySelector() {
  const { id } = useParams<{ id: string }>();
  const [tatamis, setTatamis]       = useState<Tatami[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [copied, setCopied]         = useState<string | null>(null);
  const [origin, setOrigin]         = useState("");
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);

    async function load() {
      try {
        const [tRes, tTRes] = await Promise.all([
          fetch(`/api/tournaments/${id}`),
          fetch(`/api/tournaments/${id}/tatami`),
        ]);

        if (tRes.status === 401 || tTRes.status === 401) {
          setError("No autorizado (401). Asegúrate de estar logueado.");
          return;
        }
        if (tRes.status === 403 || tTRes.status === 403) {
          setError("Sin permiso (403). Si eres sysadmin, entra primero a un dojo desde /dashboard/dojos.");
          return;
        }
        if (!tRes.ok) {
          setError(`Error al cargar el torneo (${tRes.status}). Verifica que el ID del torneo en la URL sea correcto.`);
          return;
        }

        const tData = await tRes.json();
        // El endpoint devuelve el objeto torneo directamente o dentro de .tournament
        const name = tData?.name ?? tData?.tournament?.name ?? "";
        setTournament({ name });

        if (tTRes.ok) {
          const tatData = await tTRes.json();
          // Puede ser un array directo o un objeto con error
          if (Array.isArray(tatData)) {
            setTatamis(tatData);
          } else {
            setError(`Error al cargar tatamis: ${tatData?.error ?? JSON.stringify(tatData)}`);
          }
        } else {
          const errData = await tTRes.json().catch(() => ({}));
          setError(`Error al cargar tatamis (${tTRes.status}): ${errData?.error ?? "desconocido"}`);
        }
      } catch (e) {
        setError(`Error de red: ${e}`);
      }
    }
    load();

    const iv = setInterval(async () => {
      const r = await fetch(`/api/tournaments/${id}/tatami`);
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d)) setTatamis(d);
      }
    }, 4000);
    return () => clearInterval(iv);
  }, [id]);

  function copy(tatamiId: string) {
    const url = `${origin}/tournament/${id}/overlay/${tatamiId}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(tatamiId);
    setTimeout(() => setCopied(null), 2000);
  }

  const statusDot = (s: string) =>
    s === "live" ? "#22c55e" : s === "finished" ? "#f59e0b" : "#6b7280";

  const statusLabel = (s: string) =>
    s === "live" ? "EN VIVO" : s === "finished" ? "Finalizado" : "Sin transmisión";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0b0f14",
      color: "white",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: "48px 40px",
    }}>
      {/* Header */}
      <div style={{ marginBottom: "40px" }}>
        <p style={{ color: "#6b7280", fontSize: "13px", marginBottom: "6px", letterSpacing: "0.05em" }}>
          OVERLAYS OBS — {tournament?.name ?? "Torneo"}
        </p>
        <h1 style={{ fontSize: "28px", fontWeight: 800, margin: 0 }}>
          Selecciona un tatami
        </h1>
        <p style={{ color: "#9ca3af", fontSize: "14px", marginTop: "10px" }}>
          Copia la URL y pégala en OBS como fuente de tipo <strong style={{ color: "#e5e7eb" }}>Navegador</strong> (1920 × 1080, fondo transparente).
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          maxWidth: "720px", marginBottom: "24px",
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)",
          borderRadius: "10px", padding: "14px 18px",
          color: "#fca5a5", fontSize: "13px", lineHeight: 1.6,
        }}>
          <strong style={{ color: "#f87171" }}>Error:</strong> {error}
          <div style={{ marginTop: "8px", color: "#6b7280", fontSize: "12px" }}>
            Tournament ID en la URL: <code style={{ color: "#9ca3af" }}>{id}</code>
          </div>
        </div>
      )}

      {/* Tatami cards */}
      {!error && tatamis.length === 0 ? (
        <div>
          <p style={{ color: "#6b7280", marginBottom: "8px" }}>No hay tatamis configurados para este torneo.</p>
          <p style={{ color: "#4b5563", fontSize: "12px" }}>
            Tournament ID: <code style={{ color: "#6b7280" }}>{id}</code>
            <br />
            Verifica que los tatamis estén creados en el dashboard del torneo.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "720px" }}>
          {tatamis.map(t => {
            const overlayUrl = `${origin}/tournament/${id}/overlay/${t.id}`;
            const isCopied   = copied === t.id;

            return (
              <div key={t.id} style={{
                background: "#161b22",
                border: "1px solid #2d333b",
                borderRadius: "12px",
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}>
                {/* Color dot */}
                <div style={{
                  width: "16px", height: "16px", borderRadius: "50%",
                  background: t.color, flexShrink: 0,
                  boxShadow: `0 0 8px ${t.color}80`,
                }} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span style={{ fontWeight: 700, fontSize: "16px" }}>{t.name}</span>
                    <span style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em",
                      color: statusDot(t.streamStatus),
                    }}>
                      <span style={{
                        width: "7px", height: "7px", borderRadius: "50%",
                        background: statusDot(t.streamStatus), display: "inline-block",
                      }} />
                      {statusLabel(t.streamStatus)}
                    </span>
                    {t.currentMatchId && (
                      <span style={{
                        background: "rgba(34,197,94,0.15)",
                        color: "#4ade80",
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "4px",
                        letterSpacing: "0.04em",
                      }}>
                        ▶ Match activo
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontFamily: "monospace",
                    fontSize: "12px",
                    color: "#6b7280",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {overlayUrl}
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  <button
                    onClick={() => copy(t.id)}
                    style={{
                      background: isCopied ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)",
                      border: `1px solid ${isCopied ? "#4ade80" : "#374151"}`,
                      color: isCopied ? "#4ade80" : "white",
                      borderRadius: "8px",
                      padding: "8px 16px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isCopied ? "✓ Copiado" : "Copiar URL"}
                  </button>
                  <a
                    href={overlayUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid #374151",
                      color: "#9ca3af",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Vista previa ↗
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* OBS Setup Guide — reemplaza el help box manual */}
      <div style={{ maxWidth: "720px" }}>
        <OBSSetupGuide selectorUrl={origin ? `${origin}/tournament/${id}/overlay` : ""} />
      </div>
    </div>
  );
}
