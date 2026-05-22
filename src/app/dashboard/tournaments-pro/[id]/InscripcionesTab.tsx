"use client";
import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, Users, DollarSign, ChevronDown, ChevronUp, Mail, RefreshCw } from "lucide-react";

interface AthleteCategory {
  id: string; categoryLabel: string; status: string;
  feeAmount: number | null; paymentStatus: string;
  isRanking: boolean; rankingValidated: boolean | null; rankingSeed: number | null;
}
interface Athlete {
  id: string; firstName: string; lastName: string;
  gender: string; ageGroup: string | null; weight: number | null;
  beltColor: string | null; nationality: string | null; status: string;
  accreditedAt: string | null;
  categories: AthleteCategory[];
}
interface Club {
  id: string; clubName: string; coachName: string; coachEmail: string;
  coachPhone: string | null; country: string | null; city: string | null;
  status: string; paymentStatus: string; paymentRef: string | null;
  paymentProofUrl: string | null; rejectionReason: string | null;
  createdAt: string;
  athletes: Athlete[];
  totals: { athletes: number; categories: number; approved: number; fee: number };
}

const STATUS_COLORS: Record<string, string> = {
  pending:  "badge-yellow",
  approved: "badge-green",
  rejected: "badge-red",
  waitlist: "badge-blue",
  withdrawn: "badge-red",
};
const STATUS_LABELS: Record<string, string> = {
  pending:  "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  waitlist: "Lista de espera",
  withdrawn: "Retirado",
};
const PAY_LABELS: Record<string, string> = {
  unpaid:  "Sin pago",
  partial: "Pago parcial",
  paid:    "Pagado",
  waived:  "Exento",
};

interface Props {
  tournamentId: string;
}

