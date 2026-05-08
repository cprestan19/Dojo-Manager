"use client";
import { useState, useEffect, useRef } from "react";
import { Check, Pencil } from "lucide-react";
import {
  type BracketColor,
  COLOR_CFG,
  getSlotColor,
  buildColorMap,
} from "@/lib/bracketColors";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BracketMatch {
  id: string;
  round: number;
  matchNumber: number;
  participant1Id: string | null;
  participant2Id: string | null;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  isBye: boolean;
}

export interface SaveMatchData {
  score1: number;
  score2: number;
  winnerId: string;
}

export interface BracketViewProps {
  matches: BracketMatch[];
  participantsMap: Record<string, { fullName: string; photo?: string | null }>;
  onSaveMatch?: (matchId: string, data: SaveMatchData) => void;
  locked: boolean;
  saving?: string | null;
  showMedals?: boolean;
}

// ── Layout constants ──────────────────────────────────────────────────────────

const ROUND_W  = 290;
const CONN_W   = 48;
const FOOTER_H = 28;    // footer with Guardar/Corregir button
const ROW_H    = 44;    // height of each player row
const MATCH_H  = ROW_H * 2 + 1 + FOOTER_H;  // 44+1+44+28 = 117px
const BASE_H   = MATCH_H + 28;               // slot height with breathing room
const HEADER_H = 36;

function getRoundLabel(round: number, totalRounds: number): string {
  const d = totalRounds - round;
  if (d === 0) return "Final";
  if (d === 1) return "Semifinal";
  if (d === 2) return "Cuartos";
  return `Ronda ${round}`;
}

// ── PlayerAvatar ──────────────────────────────────────────────────────────────

function PlayerAvatar({ name, photo, color, size = 32 }: {
  name: string;
  photo?: string | null;
  color: BracketColor;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map(w => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";

  const style: React.CSSProperties = {
    width:  size,
    height: size,
    minWidth: size,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.4)",
    objectFit: "cover",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.18)",
    fontSize: size < 36 ? 10 : 12,
    fontWeight: 700,
    color: "#fff",
    flexShrink: 0,
  };

  if (photo && (photo.startsWith("http") || photo.startsWith("data:"))) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt={name}
        style={{ ...style, display: "block" }}
      />
    );
  }

  return <div style={style}>{initials}</div>;
}

// ── PlayerRow ─────────────────────────────────────────────────────────────────

interface PlayerRowProps {
  participantId: string | null;
  name: string | null;
  photo?: string | null;
  color: BracketColor;
  isWinner: boolean | null;   // null = undecided
  score: number | null;
  isBye?: boolean;
  // Edit mode
  isEditing?: boolean;
  rawScore?: string;
  onScoreChange?: (v: string) => void;
  isTie?: boolean;
  tieSelected?: boolean;
  onTieClick?: () => void;
}

