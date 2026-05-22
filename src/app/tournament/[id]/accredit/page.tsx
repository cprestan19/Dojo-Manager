"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface AthleteResult {
  found:         boolean;
  type?:         "internal" | "external";
  canAccredit?:  boolean;
  status?:       "OK" | "WARNING";
  warnings?:     string[];
  athlete?: {
    id:           string;
    name:         string;
    clubName:     string;
    categories:   string[];
    nationality:  string | null;
    weight:       number | null;
    photoUrl:     string | null;
    accreditedAt: string | null;
    tournamentName: string;
  };
}

const WARNING_LABELS: Record<string, string> = {
  YA_ACREDITADO:   "⚠️ Ya fue acreditado anteriormente",
  PAGO_PENDIENTE:  "⚠️ Pago pendiente de confirmación",
  ATLETA_NO_APROBADO: "⚠️ Atleta no aprobado por el organizador",
  CLUB_NO_APROBADO:   "⚠️ Club no aprobado",
};

export default function AccreditPage() {
  const { id } = useParams<{ id: string }>();
  const [pin,          setPin]          = useState("");
  const [pinInput,     setPinInput]     = useState("");
  const [pinError,     setPinError]     = useState("");
  const [scanning,     setScanning]     = useState(false);
  const [result,       setResult]       = useState<AthleteResult | null>(null);
  const [accrediting,  setAccrediting]  = useState(false);
  const [qrInput,      setQrInput]      = useState("");
  const scannerRef    = useRef<unknown>(null);
  const containerRef  = useRef<HTMLDivElement>(null);

  // Validar PIN contra la API
  async function verifyPin() {
    if (!pinInput.trim()) return;
    setPinError("");
    // Intentamos una acreditación con un QR vacío — si responde 404 el PIN puede ser válido
    // Mejor: llamar a la API con un QR dummy para validar solo el PIN
    // Por simplicidad verificamos el PIN en el primer scan real
    setPin(pinInput.trim());
  }

  // Inicializar scanner html5-qrcode
  useEffect(() => {
    if (!pin || !scanning) return;

    let scanner: { stop: () => Promise<unknown> } | null = null;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (!containerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = new Html5Qrcode("accredit-scanner") as any;
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
        () => { /* ignore errors */ }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ).catch((err: unknown) => {
        console.error("Scanner error:", err);
        setScanning(false);
      });
    });

    return () => { scanner?.stop().catch(() => {}); };
  }, [pin, scanning]); // eslint-disable-line react-hooks/exhaustive-deps

  async function lookupQR(qrCode: string) {
    setResult(null);
    setQrInput(qrCode);
    try {
      const r = await fetch(`/api/public/tournament-accredit/${encodeURIComponent(qrCode)}`);
      if (r.status === 404) {
        setResult({ found: false });
        return;
      }
      const d: AthleteResult = await r.json();
      setResult(d);
    } catch {
      setResult({ found: false });
    }
  }

  async function confirmAccredit() {
    if (!result?.athlete || !pin) return;
    setAccrediting(true);
    try {
      const r = await fetch(`/api/public/tournament-accredit/${encodeURIComponent(qrInput)}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pin, tournamentId: id }),
      });
      const d = await r.json();
      if (r.ok) {
        setResult(prev => prev ? { ...prev, athlete: prev.athlete ? { ...prev.athlete, accreditedAt: d.accreditedAt } : prev.athlete, warnings: ["YA_ACREDITADO"] } : prev);
      } else {
        if (r.status === 403) { setPinError("PIN incorrecto"); setPin(""); }
      }
    } finally { setAccrediting(false); }
  }

  const bg = "#0d1117";

  // ── PIN entry ──────────────────────────────────────────────────────────────

  if (!pin) return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "36px 32px", width: "100%", maxWidth: "360px", textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎫</div>
        <h2 style={{ color: "white", fontSize: "20px", fontWeight: 800, marginBottom: "6px" }}>Control de Acceso</h2>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", marginBottom: "24px" }}>Torneo — Scanner de Acreditación</p>
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
          <h2 style={{ color: "white", fontWeight: 800, fontSize: "18px", margin: 0 }}>🎫 Acreditación</h2>
          <button onClick={() => setPin("")} style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "4px 10px", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "12px" }}>
            Cambiar PIN
          </button>
        </div>

        {/* Scanner area */}
        {!result ? (
          <div>
            {scanning ? (
              <div>
                <div id="accredit-scanner" ref={containerRef} style={{ borderRadius: "12px", overflow: "hidden" }} />
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
          /* Result card */
          <div>
            {!result.found ? (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.5)", borderRadius: "14px", padding: "32px", textAlign: "center" }}>
                <XCircle size={48} style={{ color: "#ef4444", margin: "0 auto 12px" }} />
                <p style={{ color: "white", fontWeight: 700, fontSize: "18px" }}>QR no encontrado</p>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", marginTop: "6px" }}>Código: {qrInput}</p>
              </div>
            ) : (
              <div style={{
                background: result.status === "OK" && !result.athlete?.accreditedAt ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
                border: `2px solid ${result.status === "OK" && !result.athlete?.accreditedAt ? "rgba(34,197,94,0.5)" : "rgba(245,158,11,0.5)"}`,
                borderRadius: "14px", padding: "24px",
              }}>
                {/* Status icon */}
                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                  {result.status === "OK" && !result.athlete?.accreditedAt
                    ? <CheckCircle size={48} style={{ color: "#22c55e", margin: "0 auto" }} />
                    : <AlertTriangle size={48} style={{ color: "#f59e0b", margin: "0 auto" }} />
                  }
                </div>

                {/* Athlete info */}
                {result.athlete && (
                  <>
                    {result.athlete.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={result.athlete.photoUrl} alt="" style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", display: "block", margin: "0 auto 12px", border: "3px solid rgba(255,255,255,0.2)" }} />
                    )}
                    <p style={{ color: "white", fontSize: "22px", fontWeight: 900, textAlign: "center", margin: "0 0 4px" }}>
                      {result.athlete.name}
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "14px", textAlign: "center", margin: "0 0 12px" }}>
                      {result.athlete.clubName}
                      {result.athlete.weight ? ` · ${result.athlete.weight}kg` : ""}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center", marginBottom: "12px" }}>
                      {result.athlete.categories.map(cat => (
                        <span key={cat} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "3px 10px", color: "rgba(255,255,255,0.7)", fontSize: "12px" }}>
                          {cat}
                        </span>
                      ))}
                    </div>
                    {result.athlete.accreditedAt && (
                      <p style={{ color: "#f59e0b", fontSize: "13px", textAlign: "center", marginBottom: "8px" }}>
                        Acreditado: {new Date(result.athlete.accreditedAt).toLocaleTimeString("es")}
                      </p>
                    )}
                  </>
                )}

                {/* Warnings */}
                {result.warnings?.map(w => (
                  <p key={w} style={{ color: "#fbbf24", fontSize: "13px", textAlign: "center", marginBottom: "4px" }}>
                    {WARNING_LABELS[w] ?? w}
                  </p>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
              <button onClick={() => { setResult(null); setQrInput(""); }} style={{ flex: 1, padding: "13px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", color: "white", fontWeight: 700, cursor: "pointer" }}>
                Nuevo Scan
              </button>
              {result.found && result.canAccredit && !result.athlete?.accreditedAt && (
                <button onClick={confirmAccredit} disabled={accrediting} style={{ flex: 2, padding: "13px", background: "#22c55e", border: "none", borderRadius: "10px", color: "white", fontWeight: 800, fontSize: "15px", cursor: "pointer" }}>
                  {accrediting ? "Registrando..." : "✓ Confirmar Acceso"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
