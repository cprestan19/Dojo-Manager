"use client";
import { useState } from "react";
import { Upload, CheckCircle } from "lucide-react";
import type { ClubData } from "./CoachPortalClient";

interface Props {
  token:    string;
  club:     ClubData;
  totals:   { totalFee: number; currency: string };
  onRefresh: () => void;
}

const PAY_LABELS: Record<string, string> = {
  unpaid:  "Pendiente de pago",
  partial: "Pago parcial",
  paid:    "Pagado ✓",
  waived:  "Exento de pago",
};

export function PaymentTab({ token, club, totals, onRefresh }: Props) {
  const [paymentRef,  setPaymentRef]  = useState(club.paymentRef ?? "");
  const [uploading,   setUploading]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [proofUrl,    setProofUrl]    = useState<string | null>(null);
  const [error,       setError]       = useState("");
  const [saved,       setSaved]       = useState(false);

  const bg    = "#0d1117";
  const card  = "rgba(255,255,255,0.05)";
  const border = "rgba(255,255,255,0.1)";
  const isPaid = club.paymentStatus === "paid" || club.paymentStatus === "waived";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "image");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      if (!r.ok) { setError("Error al subir el archivo"); return; }
      const d = await r.json();
      setProofUrl(d.url);
    } catch {
      setError("Error de conexión al subir");
    } finally { setUploading(false); }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/public/tournament-club/${token}/payment`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          paymentRef:      paymentRef.trim() || undefined,
          paymentProofUrl: proofUrl || undefined,
        }),
      });
      if (!r.ok) { const d = await r.json(); setError(d.error ?? "Error al guardar"); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onRefresh();
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Status */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "16px 20px" }}>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px" }}>ESTADO DEL PAGO</p>
        <p style={{ color: isPaid ? "#4ade80" : "#fbbf24", fontWeight: 700, fontSize: "18px", marginTop: "4px" }}>
          {PAY_LABELS[club.paymentStatus] ?? club.paymentStatus}
        </p>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", marginTop: "4px" }}>
          Total: {totals.currency} {totals.totalFee.toFixed(2)}
        </p>
      </div>

      {!isPaid && (
        <>
          {/* Payment reference */}
          <div>
            <label style={{ color: "rgba(255,255,255,0.55)", fontSize: "12px", display: "block", marginBottom: "5px" }}>
              Referencia / Número de transferencia
            </label>
            <input
              type="text"
              value={paymentRef}
              onChange={e => setPaymentRef(e.target.value)}
              placeholder="Ej. REF-2025-001234"
              style={{
                width: "100%", background: card, border: `1px solid ${border}`,
                borderRadius: "8px", padding: "12px 14px", color: "white",
                fontSize: "15px", outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Upload proof */}
          <div>
            <label style={{ color: "rgba(255,255,255,0.55)", fontSize: "12px", display: "block", marginBottom: "5px" }}>
              Comprobante de pago (imagen)
            </label>
            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "8px", padding: "20px", border: `2px dashed ${proofUrl ? "#22c55e" : border}`,
              borderRadius: "10px", cursor: "pointer", background: proofUrl ? "rgba(34,197,94,0.05)" : card,
            }}>
              <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
              {uploading ? (
                <p style={{ color: "rgba(255,255,255,0.5)" }}>Subiendo...</p>
              ) : proofUrl ? (
                <>
                  <CheckCircle size={28} color="#22c55e" />
                  <p style={{ color: "#4ade80", fontSize: "13px" }}>Comprobante subido</p>
                </>
              ) : (
                <>
                  <Upload size={28} color="rgba(255,255,255,0.35)" />
                  <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px" }}>Toca para subir imagen</p>
                </>
              )}
            </label>
          </div>

          {error && (
            <p style={{ color: "#f87171", fontSize: "13px" }}>{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving || uploading}
            style={{
              background: saved ? "#16a34a" : "#C0392B", border: "none", borderRadius: "10px",
              padding: "14px", color: "white", fontWeight: 700, fontSize: "15px",
              cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
            }}
          >
            {saved ? "✓ Guardado" : saving ? "Guardando..." : "Enviar comprobante"}
          </button>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px", textAlign: "center" }}>
            El organizador revisará tu pago y actualizará el estado de tu inscripción.
          </p>
        </>
      )}

      {isPaid && (
        <div style={{ textAlign: "center", padding: "24px" }}>
          <CheckCircle size={48} color="#22c55e" style={{ margin: "0 auto 12px" }} />
          <p style={{ color: "white", fontWeight: 700 }}>¡Pago confirmado!</p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", marginTop: "4px" }}>
            Recibirás las credenciales (código QR) de tus atletas por email cuando todo esté aprobado.
          </p>
        </div>
      )}
    </div>
  );
}