function PlayerRow({
  participantId, name, photo, color,
  isWinner, score, isBye,
  isEditing, rawScore, onScoreChange,
  isTie, tieSelected, onTieClick,
}: PlayerRowProps) {
  const cfg = COLOR_CFG[color];

  // Background logic
  let bg = cfg.bg;
  if (isWinner === false) bg = cfg.dim;          // lost
  else if (isEditing && isWinner === null) {
    // Entering scores: slightly dimmed until decided
    bg = cfg.bg + "cc";
  }

  const isEmpty = !participantId;

  return (
    <div
      onClick={isTie ? onTieClick : undefined}
      className={["bracket-player flex items-center gap-2 px-2",
        isTie ? "cursor-pointer" : "",
      ].join(" ")}
      style={{ height: ROW_H, background: isEmpty ? "rgba(80,80,80,0.3)" : bg }}
    >
      {/* Avatar */}
      {!isEmpty ? (
        <PlayerAvatar name={name ?? ""} photo={photo} color={color} size={34} />
      ) : (
        <div style={{ width: 30, height: 30, minWidth: 30, borderRadius: "50%",
          border: "1px dashed rgba(255,255,255,0.2)", background: "transparent" }} />
      )}

      {/* Name — allows wrapping up to 2 lines */}
      <span
        className="flex-1 min-w-0 font-bold bracket-name leading-tight"
        style={{
          color: isEmpty ? "rgba(255,255,255,0.25)" : "#fff",
          fontSize: 11,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          wordBreak: "break-word",
        }}
      >
        {isEmpty ? "—" : isBye ? `${name} (BYE)` : name}
      </span>

      {/* Score display or input */}
      {!isEmpty && !isBye && (
        isEditing ? (
          <input
            type="number" min={0}
            value={rawScore ?? ""}
            placeholder="0"
            onChange={e => onScoreChange?.(e.target.value)}
            onClick={e => e.stopPropagation()}
            className="print-hide w-9 text-center bg-white/20 border border-white/30 rounded
                       text-xs font-bold text-white tabular-nums focus:outline-none focus:bg-white/30 py-0.5"
          />
        ) : score !== null ? (
          <span className="bracket-score text-sm font-black tabular-nums shrink-0"
            style={{ color: "#fff", minWidth: 16, textAlign: "right" }}>
            {score}
          </span>
        ) : null
      )}

      {/* Tie indicator (print-hide) */}
      {isTie && !isEmpty && (
        <div className="print-hide shrink-0 w-3 h-3 rounded-full border-2"
          style={{ borderColor: "#fff", background: tieSelected ? "#fff" : "transparent" }} />
      )}

      {/* Winner check (print-hide screen, shown in print as bg color) */}
      {isWinner && (
        <Check size={11} className="print-hide shrink-0" style={{ color: "#fff" }} />
      )}

      {/* AKA / AO label — always visible */}
      <span className="bracket-color-label shrink-0 text-[9px] font-black tracking-wider"
        style={{ color: "rgba(255,255,255,0.85)", minWidth: 24, textAlign: "right" }}>
        {cfg.label}
      </span>
    </div>
  );
}

// ── MatchBox ──────────────────────────────────────────────────────────────────

interface MatchBoxProps {
  match: BracketMatch;
  participantsMap: Record<string, { fullName: string; photo?: string | null }>;
  colorMap: Record<string, BracketColor>;
  onSaveMatch?: (matchId: string, data: SaveMatchData) => void;
  saving: boolean;
}

