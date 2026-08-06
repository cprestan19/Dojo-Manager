"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, AlertTriangle, XCircle, Scale } from "lucide-react";

interface CategoryInfo {
  participantId: string; bracketName: string; weightCategory: string | null;
  min: number | null; max: number | null;
  declaredWeight: number | null; actualWeight: number | null;
  weighInStatus: string | null; weighedInAt: string | null;
}
interface WeighInResult {
  found: boolean;
  athlete?: { name: string; clubName: string; photoUrl: string | null };
  categories?: CategoryInfo[];
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ok:    { label: "Dentro del límite", color: "#22c55e" },
  over:  { label: "Sobrepeso",         color: "#ef4444" },
  under: { label: "Bajo peso",         color: "#f59e0b" },
};

function limitText(c: CategoryInfo): string {
  if (c.max !== null) return `Máx. ${c.max} kg`;
  if (c.min !== null) return `Mín. ${c.min} kg`;
  return "Sin límite (open)";
}

export default function WeighInPage() {
  const { id } = useParams<{ id: string }>();
  const [pin,          setPin]          = useState("");
  const [pinInput,     setPinInput]     = useState("");
  const [pinError,     setPinError]     = useState("");
  const [scanning,     setScanning]     = useState(false);
  const [result,       setResult]       = useState<WeighInResult | null>(null);
  const [qrInput,      setQrInput]      = useState("");
  const [weightInput,  setWeightInput]  = useState("");
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState("");
  const scannerRef    = useRef<unknown>(null);
  const containerRef  = useRef<HTMLDivElement>(null);

  function verifyPin() {
    if (!pinInput.trim()) return;
    setPinError("");
    setPin(pinInput.trim());
  }

  useEffect(() => {
    if (!pin || !scanning) return;
    let scanner: { stop: () => Promise<unknown> } | null = null;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (!containerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = new Html5Qrcode("weighin-scanner") as any;
      scanner = s;
      scannerRef.current = s;

      s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          if (!scanner) return;
          await scanner.stop();
          setScanning(false);
          await lookupQR(decodedText.trim().toUpperCase());
        },
        () => { /* ignore errors */ },
      ).catch((err: unknown) => {
        console.error("Scanner error:", err);
        setScanning(false);
      });
    });

    return () => { scanner?.stop().catch(() => {}); };
  }, [pin, scanning]); // eslint-disable-line react-hooks/exhaustive-deps

  async function lookupQR(qrCode: string) {
    setResult(null);
    setSaveError("");
    setWeightInput("");
    setQrInput(qrCode);
    try {
      const r = await fetch(`/api/public/tournament-weigh-in/${encodeURIComponent(qrCode)}?tournamentId=${encodeURIComponent(id)}&pin=${encodeURIComponent(pin)}`);
      if (r.status === 403) { setPinError("PIN incorrecto"); setPin(""); setScanning(false); return; }
      if (r.status === 404) { setResult({ found: false }); return; }
      setResult(await r.json());
    } catch { setResult({ found: false }); }
  }

  async function confirmWeighIn() {
    const w = parseFloat(weightInput);
    if (!pin || !w || w <= 0) return;
    setSaving(true);
    setSaveError("");
    try {
      const r = await fetch(`/api/public/tournament-weigh-in/${encodeURIComponent(qrInput)}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pin, tournamentId: id, actualWeight: w }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 403) { setPinError("PIN incorrecto"); setPin(""); }
        else setSaveError(d.error ?? "Error al guardar");
        return;
      }
      await lookupQR(qrInput);
      setWeightInput("");
    } finally { setSaving(false); }
  }

  const bg = "#0d1117";

  // ── PIN entry ──────────────────────────────────────────────────────────────

  if (!pin) return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "36px 32px", width: "100%", maxWidth: "360px", textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚖️</div>
        <h2 style={{ color: "white", fontSize: "20px", fontWeight: 800, marginBottom: "6px" }}>Pesaje Digital</h2>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", marginBottom: "24px" }}>Torneo — Scanner de Pesaje</p>
        <input
          type="password" inputMode="numeric" maxLength={6}
          value={pinInput} onChange={e => setPinInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && verifyPin()}
          placeholder="PIN de acreditación"
          style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px", padding: "14px", color: "white", fontSize: "20px", textAlign: "center", letterSpacing: "0.3em", outline: "none", boxSizing: "border-box" }}
          autoFocus
        />
        {pinError && <p style={{ color: "#f87171", fontSize: "13px", marginTop: "8px" }}>{pinError}</p>}
        <button onClick={verifyPin} disabled={!pinInput.trim()} style={{ marginTop: "14px", width: "100%", background: "#C0392B", border: "none", borderRadius: "10px", padding: "14px", color: "white", fontWeight: 700, fontSize: "16px", cursor: "pointer" }}>
          Acceder →
        </button>
      </div>
    </div>
  );

  // ── Scanner / Result ───────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "sans-serif", padding: "20px" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ color: "white", fontWeight: 800, fontSize: "18px", margin: 0 }}>⚖️ Pesaje Digital</h2>
          <button onClick={() => setPin("")} style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "4px 10px", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "12px" }}>
            Cambiar PIN
          </button>
        </div>

        {!result ? (
          <div>
            {scanning ? (
              <div>
                <div id="weighin-scanner" ref={containerRef} style={{ borderRadius: "12px", overflow: "hidden" }} />
                <button onClick={() => setScanning(false)} style={{ marginTop: "12px", width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "12px", color: "white", cursor: "pointer", fontWeight: 600 }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <button onClick={() => setScanning(true)} style={{ padding: "28px", background: "rgba(192,57,43,0.15)", border: "2px dashed rgba(192,57,43,0.5)", borderRadius: "14px", color: "#C0392B", fontWeight: 700, fontSize: "18px", cursor: "pointer" }}>
                  📷 Escanear QR
                </button>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    value={qrInput} onChange={e => setQrInput(e.target.value.toUpperCase())}
                    placeholder="O ingresa el código manualmente..."
                    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", padding: "10px 12px", color: "white", fontSize: "14px", fontFamily: "monospace", outline: "none" }}
                  />
                  <button onClick={() => lookupQR(qrInput)} disabled={!qrInput.trim()} style={{ padding: "10px 16px", background: "#2563eb", border: "none", borderRadius: "8px", color: "white", fontWeight: 700, cursor: "pointer" }}>
                    Buscar
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            {!result.found ? (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.5)", borderRadius: "14px", padding: "32px", textAlign: "center" }}>
                <XCircle size={48} style={{ color: "#ef4444", margin: "0 auto 12px" }} />
                <p style={{ color: "white", fontWeight: 700, fontSize: "18px" }}>QR no encontrado</p>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", marginTop: "6px" }}>Código: {qrInput}</p>
              </div>
            ) : (
              <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "14px", padding: "24px" }}>
                {/* Athlete info */}
                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                  {result.athlete?.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result.athlete.photoUrl} alt="" style={{ width: "72px", height: "72px", borderRadius: "50%", objectFit: "cover", display: "block", margin: "0 auto 10px", border: "3px solid rgba(255,255,255,0.2)" }} />
                  )}
                  <p style={{ color: "white", fontSize: "20px", fontWeight: 900 }}>{result.athlete?.name}</p>
                  <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "13px" }}>{result.athlete?.clubName}</p>
                </div>

                {!result.categories || result.categories.length === 0 ? (
                  <p style={{ color: "#f59e0b", fontSize: "13px", textAlign: "center" }}>
                    Este atleta no está inscrito en ninguna categoría de kumite con límite de peso.
                  </p>
                ) : (
                  <>
                    {/* Weight input */}
                    <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                      <div style={{ flex: 1, position: "relative" }}>
                        <Scale size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.35)" }} />
                        <input
                          type="number" inputMode="decimal" step="0.1"
                          value={weightInput} onChange={e => setWeightInput(e.target.value)}
                          placeholder="Peso medido (kg)"
                          style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px", padding: "12px 12px 12px 38px", color: "white", fontSize: "16px", fontWeight: 700, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                      <button onClick={confirmWeighIn} disabled={saving || !weightInput}
                        style={{ padding: "0 20px", background: "#22c55e", border: "none", borderRadius: "10px", color: "white", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", opacity: saving || !weightInput ? 0.5 : 1 }}>
                        {saving ? "..." : "Registrar"}
                      </button>
                    </div>
                    {saveError && <p style={{ color: "#f87171", fontSize: "13px", marginBottom: "12px" }}>{saveError}</p>}

                    {/* Categories */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {result.categories.map(c => {
                        const status = c.weighInStatus ? STATUS_LABEL[c.weighInStatus] : null;
                        return (
                          <div key={c.participantId} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "12px 14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                              <span style={{ color: "white", fontSize: "13.5px", fontWeight: 700 }}>{c.bracketName}</span>
                              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>{limitText(c)}</span>
                            </div>
                            {c.declaredWeight != null && (
                              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "11.5px", marginTop: "2px" }}>Declarado: {c.declaredWeight} kg</p>
                            )}
                            {c.actualWeight != null && status && (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" }}>
                                {status.label === "Dentro del límite"
                                  ? <CheckCircle size={14} color={status.color} />
                                  : <AlertTriangle size={14} color={status.color} />}
                                <span style={{ color: status.color, fontSize: "13px", fontWeight: 700 }}>
                                  {c.actualWeight} kg — {status.label}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            <button onClick={() => { setResult(null); setQrInput(""); setWeightInput(""); }} style={{ marginTop: "14px", width: "100%", padding: "13px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", color: "white", fontWeight: 700, cursor: "pointer" }}>
              Nuevo Scan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
