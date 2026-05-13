"use client";
import { useState } from "react";
import { BELT_COLORS } from "@/lib/utils";

interface Props {
  slug: string;
  maxParticipants: number | null;
}

export function PublicRegistrationForm({ slug, maxParticipants }: Props) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dojo: "",
    belt: "",
    birthDate: "",
    email: "",
    phone: "",
    categories: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.categories.trim()) {
      setError("Nombre, apellido y categorías son requeridos.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/tournaments/${slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          categories: form.categories,
        }),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const d = await res.json().catch(() => ({}));
        setError((d as { error?: string }).error ?? "Error al enviar la inscripción.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div style={{ textAlign: "center", padding: "24px", color: "#4ade80" }}>
        <p style={{ fontSize: "24px", marginBottom: "8px" }}>✓</p>
        <p style={{ fontSize: "16px", fontWeight: "600", color: "#f0f0f0" }}>¡Inscripción enviada!</p>
        <p style={{ fontSize: "14px", color: "#8892a4", marginTop: "4px" }}>
          Tu inscripción fue recibida. El organizador la revisará y te notificará.
        </p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    background: "#0f1117",
    border: "1px solid #2d3048",
    borderRadius: "8px",
    color: "#f0f0f0",
    fontSize: "14px",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "4px",
    fontSize: "12px",
    color: "#8892a4",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {maxParticipants && (
        <p style={{ fontSize: "12px", color: "#8892a4" }}>Cupos máximos: {maxParticipants}</p>
      )}
      {error && (
        <div style={{ padding: "12px", background: "#450a0a", borderRadius: "8px", border: "1px solid #7f1d1d", color: "#fca5a5", fontSize: "14px" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label style={labelStyle}>Nombre *</label>
          <input style={inputStyle} required value={form.firstName}
            onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Apellido *</label>
          <input style={inputStyle} required value={form.lastName}
            onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Dojo / Club</label>
        <input style={inputStyle} value={form.dojo}
          onChange={e => setForm(p => ({ ...p, dojo: e.target.value }))} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label style={labelStyle}>Cinta</label>
          <select style={inputStyle} value={form.belt} onChange={e => setForm(p => ({ ...p, belt: e.target.value }))}>
            <option value="">Seleccionar...</option>
            {BELT_COLORS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Fecha de Nacimiento</label>
          <input type="date" style={inputStyle} value={form.birthDate}
            onChange={e => setForm(p => ({ ...p, birthDate: e.target.value }))} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label style={labelStyle}>Email</label>
          <input type="email" style={inputStyle} value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Teléfono</label>
          <input style={inputStyle} value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Categorías a Participar *</label>
        <input style={inputStyle} required value={form.categories}
          onChange={e => setForm(p => ({ ...p, categories: e.target.value }))}
          placeholder="Ej. Kumite -55kg, Kata Individual" />
      </div>

      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: "12px",
          background: "#c0392b",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontSize: "14px",
          fontWeight: "600",
          cursor: submitting ? "not-allowed" : "pointer",
          opacity: submitting ? 0.7 : 1,
          transition: "opacity 0.2s",
        }}
      >
        {submitting ? "Enviando..." : "Enviar Inscripción"}
      </button>
    </form>
  );
}