function MatchBox({ match, participantsMap, colorMap, onSaveMatch, saving }: MatchBoxProps) {
  const p1Info = match.participant1Id ? participantsMap[match.participant1Id] : null;
  const p2Info = match.participant2Id ? participantsMap[match.participant2Id] : null;
  const p1Name = p1Info?.fullName ?? null;
  const p2Name = p2Info?.fullName ?? null;

  const bothPresent = !!match.participant1Id && !!match.participant2Id;

  // Colors from map (conflict-resolved) or slot fallback
  const c1: BracketColor = match.participant1Id
    ? (colorMap[match.participant1Id] ?? getSlotColor(match.participant1Id, match))
    : "AKA";
  const c2: BracketColor = match.participant2Id
    ? (colorMap[match.participant2Id] ?? getSlotColor(match.participant2Id, match))
    : "AO";

  const [editing,   setEditing]   = useState(!match.winnerId && bothPresent);
  const [rawS1,     setRawS1]     = useState(match.score1?.toString() ?? "");
  const [rawS2,     setRawS2]     = useState(match.score2?.toString() ?? "");
  const [tieWinner, setTieWinner] = useState<string | null>(null);

  useEffect(() => {
    const both = !!match.participant1Id && !!match.participant2Id;
    setRawS1(match.score1?.toString() ?? "");
    setRawS2(match.score2?.toString() ?? "");
    if (!match.winnerId && both) setEditing(true);
    else if (match.winnerId)     setEditing(false);
    setTieWinner(null);
  }, [match.winnerId, match.score1, match.score2, match.participant1Id, match.participant2Id]);

  const s1 = rawS1 === "" ? null : parseInt(rawS1, 10);
  const s2 = rawS2 === "" ? null : parseInt(rawS2, 10);
  const bothEntered     = s1 !== null && !isNaN(s1) && s2 !== null && !isNaN(s2);
  const isTie           = bothEntered && s1 === s2;
  const autoWinner      = bothEntered && !isTie
    ? s1! > s2! ? match.participant1Id : match.participant2Id
    : null;
  const effectiveWinner = autoWinner ?? (isTie ? tieWinner : null);
  const isByeEdit       = match.isBye || !match.participant2Id;
  const canSave         = !!onSaveMatch && !saving && (
    isByeEdit ? !!match.participant1Id : bothEntered && !!effectiveWinner
  );

  function handleSave() {
    if (!canSave) return;
    if (isByeEdit) {
      onSaveMatch!(match.id, { score1: s1 ?? 0, score2: 0, winnerId: match.participant1Id! });
      return;
    }
    if (!effectiveWinner || s1 === null || s2 === null) return;
    onSaveMatch!(match.id, { score1: s1, score2: s2, winnerId: effectiveWinner });
  }

  // Winner state per slot (null = undecided, true = won, false = lost)
  const p1Winner: boolean | null = match.winnerId
    ? match.winnerId === match.participant1Id
    : editing && bothEntered
      ? effectiveWinner === match.participant1Id
      : null;
  const p2Winner: boolean | null = match.winnerId
    ? match.winnerId === match.participant2Id
    : editing && bothEntered
      ? effectiveWinner === match.participant2Id
      : null;

  return (
    <div
      className="bracket-match-box overflow-hidden relative"
      style={{ height: MATCH_H, width: ROUND_W - 8, borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
    >
      {/* P1 — AKA */}
      <PlayerRow
        participantId={match.participant1Id}
        name={p1Name}
        photo={p1Info?.photo}
        color={c1}
        isWinner={p1Winner}
        score={match.score1}
        isBye={match.isBye && !match.participant2Id}
        isEditing={editing}
        rawScore={rawS1}
        onScoreChange={v => { setRawS1(v); setTieWinner(null); }}
        isTie={isTie}
        tieSelected={tieWinner === match.participant1Id}
        onTieClick={() => setTieWinner(p => p === match.participant1Id ? null : match.participant1Id)}
      />

      {/* Divider */}
      <div className="bracket-divider" style={{ height: 1, background: "rgba(255,255,255,0.12)" }} />

      {/* P2 — AO */}
      <PlayerRow
        participantId={match.participant2Id}
        name={p2Name}
        photo={p2Info?.photo}
        color={c2}
        isWinner={p2Winner}
        score={match.score2}
        isBye={false}
        isEditing={editing}
        rawScore={rawS2}
        onScoreChange={v => { setRawS2(v); setTieWinner(null); }}
        isTie={isTie}
        tieSelected={tieWinner === match.participant2Id}
        onTieClick={() => setTieWinner(p => p === match.participant2Id ? null : match.participant2Id)}
      />

      {/* Footer — entirely print-hidden */}
      <div className="print-hide" style={{
        height: FOOTER_H, position: "absolute",
        bottom: 0, left: 0, right: 0, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 8px",
        borderTop: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.4)",
      }}>
        {/* Left: tie or corregir */}
        {editing ? (
          <span className="text-[9px]" style={{ color: isTie && !tieWinner ? "#fbbf24" : isTie && tieWinner ? "#86efac" : "transparent" }}>
            {isTie && !tieWinner ? "Empate — elige ganador" : isTie && tieWinner ? "Ganador seleccionado" : "·"}
          </span>
        ) : (
          onSaveMatch ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-[9px] transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}>
              <Pencil size={8} /> Corregir
            </button>
          ) : <span />
        )}

        {/* Right: save / cancel */}
        {editing && (
          <div className="flex items-center gap-1">
            {match.winnerId && (
              <button
                onClick={() => { setEditing(false); setRawS1(match.score1?.toString() ?? ""); setRawS2(match.score2?.toString() ?? ""); }}
                className="text-[9px] px-1 transition-colors"
                style={{ color: "rgba(255,255,255,0.4)" }}>
                Cancelar
              </button>
            )}
            <button onClick={handleSave} disabled={!canSave}
              className="flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded transition-colors"
              style={{
                background: canSave ? "rgba(34,197,94,0.8)" : "rgba(255,255,255,0.1)",
                color: canSave ? "#fff" : "rgba(255,255,255,0.3)",
                cursor: canSave ? "pointer" : "not-allowed",
              }}>
              <Check size={9} /> Guardar
            </button>
          </div>
        )}
      </div>

      {/* Saving overlay */}
      {saving && (
        <div className="print-hide absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)", borderRadius: 8 }}>
          <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

// ── MedalsPodium ──────────────────────────────────────────────────────────────

/**
 * Determines 3rd/4th place from the two semifinal losers.
 * Ranking rule: higher score in the semifinal = 3rd place.
 * Tiebreaker (equal scores or scores unavailable): compare participant IDs
 * for a stable, deterministic "random" order.
 */
function rankBronze(
  semiMatches: BracketMatch[],
): { third: string | null; fourth: string | null } {
  interface Candidate { id: string; score: number }
  const candidates: Candidate[] = [];

  for (const semi of semiMatches) {
    if (!semi.winnerId) continue;
    const isP1Winner = semi.winnerId === semi.participant1Id;
    const loserId    = isP1Winner ? semi.participant2Id : semi.participant1Id;
    const loserScore = isP1Winner ? (semi.score2 ?? -1) : (semi.score1 ?? -1);
    if (loserId) candidates.push({ id: loserId, score: loserScore });
  }

  if (candidates.length === 0) return { third: null, fourth: null };
  if (candidates.length === 1) return { third: candidates[0].id, fourth: null };

  const [a, b] = candidates;

  // Higher score wins 3rd place
  if (a.score !== b.score) {
    return a.score > b.score
      ? { third: a.id, fourth: b.id }
      : { third: b.id, fourth: a.id };
  }

  // Tied or no scores — use ID comparison as stable tiebreaker (feels random)
  return a.id < b.id
    ? { third: a.id, fourth: b.id }
    : { third: b.id, fourth: a.id };
}

function MedalsPodium({ matches, participantsMap, colorMap }: {
  matches: BracketMatch[];
  participantsMap: Record<string, { fullName: string; photo?: string | null }>;
  colorMap: Record<string, BracketColor>;
}) {
  if (matches.length === 0) return null;
  const totalRounds = Math.max(...matches.map(m => m.round));
  const finalMatch  = matches.find(m => m.round === totalRounds);
  if (!finalMatch?.winnerId) return null;

  const champion = finalMatch.winnerId;
  const runnerUp  = finalMatch.participant1Id === champion
    ? finalMatch.participant2Id
    : finalMatch.participant1Id;

  const semiMatches = totalRounds >= 2
    ? matches.filter(m => m.round === totalRounds - 1 && !!m.winnerId)
    : [];
  const { third, fourth } = rankBronze(semiMatches);

  const name  = (id: string | null) => id ? (participantsMap[id]?.fullName ?? "—") : "—";
  const photo = (id: string | null) => id ? (participantsMap[id]?.photo  ?? null) : null;

  const podiumRows = [
    { id: champion, emoji: "🥇", label: "1.er lugar — Campeón",   color: "#FFD700" },
    { id: runnerUp,  emoji: "🥈", label: "2.º lugar",              color: "#C0C0C0" },
    { id: third,     emoji: "🥉", label: "3.er lugar",             color: "#CD7F32" },
    { id: fourth,    emoji: "🥉", label: "4.º lugar",              color: "#CD7F32" },
  ].filter(r => r.id);

  return (
    <div
      className="bracket-medals print-hide mt-6 rounded-xl border overflow-hidden"
      style={{ borderColor: "#4a4a2a", background: "linear-gradient(135deg,#1a1a0a,#2a2a10)" }}
    >
      <div className="px-5 py-2 border-b text-center" style={{ borderColor: "#4a4a2a" }}>
        <h3 className="text-sm font-black tracking-widest" style={{ color: "#FFD700" }}>
          PODIO FINAL
        </h3>
      </div>

      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {podiumRows.map(row => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="text-3xl shrink-0">{row.emoji}</span>
            <PlayerAvatar
              name={name(row.id)}
              photo={photo(row.id)}
              color={colorMap[row.id ?? ""] ?? "AKA"}
              size={42}
            />
            <div className="min-w-0">
              <p
                className="text-[10px] font-black uppercase tracking-wider"
                style={{ color: row.color }}
              >
                {row.label}
              </p>
              <p className="text-sm font-bold text-white leading-tight truncate">
                {name(row.id)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tie notice if 3rd/4th were determined by tiebreaker */}
      {third && fourth && semiMatches.length === 2 && (() => {
        const [a, b] = semiMatches;
        const aLoserScore = a.winnerId === a.participant1Id ? (a.score2 ?? -1) : (a.score1 ?? -1);
        const bLoserScore = b.winnerId === b.participant1Id ? (b.score2 ?? -1) : (b.score1 ?? -1);
        if (aLoserScore === bLoserScore) {
          return (
            <div className="px-5 pb-3">
              <p className="text-[10px] text-dojo-muted/60 italic text-center">
                * 3.er y 4.º lugar determinados por desempate (puntuaciones iguales)
              </p>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}

// ── BracketView ───────────────────────────────────────────────────────────────

export function BracketView({ matches, participantsMap, onSaveMatch, saving, showMedals }: BracketViewProps) {
  const scaleRef = useRef<HTMLDivElement>(null);

  // AKA/AO color map computed from match data (conflict-resolved)
  const colorMap = buildColorMap(matches);

  // Dynamic print scaling
  useEffect(() => {
    function beforePrint() {
      const el = scaleRef.current;
      if (!el) return;
      const scale = Math.min(1, 1075 / el.scrollWidth, 710 / el.scrollHeight);
      el.style.transform       = `scale(${scale})`;
      el.style.transformOrigin = "top left";
    }
    function afterPrint() {
      if (scaleRef.current) {
        scaleRef.current.style.transform       = "";
        scaleRef.current.style.transformOrigin = "";
      }
    }
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint",  afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint",  afterPrint);
    };
  }, []);

  if (!matches.length) return null;

  const totalRounds = Math.max(...matches.map(m => m.round));
  const byRound: Record<number, BracketMatch[]> = {};
  for (const m of matches) (byRound[m.round] ??= []).push(m);

  // SVG connector paths
  const svgLines: { key: string; d: string }[] = [];
  for (let round = 2; round <= totalRounds; round++) {
    for (const parent of byRound[round] ?? []) {
      const pSlotH  = BASE_H * Math.pow(2, round - 1);
      const pCY     = (parent.matchNumber - 1) * pSlotH + pSlotH / 2;
      const pXLeft  = (round - 1) * (ROUND_W + CONN_W);
      const cSlotH  = BASE_H * Math.pow(2, round - 2);
      const cXRight = (round - 2) * (ROUND_W + CONN_W) + ROUND_W;
      const midX    = cXRight + CONN_W / 2;
      const prev    = byRound[round - 1] ?? [];
      const c1      = prev.find(m => m.matchNumber === 2 * parent.matchNumber - 1);
      const c2      = prev.find(m => m.matchNumber === 2 * parent.matchNumber);
      if (c1 && c2) {
        const y1 = (c1.matchNumber - 1) * cSlotH + cSlotH / 2;
        const y2 = (c2.matchNumber - 1) * cSlotH + cSlotH / 2;
        svgLines.push({ key: `c${round}-${parent.matchNumber}`,
          d: `M${cXRight} ${y1} H${midX} M${cXRight} ${y2} H${midX} M${midX} ${y1} V${y2} M${midX} ${pCY} H${pXLeft}` });
      } else if (c1) {
        const y1 = (c1.matchNumber - 1) * cSlotH + cSlotH / 2;
        svgLines.push({ key: `c${round}-${parent.matchNumber}`,
          d: `M${cXRight} ${y1} H${midX} V${pCY} H${pXLeft}` });
      }
    }
  }

  const round1Count = byRound[1]?.length ?? 1;
  const totalH      = round1Count * BASE_H;
  const totalW      = totalRounds * (ROUND_W + CONN_W) - CONN_W;

  return (
    <>
      {/* ── Print styles ───────────────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: landscape; margin: 6mm; }

          /* ── 1. Hide EVERYTHING on the page ─────────────────────────── */
          body * { visibility: hidden !important; }

          /* ── 2. Show ONLY the bracket print area ────────────────────── */
          .bracket-print-area,
          .bracket-print-area * { visibility: visible !important; }

          /* Position the bracket area at the top-left of the page */
          .bracket-print-area {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            padding: 4mm !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }

          /* ── 3. Re-hide interactive elements inside the bracket ─────── */
          .print-hide { display: none !important; visibility: hidden !important; }
          input[type="number"] { display: none !important; }

          /* ── 4. Show print-only header ──────────────────────────────── */
          .bracket-print-header { display: block !important; visibility: visible !important; }

          /* ── 5. Bracket visual styles ───────────────────────────────── */
          .bracket-wrapper { overflow: visible !important; }
          .bracket-player { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bracket-name   { color: #fff !important; }
          .bracket-score  { color: #fff !important; }
          .bracket-color-label { color: rgba(255,255,255,0.9) !important; }
          .bracket-match-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-shadow: none !important; }
          .bracket-round-label { color: #333 !important; }
          svg path { stroke: #777 !important; }
          .bracket-medals { -webkit-print-color-adjust: exact; print-color-adjust: exact; page-break-inside: avoid; }
        }
      `}} />

      <div className="bracket-wrapper overflow-x-auto pb-4">
        <div ref={scaleRef} style={{ width: totalW, minHeight: totalH + HEADER_H, position: "relative",
          background: "transparent" }}>

          {/* SVG connectors */}
          <svg style={{ position: "absolute", top: HEADER_H, left: 0, width: totalW, height: totalH,
            pointerEvents: "none", overflow: "visible" }}>
            {svgLines.map(l => (
              <path key={l.key} d={l.d} stroke="#4b5563" strokeWidth={1.5} fill="none" />
            ))}
          </svg>

          {/* Rounds */}
          <div className="flex" style={{ gap: CONN_W }}>
            {Array.from({ length: totalRounds }, (_, i) => i + 1).map(round => {
              const roundMatches = (byRound[round] ?? []).sort((a, b) => a.matchNumber - b.matchNumber);
              const slotH = BASE_H * Math.pow(2, round - 1);

              return (
                <div key={round} style={{ width: ROUND_W, flexShrink: 0 }}>
                  <div className="bracket-round-label text-center text-xs font-bold text-dojo-gold uppercase tracking-wider"
                    style={{ height: HEADER_H, lineHeight: `${HEADER_H}px` }}>
                    {getRoundLabel(round, totalRounds)}
                  </div>
                  <div style={{ position: "relative", height: totalH }}>
                    {roundMatches.map(match => {
                      const top = (match.matchNumber - 1) * slotH + slotH / 2 - MATCH_H / 2;
                      return (
                        <div key={match.id} style={{ position: "absolute", top, left: 4 }}>
                          <MatchBox
                            match={match}
                            participantsMap={participantsMap}
                            colorMap={colorMap}
                            onSaveMatch={onSaveMatch}
                            saving={saving === match.id}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Podio */}
          {showMedals && (
            <MedalsPodium matches={matches} participantsMap={participantsMap} colorMap={colorMap} />
          )}
        </div>
      </div>
    </>
  );
}
