"use client";
import { useEffect, useState } from "react";
import { X, ChevronRight, ChevronLeft, Check, Upload, User } from "lucide-react";
import { calculateAgeGroup, getCompatibleCategories, buildCategoryLabel } from "@/lib/tournament-categories";
import type { TournamentData, TournamentBracketOption } from "./CoachPortalClient";

type Bracket = TournamentBracketOption;
interface Props {
  token:      string;
  tournament: TournamentData;
  onClose:    () => void;
  onSaved:    () => void;
}

const GENDERS = [{ value: "M", label: "Masculino" }, { value: "F", label: "Femenino" }];
const BELT_COLORS = [
  "blanca","blanca-celeste","blanco-amarillo","amarilla","naranja",
  "verde","azul","morada","roja","café","café-1-raya","café-2-rayas",
  "café-3-rayas","negra","negra-1-dan","negra-2-dan","negra-3-dan",
];

export function AddAthleteModal({ token, tournament, onClose, onSaved }: Props) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  // Step 1 — Basic data
  const [form, setForm] = useState({
    firstName: "", lastName: "", birthDate: "", gender: "",
    nationality: "", weight: "", beltColor: "", fepakaId: "", photoUrl: "",
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Step 2 — Categories (las categorías del torneo ya vienen con el portal — sin fetch adicional)
  const brackets: Bracket[] = tournament.brackets ?? [];
  const [compatible, setCompatible]     = useState<Bracket[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [rankingFlags, setRankingFlags] = useState<Record<string, boolean>>({});
  const [rankingNotes, setRankingNotes] = useState<Record<string, string>>({});

  // Step 3 — Confirm
  const [waiverSigned, setWaiverSigned] = useState(false);

  // Compute compatible categories when step 2 opens
  useEffect(() => {
    if (step !== 2 || !form.birthDate || !form.gender) return;
    const birthDate = new Date(form.birthDate);
    const ageGroup  = calculateAgeGroup(birthDate, new Date(tournament.date));
    const weight    = form.weight ? parseFloat(form.weight) : null;
    const filtered  = getCompatibleCategories(brackets, { gender: form.gender, ageGroup, weight });
    setCompatible(filtered);
  }, [step, brackets, form.birthDate, form.gender, form.weight, tournament.date]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", "athlete-photo");
      const r = await fetch(`/api/public/tournament-club/${token}/upload`, { method: "POST", body: fd });
      if (!r.ok) { setError("Error al subir la foto"); return; }
      const d = await r.json();
      setForm(f => ({ ...f, photoUrl: d.url }));
    } catch {
      setError("Error de conexión al subir la foto");
    } finally { setUploadingPhoto(false); }
  }

  function validateStep1(): string {
    if (!form.firstName.trim()) return "Nombre requerido";
    if (!form.lastName.trim())  return "Apellido requerido";
    if (!form.birthDate)        return "Fecha de nacimiento requerida";
    if (!form.gender)           return "Género requerido";
    if (tournament.requirePhoto && !form.photoUrl) return "Este torneo requiere foto del atleta";
    return "";
  }

  async function handleSubmit() {
    if (tournament.requireWaiver && !waiverSigned) {
      setError("Debes aceptar los términos para continuar");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/public/tournament-club/${token}/athletes`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...form,
          weight:      form.weight ? parseFloat(form.weight) : undefined,
          categoryIds: selectedCats,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Error al guardar"); return; }
      onSaved();
    } finally { setSaving(false); }
  }

  const bg    = "#0d1117";
  const card  = "rgba(255,255,255,0.06)";
  const border = "rgba(255,255,255,0.12)";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div style={{
        background: bg, border: `1px solid ${border}`, borderRadius: "20px 20px 0 0",
        width: "100%", maxWidth: "640px", maxHeight: "90vh", overflow: "auto",
        padding: "20px 20px 40px",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ color: "white", fontWeight: 800, fontSize: "18px", margin: 0 }}>
            {step === 1 ? "Datos del atleta" : step === 2 ? "Seleccionar categorías" : "Confirmar inscripción"}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>Paso {step} de 3</span>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {error && (
          <p style={{ color: "#f87171", fontSize: "13px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px" }}>
            {error}
          </p>
        )}

        {/* ── STEP 1: Basic data ── */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Photo */}
            <div>
              <label style={{ color: "rgba(255,255,255,0.55)", fontSize: "12px", display: "block", marginBottom: "5px" }}>
                Foto del atleta{tournament.requirePhoto ? " *" : ""}
              </label>
              <label style={{
                display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px",
                border: `2px dashed ${form.photoUrl ? "#22c55e" : border}`, borderRadius: "10px",
                cursor: "pointer", background: form.photoUrl ? "rgba(34,197,94,0.05)" : card,
              }}>
                <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
                {form.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.photoUrl} alt="" style={{ width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <User size={20} color="rgba(255,255,255,0.35)" />
                  </div>
                )}
                <span style={{ color: uploadingPhoto ? "rgba(255,255,255,0.4)" : form.photoUrl ? "#4ade80" : "rgba(255,255,255,0.45)", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                  {uploadingPhoto ? "Subiendo..." : form.photoUrl ? "Foto lista — toca para cambiar" : (<><Upload size={14}/> Toca para subir una foto</>)}
                </span>
              </label>
            </div>

            {[
              { key: "firstName", label: "Nombre *", type: "text" },
              { key: "lastName",  label: "Apellido *", type: "text" },
              { key: "birthDate", label: "Fecha de nacimiento *", type: "date" },
              { key: "nationality", label: "Nacionalidad (código ISO, ej: PA)", type: "text" },
              { key: "weight",    label: "Peso (kg)", type: "number" },
              { key: "fepakaId",  label: "ID Federación", type: "text" },
            ].map(field => (
              <div key={field.key}>
                <label style={{ color: "rgba(255,255,255,0.55)", fontSize: "12px", display: "block", marginBottom: "5px" }}>{field.label}</label>
                <input
                  type={field.type}
                  value={(form as Record<string, string>)[field.key]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  style={{
                    width: "100%", background: card, border: `1px solid ${border}`,
                    borderRadius: "8px", padding: "12px 14px", color: "white",
                    fontSize: "15px", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            ))}

            {/* Gender */}
            <div>
              <label style={{ color: "rgba(255,255,255,0.55)", fontSize: "12px", display: "block", marginBottom: "5px" }}>Género *</label>
              <div style={{ display: "flex", gap: "10px" }}>
                {GENDERS.map(g => (
                  <button key={g.value} onClick={() => setForm(f => ({ ...f, gender: g.value }))} style={{
                    flex: 1, padding: "12px", borderRadius: "8px", border: `2px solid ${form.gender === g.value ? "#C0392B" : border}`,
                    background: form.gender === g.value ? "rgba(192,57,43,0.2)" : card, color: "white", cursor: "pointer", fontWeight: 700,
                  }}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Belt */}
            <div>
              <label style={{ color: "rgba(255,255,255,0.55)", fontSize: "12px", display: "block", marginBottom: "5px" }}>Cinta</label>
              <select
                value={form.beltColor}
                onChange={e => setForm(f => ({ ...f, beltColor: e.target.value }))}
                style={{ width: "100%", background: card, border: `1px solid ${border}`, borderRadius: "8px", padding: "12px 14px", color: "white", fontSize: "15px", outline: "none" }}
              >
                <option value="">Sin especificar</option>
                {BELT_COLORS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── STEP 2: Categories ── */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {compatible.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,0.45)", textAlign: "center", padding: "20px 0" }}>
                No hay categorías disponibles compatibles con los datos del atleta.
              </p>
            ) : (
              compatible.map(b => {
                const label    = b.categoryLabel ?? buildCategoryLabel(b.type as "kumite" | "kata", b.gender, b.ageGroup, b.weightCategory, b.isTeamKata);
                const selected = selectedCats.includes(b.id);
                const isRanking = rankingFlags[b.id] ?? false;
                return (
                  <div key={b.id} style={{ background: selected ? "rgba(192,57,43,0.1)" : card, border: `2px solid ${selected ? "#C0392B" : border}`, borderRadius: "12px", padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <button onClick={() => setSelectedCats(p => selected ? p.filter(x => x !== b.id) : [...p, b.id])}
                        style={{ width: "24px", height: "24px", borderRadius: "6px", border: `2px solid ${selected ? "#C0392B" : border}`, background: selected ? "#C0392B" : "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                        {selected && <Check size={14} color="white" />}
                      </button>
                      <span style={{ color: "white", fontWeight: 600, fontSize: "14px" }}>{label}</span>
                    </div>
                    {selected && (
                      <div style={{ marginTop: "12px", paddingLeft: "36px" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                          <input type="checkbox" checked={isRanking} onChange={e => setRankingFlags(f => ({ ...f, [b.id]: e.target.checked }))} />
                          <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px" }}>★ Es atleta de ranking</span>
                        </label>
                        {isRanking && (
                          <input
                            type="text" placeholder="Nota: Ej. Campeón Nacional 2024"
                            value={rankingNotes[b.id] ?? ""}
                            onChange={e => setRankingNotes(n => ({ ...n, [b.id]: e.target.value }))}
                            style={{ marginTop: "8px", width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${border}`, borderRadius: "6px", padding: "8px 12px", color: "white", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── STEP 3: Confirm + waiver ── */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "16px" }}>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px" }}>ATLETA</p>
              <p style={{ color: "white", fontWeight: 700, fontSize: "16px" }}>{form.lastName.toUpperCase()}, {form.firstName}</p>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>{form.gender === "M" ? "Masculino" : "Femenino"} · {form.birthDate}</p>
            </div>
            {selectedCats.length > 0 && (
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "16px" }}>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", marginBottom: "8px" }}>CATEGORÍAS ({selectedCats.length})</p>
                {compatible.filter(b => selectedCats.includes(b.id)).map(b => (
                  <p key={b.id} style={{ color: "white", fontSize: "13px", marginBottom: "4px" }}>
                    {rankingFlags[b.id] && <span style={{ color: "#fbbf24" }}>★ </span>}
                    {b.categoryLabel ?? buildCategoryLabel(b.type as "kumite" | "kata", b.gender, b.ageGroup, b.weightCategory, b.isTeamKata)}
                  </p>
                ))}
              </div>
            )}
            {tournament.requireWaiver && tournament.waiverText && (
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "16px" }}>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", marginBottom: "8px" }}>TÉRMINOS Y CONDICIONES</p>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", lineHeight: 1.6, maxHeight: "100px", overflow: "auto" }}>
                  {tournament.waiverText}
                </p>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", cursor: "pointer" }}>
                  <input type="checkbox" checked={waiverSigned} onChange={e => setWaiverSigned(e.target.checked)} />
                  <span style={{ color: "white", fontSize: "13px", fontWeight: 600 }}>Acepto los términos y condiciones</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} style={{
              flex: 1, background: "rgba(255,255,255,0.07)", border: `1px solid ${border}`, borderRadius: "10px",
              padding: "14px", color: "white", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            }}>
              <ChevronLeft size={18} /> Anterior
            </button>
          )}
          <button
            onClick={() => {
              if (step === 1) {
                const err = validateStep1();
                if (err) { setError(err); return; }
                setError("");
                setStep(2);
              } else if (step === 2) {
                setStep(3);
              } else {
                handleSubmit();
              }
            }}
            disabled={saving}
            style={{
              flex: 2, background: "#C0392B", border: "none", borderRadius: "10px",
              padding: "14px", color: "white", fontWeight: 700, fontSize: "15px", cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            }}
          >
            {step < 3 ? (<>Siguiente <ChevronRight size={18} /></>) : saving ? "Guardando..." : (<><Check size={18} /> Confirmar inscripción</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
