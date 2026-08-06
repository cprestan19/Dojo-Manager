"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trophy, Users, RefreshCw } from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface BracketSummary {
  id: string; name: string; type: string; gender: string | null;
  status: string; locked: boolean; participants: number; format?: string;
}
interface BracketsListData {
  tournament: { name: string; status: string };
  brackets: BracketSummary[];
}
interface Athlete {
  id: string; seed: number; name: string; photo: string | null; club: string | null;
}
interface KataDetail {
  bracket: { id: string; name: string; type: "kata"; status: string };
  athletes: Athlete[];
}
interface KumiteMatch {
  id: string; round: number; matchNumber: number;
  participant1: Athlete | null; participant2: Athlete | null;
  score1: number | null; score2: number | null;
  winnerId: string | null; isBye: boolean;
}
interface KumiteDetail {
  bracket: { id: string; name: string; type: "kumite"; format: "single_elim"; status: string };
  matches: KumiteMatch[];
}
interface PoolMatch {
  id: string; poolNumber: number; matchNumber: number;
  participant1: Athlete | null; participant2: Athlete | null;
  score1: number | null; score2: number | null;
  winnerId: string | null; isBye: boolean;
}
interface StandingsRow {
  participantId: string; poolNumber: number; played: number; wins: number; losses: number;
  pointsFor: number; pointsAgainst: number; pointsDiff: number; rank: number;
  athlete: Athlete | null;
}
interface RoundRobinDetail {
  bracket: { id: string; name: string; type: "kumite"; format: "round_robin"; status: string };
  standings: StandingsRow[];
  matches: PoolMatch[];
}
type BracketDetail = KataDetail | KumiteDetail | RoundRobinDetail;

const STATUS_LABELS: Record<string, string> = {
  draft: "Por armar", ready: "Listo", active: "En curso", completed: "Finalizada",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280", ready: "#3b82f6", active: "#22c55e", completed: "#fbbf24",
};

function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinal";
  if (fromEnd === 2) return "Cuartos de final";
  return `Ronda ${round}`;
}

// ── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ athlete, size = 36 }: { athlete: Athlete | null; size?: number }) {
  const initials = athlete?.name?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() ?? "?";
  if (athlete?.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={athlete.photo} alt="" width={size} height={size}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255,255,255,0.15)" }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "rgba(255,255,255,0.4)", fontSize: size * 0.38, fontWeight: 800,
    }}>
      {initials}
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function PublicResultsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [list, setList]           = useState<BracketsListData | null>(null);
  const [selectedId, setSelected] = useState<string | null>(null);
  const [detail, setDetail]       = useState<BracketDetail | null>(null);
  const [round, setRound]         = useState<number | null>(null);
  const [loadingList, setLoadingList]     = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const r = await fetch(`/api/public/tournaments/${slug}/brackets`, { cache: "no-store" });
      if (r.ok) {
        const d: BracketsListData = await r.json();
        setList(d);
        setSelected(prev => prev ?? d.brackets[0]?.id ?? null);
      }
    } finally { setLoadingList(false); }
  }, [slug]);

  const loadDetail = useCallback(async (bracketId: string) => {
    try {
      const r = await fetch(`/api/public/tournaments/${slug}/brackets/${bracketId}`, { cache: "no-store" });
      if (r.ok) setDetail(await r.json());
    } finally { setLoadingDetail(false); }
  }, [slug]);

  useEffect(() => { loadList(); const iv = setInterval(loadList, 15000); return () => clearInterval(iv); }, [loadList]);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingDetail(true);
    setDetail(null);
    setRound(null);
    loadDetail(selectedId);
    const iv = setInterval(() => loadDetail(selectedId), 5000);
    return () => clearInterval(iv);
  }, [selectedId, loadDetail]);

  const totalRounds = useMemo(() => {
    if (!detail || "athletes" in detail || "standings" in detail) return 0;
    return detail.matches.reduce((max, m) => Math.max(max, m.round), 0);
  }, [detail]);

  useEffect(() => {
    if (detail?.bracket.type === "kumite" && round === null && totalRounds > 0) setRound(totalRounds);
  }, [detail, round, totalRounds]);

  const bg = "#0d1117", card = "#1a1d27", border = "#2d3048", muted = "#8892a4";

  return (
    <div style={{ minHeight: "100vh", background: bg, color: "#e5e7eb", fontFamily: "system-ui, sans-serif", paddingBottom: "48px" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(13,17,23,0.95)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${border}`, padding: "14px 16px" }}>
        <Link href={`/public/tournament/${slug}`} style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: muted, fontSize: "12px", textDecoration: "none", marginBottom: "6px" }}>
          <ArrowLeft size={13} /> Volver al torneo
        </Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: "17px", fontWeight: 800, color: "#f0f0f0", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {list?.tournament.name ?? "Cargando…"}
            </h1>
            <p style={{ fontSize: "11px", color: muted, marginTop: "2px" }}>Resultados y llaves en vivo</p>
          </div>
          <RefreshCw size={14} color={muted} style={{ flexShrink: 0, opacity: loadingDetail ? 1 : 0.3, animation: loadingDetail ? "spin 1s linear infinite" : "none" }} />
        </div>
      </div>

      {/* Selector de categorías */}
      <div style={{ padding: "12px 16px", display: "flex", gap: "8px", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {loadingList ? (
          <p style={{ color: muted, fontSize: "13px" }}>Cargando categorías…</p>
        ) : list && list.brackets.length === 0 ? (
          <p style={{ color: muted, fontSize: "13px" }}>Aún no hay categorías publicadas.</p>
        ) : (
          list?.brackets.map(b => {
            const active = b.id === selectedId;
            const kumiteColor = "#EF4444", kataColor = "#A78BFA";
            const c = b.type === "kumite" ? kumiteColor : kataColor;
            return (
              <button key={b.id} onClick={() => setSelected(b.id)} style={{
                flexShrink: 0, display: "flex", flexDirection: "column", gap: "3px",
                padding: "8px 14px", borderRadius: "12px", cursor: "pointer",
                background: active ? `${c}22` : card, border: `1.5px solid ${active ? c : border}`,
                textAlign: "left",
              }}>
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: active ? c : "#e5e7eb", whiteSpace: "nowrap" }}>{b.name}</span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10.5px", color: muted }}>
                  <Users size={10} /> {b.participants}
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: STATUS_COLORS[b.status] ?? muted, marginLeft: "2px" }} />
                  {STATUS_LABELS[b.status] ?? b.status}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Detalle de la categoría seleccionada */}
      <div style={{ padding: "4px 16px" }}>
        {!detail ? (
          loadingDetail && <p style={{ color: muted, fontSize: "13px", textAlign: "center", padding: "32px 0" }}>Cargando…</p>
        ) : "athletes" in detail ? (
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "14px", padding: "16px", marginTop: "8px" }}>
            <p style={{ fontSize: "11px", color: muted, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "10px" }}>
              Orden de actuación
            </p>
            {detail.athletes.length === 0 ? (
              <p style={{ color: muted, fontSize: "13px" }}>Sin atletas inscritos todavía.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {detail.athletes.map((a, i) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "10px", background: "rgba(255,255,255,0.03)" }}>
                    <span style={{ width: "20px", textAlign: "right", color: muted, fontSize: "13px", fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    <Avatar athlete={a} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: "#f0f0f0", fontSize: "13.5px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</p>
                      {a.club && <p style={{ color: muted, fontSize: "11px" }}>{a.club}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : "standings" in detail ? (
          <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "18px" }}>
            {[...new Set(detail.standings.map(s => s.poolNumber))].sort((a, b) => a - b).map(pool => (
              <div key={pool}>
                <p style={{ fontSize: "11px", color: "#fbbf24", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "8px" }}>
                  Pool {pool}
                </p>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "12px", overflow: "hidden", marginBottom: "10px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ color: muted, textAlign: "left" }}>
                        <th style={{ padding: "8px 10px" }}>#</th>
                        <th style={{ padding: "8px 10px" }}>Atleta</th>
                        <th style={{ padding: "8px 6px", textAlign: "center" }}>PJ</th>
                        <th style={{ padding: "8px 6px", textAlign: "center" }}>G</th>
                        <th style={{ padding: "8px 6px", textAlign: "center" }}>P</th>
                        <th style={{ padding: "8px 10px", textAlign: "center" }}>Dif</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.standings.filter(s => s.poolNumber === pool).map(s => (
                        <tr key={s.participantId} style={{ borderTop: `1px solid ${border}` }}>
                          <td style={{ padding: "7px 10px", fontWeight: 800, color: "#fbbf24" }}>{s.rank}</td>
                          <td style={{ padding: "7px 10px", color: "#f0f0f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "140px" }}>
                            {s.athlete?.name ?? "—"}
                          </td>
                          <td style={{ padding: "7px 6px", textAlign: "center", color: muted }}>{s.played}</td>
                          <td style={{ padding: "7px 6px", textAlign: "center", color: "#4ade80", fontWeight: 700 }}>{s.wins}</td>
                          <td style={{ padding: "7px 6px", textAlign: "center", color: "#f87171", fontWeight: 700 }}>{s.losses}</td>
                          <td style={{ padding: "7px 10px", textAlign: "center", color: muted }}>{s.pointsDiff > 0 ? `+${s.pointsDiff}` : s.pointsDiff}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {detail.matches.filter(m => m.poolNumber === pool).map(m => {
                    const p1Winner = !!m.winnerId && m.winnerId === m.participant1?.id;
                    const p2Winner = !!m.winnerId && m.winnerId === m.participant2?.id;
                    return (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "8px", background: card, border: `1px solid ${border}`, borderRadius: "10px", padding: "8px 10px", fontSize: "12.5px" }}>
                        <span style={{ flex: 1, color: p1Winner ? "#4ade80" : "#e5e7eb", fontWeight: p1Winner ? 800 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {m.participant1?.name ?? "—"}
                        </span>
                        <span style={{ color: "#f0f0f0", fontWeight: 800, fontVariantNumeric: "tabular-nums", minWidth: "14px", textAlign: "center" }}>{m.score1 ?? "-"}</span>
                        <span style={{ color: muted, fontSize: "10px" }}>vs</span>
                        <span style={{ color: "#f0f0f0", fontWeight: 800, fontVariantNumeric: "tabular-nums", minWidth: "14px", textAlign: "center" }}>{m.score2 ?? "-"}</span>
                        <span style={{ flex: 1, textAlign: "right", color: p2Winner ? "#4ade80" : "#e5e7eb", fontWeight: p2Winner ? 800 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {m.participant2?.name ?? "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: "8px" }}>
            {totalRounds === 0 ? (
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "14px", padding: "24px", textAlign: "center" }}>
                <p style={{ color: muted, fontSize: "13px" }}>La llave todavía no se ha generado.</p>
              </div>
            ) : (
              <>
                {/* Tabs de ronda */}
                <div style={{ display: "flex", gap: "6px", overflowX: "auto", marginBottom: "10px", WebkitOverflowScrolling: "touch" }}>
                  {Array.from({ length: totalRounds }, (_, i) => i + 1).map(r => (
                    <button key={r} onClick={() => setRound(r)} style={{
                      flexShrink: 0, padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 700,
                      background: round === r ? "#C0392B" : card, color: round === r ? "white" : muted,
                      border: `1px solid ${round === r ? "#C0392B" : border}`,
                    }}>
                      {roundLabel(r, totalRounds)}
                    </button>
                  ))}
                </div>

                {/* Matches de la ronda */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {detail.matches.filter(m => m.round === round).map(m => (
                    <div key={m.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "10px 12px" }}>
                      <p style={{ fontSize: "10px", color: muted, marginBottom: "6px" }}>Combate {m.matchNumber}{m.isBye ? " · Bye" : ""}</p>
                      {[m.participant1, m.participant2].map((p, idx) => {
                        const score = idx === 0 ? m.score1 : m.score2;
                        const isWinner = !!m.winnerId && p?.id === m.winnerId;
                        return (
                          <div key={idx} style={{
                            display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "8px",
                            background: isWinner ? "rgba(34,197,94,0.1)" : "transparent",
                          }}>
                            <Avatar athlete={p} size={28} />
                            <span style={{ flex: 1, fontSize: "13px", fontWeight: isWinner ? 800 : 500, color: p ? (isWinner ? "#4ade80" : "#e5e7eb") : muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {p?.name ?? "—"}
                            </span>
                            {score !== null && <span style={{ fontSize: "15px", fontWeight: 800, color: "#e5e7eb", fontVariantNumeric: "tabular-nums" }}>{score}</span>}
                            {isWinner && <Trophy size={13} color="#fbbf24" />}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {detail.matches.filter(m => m.round === round).length === 0 && (
                    <p style={{ color: muted, fontSize: "13px", textAlign: "center", padding: "20px 0" }}>Sin combates en esta ronda.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
