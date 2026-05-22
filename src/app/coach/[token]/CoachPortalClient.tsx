"use client";
import { useEffect, useState } from "react";
import { Users, CreditCard, Clock, Info, Plus, RefreshCw } from "lucide-react";
import { AddAthleteModal } from "./AddAthleteModal";
import { PaymentTab } from "./PaymentTab";
import { StatusTimeline } from "./StatusTimeline";

type Tab = "athletes" | "payment" | "status" | "info";

interface AthleteCategory {
  id: string; categoryLabel: string; status: string;
  feeAmount: number | null; paymentStatus: string;
  isRanking: boolean; rankingValidated: boolean | null; rankingNote: string | null;
}
interface Athlete {
  id: string; firstName: string; lastName: string;
  birthDate: string; gender: string; nationality: string | null;
  weight: number | null; beltColor: string | null; ageGroup: string | null;
  status: string; photoUrl: string | null;
  categories: AthleteCategory[];
}
export interface ClubData {
  id: string; clubName: string; coachName: string; coachEmail: string;
  status: string; paymentStatus: string; paymentRef: string | null;
  rejectionReason: string | null;
}
export interface TournamentData {
  name: string; date: string; location: string;
  registrationCloseAt: string | null;
  entryFeePerCategory: number | null; feeCurrency: string;
  requirePhoto: boolean; requireFederationId: boolean;
  requireWaiver: boolean; waiverText: string | null;
  maxAthletesPerClub: number | null;
}

interface Props { token: string }

const STATUS_LABELS: Record<string, string> = {
  pending:   "Pendiente de aprobación",
  approved:  "Aprobado",
  rejected:  "Rechazado",
  waitlist:  "Lista de espera",
  withdrawn: "Retirado",
};
const STATUS_COLORS: Record<string, string> = {
  pending:  "#f59e0b",
  approved: "#22c55e",
  rejected: "#ef4444",
  waitlist: "#3b82f6",
};