export function InscripcionesTab({ tournamentId }: Props) {
  const [clubs, setClubs]         = useState<Club[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expandedId, setExpanded] = useState<string | null>(null);
  const [saving, setSaving]       = useState<string | null>(null);
  const [rejectId, setRejectId]   = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/tournaments/${tournamentId}/external-clubs`);
      if (r.ok) setClubs((await r.json()).clubs ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [tournamentId]);

  async function updateClub(clubId: string, data: Record<string, unknown>) {
    setSaving(clubId);
    try {
      const r = await fetch(`/api/tournaments/${tournamentId}/external-clubs/${clubId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      if (r.ok) await load();
    } finally { setSaving(null); }
  }

  async function sendCredentials(clubId: string) {
    setSaving(`cred-${clubId}`);
    try {
      await fetch(`/api/tournaments/${tournamentId}/external-clubs/${clubId}/send-credentials`, {
        method: "POST",
      });
    } finally { setSaving(null); }
  }

  // Totals across all clubs
  const totals = {
    clubs:      clubs.length,
    athletes:   clubs.reduce((s, c) => s + c.totals.athletes, 0),
    approved:   clubs.reduce((s, c) => s + c.totals.approved, 0),
    fee:        clubs.reduce((s, c) => s + c.totals.fee, 0),
  };

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-dojo-border/40 rounded-xl animate-pulse"/>)}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Clubs", value: totals.clubs, icon: Users },
          { label: "Atletas", value: totals.athletes, icon: Users },
          { label: "Aprobados", value: totals.approved, icon: CheckCircle },
          { label: "Cuota total", value: `$${totals.fee.toFixed(2)}`, icon: DollarSign },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card flex items-center gap-3 py-3">
            <Icon size={18} className="text-dojo-muted shrink-0" />
            <div>
              <p className="text-xs text-dojo-muted">{label}</p>
              <p className="font-bold text-dojo-white text-lg">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Refresh */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-dojo-muted uppercase tracking-widest">Clubs inscritos</p>
        <button onClick={load} className="btn-ghost text-xs flex items-center gap-1.5">
          <RefreshCw size={12}/> Actualizar
        </button>
      </div>

      {clubs.length === 0 ? (
        <div className="card text-center py-10 text-dojo-muted">
          No hay clubs registrados aún.
        </div>
      ) : (
        <div className="space-y-3">
          {clubs.map(club => {
            const expanded = expandedId === club.id;
            const isRejecting = rejectId === club.id;
            const isSaving = saving === club.id;
            const isSavingCred = saving === `cred-${club.id}`;
            const canSendCreds = club.status === "approved" &&
              (club.paymentStatus === "paid" || club.paymentStatus === "waived");

            return (
              <div key={club.id} className="card border border-dojo-border space-y-0 p-0 overflow-hidden">
                {/* Club header */}
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => setExpanded(expanded ? null : club.id)} className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-dojo-white">{club.clubName}</span>
                      <span className={STATUS_COLORS[club.status] ?? "badge-yellow"}>{STATUS_LABELS[club.status] ?? club.status}</span>
                      <span className="text-xs text-dojo-muted">{PAY_LABELS[club.paymentStatus] ?? club.paymentStatus}</span>
                    </div>
                    <p className="text-xs text-dojo-muted mt-0.5">
                      {club.coachName} · {club.coachEmail}
                      {club.country ? ` · ${club.country}` : ""}
                      {" · "}{club.totals.athletes} atletas / {club.totals.categories} categorías
                    </p>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {club.status === "pending" && (
                      <>
                        <button
                          onClick={() => updateClub(club.id, { status: "approved" })}
                          disabled={isSaving}
                          className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                        >
                          <CheckCircle size={12}/> Aprobar
                        </button>
                        <button
                          onClick={() => { setRejectId(club.id); setRejectReason(""); }}
                          disabled={isSaving}
                          className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1 text-red-400"
                        >
                          <XCircle size={12}/> Rechazar
                        </button>
                      </>
                    )}
                    {club.status === "approved" && club.paymentStatus === "unpaid" && (
                      <button
                        onClick={() => updateClub(club.id, { paymentStatus: "paid" })}
                        disabled={isSaving}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        Marcar Pagado
                      </button>
                    )}
                    {canSendCreds && (
                      <button
                        onClick={() => sendCredentials(club.id)}
                        disabled={isSavingCred}
                        className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1"
                      >
                        <Mail size={12}/> {isSavingCred ? "Enviando..." : "Credenciales"}
                      </button>
                    )}
                    <button onClick={() => setExpanded(expanded ? null : club.id)} className="text-dojo-muted p-1">
                      {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </button>
                  </div>
                </div>

                {/* Reject reason input */}
                {isRejecting && (
                  <div className="px-4 pb-3 flex gap-2 border-t border-dojo-border pt-3">
                    <input
                      className="form-input flex-1 text-sm"
                      placeholder="Motivo del rechazo (opcional)..."
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                    />
                    <button
                      onClick={() => { updateClub(club.id, { status: "rejected", rejectionReason: rejectReason || undefined }); setRejectId(null); }}
                      className="btn-ghost text-xs px-3 text-red-400"
                    >
                      Confirmar
                    </button>
                    <button onClick={() => setRejectId(null)} className="btn-ghost text-xs px-3">Cancelar</button>
                  </div>
                )}

                {/* Expanded — athletes list */}
                {expanded && (
                  <div className="border-t border-dojo-border px-4 py-3 space-y-2">
                    {club.athletes.length === 0 ? (
                      <p className="text-dojo-muted text-sm">Sin atletas registrados.</p>
                    ) : (
                      club.athletes.map(a => (
                        <div key={a.id} className="flex items-start gap-3 py-2 border-b border-dojo-border/40 last:border-0">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-dojo-white text-sm">
                                {a.lastName.toUpperCase()}, {a.firstName}
                              </span>
                              <span className={`text-xs ${a.gender === "M" ? "text-blue-400" : "text-pink-400"}`}>
                                {a.gender === "M" ? "M" : "F"}
                              </span>
                              {a.ageGroup && <span className="text-xs text-dojo-muted">{a.ageGroup}</span>}
                              {a.weight && <span className="text-xs text-dojo-muted">{a.weight}kg</span>}
                              <span className={STATUS_COLORS[a.status] ?? "badge-yellow"}>{STATUS_LABELS[a.status] ?? a.status}</span>
                              {a.accreditedAt && <span className="badge-green text-xs">✓ Acreditado</span>}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {a.categories.map(cat => (
                                <span key={cat.id} className="text-xs px-2 py-0.5 rounded bg-dojo-darker border border-dojo-border text-dojo-muted flex items-center gap-1">
                                  {cat.isRanking && (
                                    <span className="text-yellow-400">
                                      {cat.rankingValidated ? `★${cat.rankingSeed ?? ""}` : "★?"}
                                    </span>
                                  )}
                                  {cat.categoryLabel}
                                  <span className={STATUS_COLORS[cat.status] ?? "badge-yellow"} style={{ marginLeft: "2px" }}>
                                    {STATUS_LABELS[cat.status] ?? cat.status}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Payment proof */}
                    {club.paymentProofUrl && (
                      <div className="mt-2 pt-2 border-t border-dojo-border/40">
                        <p className="text-xs text-dojo-muted mb-1">Comprobante de pago:</p>
                        <a href={club.paymentProofUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-dojo-gold hover:underline">
                          Ver comprobante →
                        </a>
                        {club.paymentRef && <span className="text-xs text-dojo-muted ml-3">Ref: {club.paymentRef}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
