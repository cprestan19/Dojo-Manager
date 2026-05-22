"use client";
import { useState } from "react";
import { CheckCircle, ExternalLink } from "lucide-react";

interface Props {
  slug:                string;
  tournamentName:      string;
  registrationCloseAt: string | null;
  entryFeePerCategory: number | null;
  feeCurrency:         string;
  requireWaiver:       boolean;
  waiverText:          string | null;
  maxAthletesPerClub:  number | null;
  regIsOpen:           boolean;
}

interface FormData {
  clubName:    string;
  country:     string;
  city:        string;
  coachName:   string;
  coachEmail:  string;
  coachPhone:  string;
  federationId: string;
}

const INITIAL: FormData = { clubName: "", country: "", city: "", coachName: "", coachEmail: "", coachPhone: "", federationId: "" };

export function ClubRegistrationSection({
  slug, tournamentName, registrationCloseAt,
  entryFeePerCategory, feeCurrency,
  requireWaiver, waiverText,
  maxAthletesPerClub, regIsOpen,
}: Props) {
  const [showForm,  setShowForm]  = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [form,      setForm]      = useState<FormData>(INITIAL);
  const [waiver,    setWaiver]    = useState(false);
  const [tokenInput,setTokenInput]= useState("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState(false);

  const daysLeft = registrationCloseAt
    ? Math.max(0, Math.ceil((new Date(registrationCloseAt).getTime() - Date.now()) / 86_400_000))
    : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (requireWaiver && !waiver) { setError("Debes aceptar los términos para continuar."); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch(`/api/public/tournaments/${slug}/register-club`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const d = await r.json();
      if (r.status === 409) { setError("Este email ya está registrado. Revisa tu correo para el link de gestión."); return; }
      if (!r.ok) { setError(d.error ?? "Error al registrar"); return; }
      setSuccess(true);
      setShowForm(false);
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  }

  const s = { color: "#8892a4", fontSize: "14px", marginTop: "4px" };

  return (
    <div style={{ marginBottom: "24px", background: "#1a1d27", borderRadius: "16px", border: "1px solid #2d3048", padding: "24px" }}>
      <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#f0f0f0", marginBottom: "8px" }}>🏛️ Inscripción de Clubs</h2>
      <p style={s}>Los coaches de clubes externos pueden inscribir sus atletas en este torneo.</p>

      {/* Info chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", margin: "16px 0" }}>
        {daysLeft !== null && regIsOpen && (
          <span style={{ background: daysLeft <= 7 ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.12)", color: daysLeft <= 7 ? "#fca5a5" : "#4ade80", border: `1px solid ${daysLeft <= 7 ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`, borderRadius: "20px", padding: "4px 12px", fontSize: "13px", fontWeight: 600 }}>
            ⏰ {daysLeft === 0 ? "Cierra hoy" : `${daysLeft} día${daysLeft !== 1 ? "s" : ""} para el cierre`}
          </span>
        )}
        {entryFeePerCategory && (
          <span style={{ background: "rgba(255,255,255,0.06)", color: "#c0c7d4", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "4px 12px", fontSize: "13px", fontWeight: 600 }}>
            💰 {feeCurrency} {entryFeePerCategory} / categoría
          </span>
        )}
        {maxAthletesPerClub && (
          <span style={{ background: "rgba(255,255,255,0.06)", color: "#c0c7d4", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "4px 12px", fontSize: "13px", fontWeight: 600 }}>
            👥 Máx. {maxAthletesPerClub} atletas por club
          </span>
        )}
        {!regIsOpen && (
          <span style={{ background: "rgba(239,68,68,0.12)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "20px", padding: "4px 12px", fontSize: "13px", fontWeight: 600 }}>
            🔒 Inscripciones cerradas
          </span>
        )}
      </div>

      {success ? (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "10px" }}>
          <CheckCircle size={24} style={{ color: "#22c55e", flexShrink: 0 }} />
          <div>
            <p style={{ color: "white", fontWeight: 700, margin: 0 }}>¡Inscripción registrada!</p>
            <p style={{ color: "#4ade80", fontSize: "13px", margin: "3px 0 0" }}>Revisa tu correo — recibirás el link para gestionar tus atletas.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {regIsOpen && (
            <button onClick={() => { setShowForm(!showForm); setShowLogin(false); }} style={{ padding: "10px 20px", background: "#C0392B", border: "none", borderRadius: "8px", color: "white", fontWeight: 700, cursor: "pointer", fontSize: "14px" }}>
              {showForm ? "Cancelar" : "📝 Inscribir mi Club"}
            </button>
          )}
          <button onClick={() => { setShowLogin(!showLogin); setShowForm(false); }} style={{ padding: "10px 20px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", color: "#c0c7d4", fontWeight: 600, cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
            <ExternalLink size={14} /> Ya tengo mi link
          </button>
        </div>
      )}

      {/* "Ya tengo link" redirect */}
      {showLogin && (
        <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
          <input
            value={tokenInput} onChange={e => setTokenInput(e.target.value)}
            placeholder="Pega tu token de coach aquí..."
            style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "10px 12px", color: "white", fontSize: "13px", outline: "none", fontFamily: "monospace" }}
          />
          <button onClick={() => { if (tokenInput.trim()) window.location.href = `/coach/${tokenInput.trim()}`; }} disabled={!tokenInput.trim()} style={{ padding: "10px 16px", background: "#2563eb", border: "none", borderRadius: "8px", color: "white", fontWeight: 700, cursor: "pointer" }}>
            Ir →
          </button>
        </div>
      )}

      {/* Registration form */}
      {showForm && (
        <form onSubmit={submit} style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {[
            { key: "clubName",    label: "Nombre del Club *",     type: "text"  },
            { key: "country",     label: "País",                  type: "text"  },
            { key: "city",        label: "Ciudad",                type: "text"  },
            { key: "coachName",   label: "Nombre del Coach *",    type: "text"  },
            { key: "coachEmail",  label: "Email del Coach *",     type: "email" },
            { key: "coachPhone",  label: "Teléfono (WhatsApp)",   type: "tel"   },
            { key: "federationId",label: "ID Federación",         type: "text"  },
          ].map(f => (
            <div key={f.key}>
              <label style={{ color: "#9ca3af", fontSize: "12px", display: "block", marginBottom: "4px" }}>{f.label}</label>
              <input
                type={f.type}
                required={f.label.endsWith("*")}
                value={(form as unknown as Record<string,string>)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3048", borderRadius: "8px", padding: "10px 12px", color: "white", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          ))}

          {requireWaiver && waiverText && (
            <div>
              <p style={{ color: "#9ca3af", fontSize: "12px", marginBottom: "6px" }}>TÉRMINOS Y CONDICIONES</p>
              <div style={{ background: "#0f1117", border: "1px solid #2d3048", borderRadius: "8px", padding: "12px", color: "#9ca3af", fontSize: "12px", lineHeight: 1.6, maxHeight: "80px", overflow: "auto", marginBottom: "8px" }}>
                {waiverText}
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input type="checkbox" checked={waiver} onChange={e => setWaiver(e.target.checked)} />
                <span style={{ color: "#f0f0f0", fontSize: "13px" }}>Acepto los términos y condiciones</span>
              </label>
            </div>
          )}

          {error && <p style={{ color: "#f87171", fontSize: "13px" }}>{error}</p>}

          <button type="submit" disabled={saving} style={{ padding: "13px", background: "#C0392B", border: "none", borderRadius: "8px", color: "white", fontWeight: 700, fontSize: "15px", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Registrando..." : `Registrar Club en ${tournamentName}`}
          </button>
          <p style={{ color: "#6b7280", fontSize: "12px", textAlign: "center" }}>
            Recibirás un link privado por email para gestionar tus atletas y categorías.
          </p>
        </form>
      )}
    </div>
  );
}