export function CoachPortalClient({ token }: Props) {
  const [tab, setTab]               = useState<Tab>("athletes");
  const [club, setClub]             = useState<ClubData | null>(null);
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [athletes, setAthletes]     = useState<Athlete[]>([]);
  const [totals, setTotals]         = useState({ athletes: 0, categories: 0, approved: 0, totalFee: 0, currency: "USD" });
  const [loading, setLoading]       = useState(true);
  const [registrationOpen, setRegOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/public/tournament-club/${token}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setClub(d.club);
      setTournament(d.tournament);
      setAthletes(d.athletes ?? []);
      setTotals(d.totals);
      setRegOpen(d.registrationOpen ?? false);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token]);

  const bg    = "#0d1117";
  const card  = "rgba(255,255,255,0.04)";
  const border = "rgba(255,255,255,0.1)";

  if (loading || !club || !tournament) return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <p style={{ color: "rgba(255,255,255,0.35)" }}>Cargando...</p>
    </div>
  );

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "athletes", label: "Mis Atletas", icon: Users },
    { key: "payment",  label: "Pago",        icon: CreditCard },
    { key: "status",   label: "Estado",      icon: Clock },
    { key: "info",     label: "Info torneo", icon: Info },
  ];

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "'Segoe UI', sans-serif", paddingBottom: "40px" }}>
      {/* Header */}
      <div style={{ background: "rgba(192,57,43,0.15)", borderBottom: `1px solid rgba(192,57,43,0.3)`, padding: "20px 24px" }}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", letterSpacing: "0.08em", marginBottom: "4px" }}>
          PORTAL DEL COACH
        </p>
        <h1 style={{ color: "white", fontSize: "22px", fontWeight: 800, margin: 0 }}>{club.clubName}</h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", marginTop: "4px" }}>
          {tournament.name} · {new Date(tournament.date).toLocaleDateString("es", { year: "numeric", month: "long", day: "numeric" })}
        </p>
        {/* Status badge */}
        <div style={{ marginTop: "10px", display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(0,0,0,0.3)", padding: "4px 12px", borderRadius: "20px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: STATUS_COLORS[club.status] ?? "#888", display: "inline-block" }} />
          <span style={{ color: "white", fontSize: "13px", fontWeight: 600 }}>{STATUS_LABELS[club.status] ?? club.status}</span>
        </div>
        {club.rejectionReason && (
          <p style={{ color: "#fca5a5", fontSize: "12px", marginTop: "6px" }}>Motivo: {club.rejectionReason}</p>
        )}
      </div>

      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "0 16px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: "0", borderBottom: `1px solid ${border}`, marginTop: "20px" }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                background: "none", border: "none", borderBottom: `2px solid ${active ? "#C0392B" : "transparent"}`,
                color: active ? "white" : "rgba(255,255,255,0.4)", cursor: "pointer", transition: "all 0.15s",
              }}>
                <Icon size={16} />
                <span style={{ fontSize: "11px", fontWeight: 600 }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div style={{ marginTop: "20px" }}>

          {/* ── Atletas ── */}
          {tab === "athletes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Summary */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                {[
                  { label: "Atletas", value: totals.athletes },
                  { label: "Categorías", value: totals.categories },
                  { label: "Cuota total", value: `${totals.currency} ${totals.totalFee.toFixed(2)}` },
                ].map(s => (
                  <div key={s.label} style={{ background: card, border: `1px solid ${border}`, borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                    <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "11px" }}>{s.label}</p>
                    <p style={{ color: "white", fontWeight: 700, fontSize: "18px", marginTop: "2px" }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Add athlete button */}
              {registrationOpen && (
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{
                    background: "#C0392B", color: "white", border: "none", borderRadius: "10px",
                    padding: "14px", fontWeight: 700, fontSize: "15px", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  }}
                >
                  <Plus size={18} /> Agregar Atleta
                </button>
              )}

              {/* Athlete list */}
              {athletes.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "32px 0" }}>
                  Aún no has agregado atletas.
                </p>
              ) : (
                athletes.map(a => (
                  <div key={a.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                      <div>
                        <p style={{ color: "white", fontWeight: 700, fontSize: "15px" }}>
                          {a.lastName.toUpperCase()}, {a.firstName}
                        </p>
                        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", marginTop: "2px" }}>
                          {a.gender === "M" ? "Masc." : "Fem."} · {a.ageGroup ?? "—"}
                          {a.weight ? ` · ${a.weight} kg` : ""}
                          {a.nationality ? ` · ${a.nationality}` : ""}
                        </p>
                      </div>
                      <span style={{
                        background: a.status === "approved" ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
                        color: a.status === "approved" ? "#4ade80" : "#fbbf24",
                        border: `1px solid ${a.status === "approved" ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}`,
                        borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: 600,
                      }}>
                        {STATUS_LABELS[a.status] ?? a.status}
                      </span>
                    </div>
                    {a.categories.length > 0 && (
                      <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {a.categories.map(cat => (
                          <span key={cat.id} style={{
                            background: "rgba(255,255,255,0.06)", border: `1px solid ${border}`,
                            borderRadius: "6px", padding: "3px 8px", fontSize: "12px", color: "rgba(255,255,255,0.7)",
                          }}>
                            {cat.isRanking && <span style={{ color: "#fbbf24", marginRight: "4px" }}>★</span>}
                            {cat.categoryLabel}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Pago ── */}
          {tab === "payment" && (
            <PaymentTab token={token} club={club} totals={totals} onRefresh={load} />
          )}

          {/* ── Estado ── */}
          {tab === "status" && (
            <StatusTimeline club={club} tournament={tournament} athletes={athletes} />
          )}

          {/* ── Info torneo ── */}
          {tab === "info" && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ color: "white", fontWeight: 700, fontSize: "16px" }}>{tournament.name}</p>
              {[
                { label: "Fecha", value: new Date(tournament.date).toLocaleDateString("es", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) },
                { label: "Lugar", value: tournament.location },
                { label: "Cierre inscripciones", value: tournament.registrationCloseAt ? new Date(tournament.registrationCloseAt).toLocaleDateString("es") : "Sin fecha" },
                { label: "Cuota por categoría", value: tournament.entryFeePerCategory ? `${tournament.feeCurrency} ${tournament.entryFeePerCategory}` : "Sin costo" },
                { label: "Máx. atletas por club", value: tournament.maxAthletesPerClub?.toString() ?? "Sin límite" },
              ].map(({ label, value }) => (
                <div key={label} style={{ borderBottom: `1px solid ${border}`, paddingBottom: "8px" }}>
                  <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "11px", letterSpacing: "0.06em" }}>{label}</p>
                  <p style={{ color: "white", fontSize: "14px", marginTop: "2px" }}>{value}</p>
                </div>
              ))}
              {tournament.requireWaiver && tournament.waiverText && (
                <div>
                  <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "11px", marginBottom: "6px" }}>TÉRMINOS Y CONDICIONES</p>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", lineHeight: 1.6 }}>{tournament.waiverText}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add athlete modal */}
      {showAddModal && (
        <AddAthleteModal
          token={token}
          tournament={tournament}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); load(); }}
        />
      )}
    </div>
  );
}
