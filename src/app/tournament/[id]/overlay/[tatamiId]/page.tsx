"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

// ── Types ────────────────────────────────────────────────────────────────────

interface Participant {
  id: string;
  fullName: string;
  photo: string | null;
  nationality: string | null;
  dojoName: string | null;
  weight: number | null;
  belt: string | null;
}

interface MatchInfo {
  id: string;
  round: number;
  matchNumber: number;
  bracketName: string;
  bracketType: string;
  bracketGender: string;
  participant1: Participant | null;
  participant2: Participant | null;
  winnerId: string | null;
  totals: {
    total1: number;
    total2: number;
    penalty1?: number;
    penalty2?: number;
  };
  isKata: boolean;
  kataCalc: { total1: number; total2: number } | null;
  reviewStatus: string;
  reviewRequestedBy: string | null;
  hanteiStatus: string;
  hanteiVotesAo: number;
  hanteiVotesAka: number;
}

interface TatamiData {
  tatami: {
    id: string; name: string; color: string; streamStatus: string; overlayMessage: string | null;
    matchStartedAt: string | null;  // ISO timestamp — cuando arrancó el segmento actual
    timerRunning: boolean;          // true = contando ahora mismo
    timerBase: number;              // segundos acumulados antes de la última pausa
    matchDuration: number;          // duración total del combate en segundos (default 120)
  };
  tournament: { id: string; name: string; dojo: { name: string; logo: string | null } } | null;
  match: MatchInfo | null;
}

// ── Flag helper ───────────────────────────────────────────────────────────────

const NATIONALITY_TO_CODE: Record<string, string> = {
  // Venezuela
  ve: "VE", ven: "VE", venezuela: "VE", venezolano: "VE", venezolana: "VE",
  // Colombia
  co: "CO", col: "CO", colombia: "CO", colombiano: "CO", colombiana: "CO",
  // Panama
  pa: "PA", pan: "PA", "panamá": "PA", panama: "PA", "panameño": "PA", "panameña": "PA",
  // Costa Rica
  cr: "CR", cri: "CR", "costa rica": "CR", costarricense: "CR",
  // Mexico
  mx: "MX", mex: "MX", "méxico": "MX", mexico: "MX", mexicano: "MX", mexicana: "MX",
  // Argentina
  ar: "AR", arg: "AR", argentina: "AR", argentino: "AR", argentina_f: "AR",
  // Brazil
  br: "BR", bra: "BR", brasil: "BR", brazil: "BR", "brasileño": "BR", "brasileña": "BR",
  // Chile
  cl: "CL", chile: "CL", chileno: "CL", chilena: "CL",
  // Peru
  pe: "PE", per: "PE", "perú": "PE", peru: "PE", peruano: "PE", peruana: "PE",
  // Ecuador
  ec: "EC", ecu: "EC", ecuador: "EC", ecuatoriano: "EC", ecuatoriana: "EC",
  // Bolivia
  bo: "BO", bol: "BO", bolivia: "BO", boliviano: "BO", boliviana: "BO",
  // Paraguay
  py: "PY", par: "PY", paraguay: "PY", paraguayo: "PY", paraguaya: "PY",
  // Uruguay
  uy: "UY", uru: "UY", uruguay: "UY", uruguayo: "UY", uruguaya: "UY",
  // Honduras
  hn: "HN", hon: "HN", honduras: "HN", "hondureño": "HN", "hondureña": "HN",
  // Guatemala
  gt: "GT", gua: "GT", guatemala: "GT", guatemalteco: "GT", guatemalteca: "GT",
  // "El Salvador"
  sv: "SV", slv: "SV", "el salvador": "SV", "salvadoreño": "SV", "salvadoreña": "SV",
  // Nicaragua
  ni: "NI", nic: "NI", nicaragua: "NI", "nicaragüense": "NI",
  // Cuba
  cu: "CU", cub: "CU", cuba: "CU", cubano: "CU", cubana: "CU",
  // Dominican Republic
  do: "DO", dom: "DO", "república dominicana": "DO", dominicano: "DO", dominicana: "DO",
  // Puerto Rico
  pr: "PR", "puerto rico": "PR", "puertorriqueño": "PR",
  // USA
  us: "US", usa: "US", "estados unidos": "US", americano: "US", americana: "US",
  // Spain
  es: "ES", esp: "ES", "españa": "ES", spain: "ES", "español": "ES", "española": "ES",
  // Japan
  jp: "JP", jpn: "JP", "japón": "JP", japon: "JP", japan: "JP", "japonés": "JP", japonesa: "JP",
  // Korea
  kr: "KR", kor: "KR", corea: "KR", korea: "KR", coreano: "KR", coreana: "KR",
  // China
  cn: "CN", china: "CN", chino: "CN", china_prc: "CN",
  // France
  fr: "FR", fra: "FR", francia: "FR", france: "FR", "francés": "FR",
  // Germany
  de: "DE", ger: "DE", alemania: "DE", germany: "DE", "alemán": "DE",
  // Italy
  it: "IT", ita: "IT", italia: "IT", italy: "IT", italiano: "IT",
};

function getFlagEmoji(nationality: string | null): string | null {
  if (!nationality) return null;
  const key = nationality.toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const normalized = key.replace(/[^a-z ]/g, "").trim();

  // Try exact match first, then normalized (no accents)
  const raw = nationality.toLowerCase().trim();
  const code = NATIONALITY_TO_CODE[raw] ?? NATIONALITY_TO_CODE[normalized];
  if (!code || code.length !== 2) return null;
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ photo, name, size = 88 }: { photo: string | null; name: string; size?: number }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      overflow: "hidden", flexShrink: 0,
      border: "3px solid rgba(255,255,255,0.35)",
      background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{
          color: "rgba(255,255,255,0.85)",
          fontSize: size * 0.36,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          userSelect: "none",
        }}>
          {initials || "?"}
        </span>
      )}
    </div>
  );
}

// ── Competitor card ───────────────────────────────────────────────────────────

function CompetitorCard({
  participant,
  score,
  penalty,
  isWinner,
  side,
}: {
  participant: Participant | null;
  score: number;
  penalty: number;
  isWinner: boolean;
  side: "ao" | "aka";
}) {
  const isAo   = side === "ao";
  const flag   = getFlagEmoji(participant?.nationality ?? null);
  const name   = participant?.fullName ?? (side === "ao" ? "AO" : "AKA");
  const dojo   = participant?.dojoName ?? null;
  const weight = participant?.weight ?? null;

  const bg = isAo
    ? "linear-gradient(135deg, rgba(10,36,99,0.96) 0%, rgba(30,64,175,0.92) 100%)"
    : "linear-gradient(225deg, rgba(127,0,0,0.96) 0%, rgba(200,30,30,0.92) 100%)";

  const sideLabel = isAo ? "AO" : "AKA";
  const sideLabelColor = isAo ? "rgba(147,197,253,0.9)" : "rgba(252,165,165,0.9)";

  const meta: string[] = [];
  if (dojo)   meta.push(dojo);
  if (flag)   meta.push(flag);
  if (weight) meta.push(`${weight} kg`);

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: isAo ? "row" : "row-reverse",
      alignItems: "center",
      gap: "18px",
      background: bg,
      padding: "18px 24px",
      borderRadius: isAo ? "14px 0 0 14px" : "0 14px 14px 0",
      border: isWinner ? "2px solid #FCD34D" : "2px solid transparent",
      boxShadow: isWinner
        ? "0 0 32px rgba(252,211,77,0.35), inset 0 0 20px rgba(252,211,77,0.08)"
        : "0 4px 32px rgba(0,0,0,0.5)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Watermark label */}
      <span style={{
        position: "absolute",
        top: "10px",
        [isAo ? "left" : "right"]: "16px",
        fontSize: "11px",
        fontWeight: 900,
        letterSpacing: "0.18em",
        color: sideLabelColor,
        textTransform: "uppercase",
        userSelect: "none",
      }}>
        {sideLabel}
      </span>

      {/* Avatar */}
      <Avatar photo={participant?.photo ?? null} name={name} size={88} />

      {/* Text block */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        textAlign: isAo ? "left" : "right",
        minWidth: 0,
      }}>
        <p style={{
          color: "white",
          fontSize: "28px",
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
          textShadow: "0 2px 10px rgba(0,0,0,0.7)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
        }}>
          {name}
        </p>

        {meta.length > 0 && (
          <p style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: "14px",
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            letterSpacing: "0.01em",
          }}>
            {meta.join("  ·  ")}
          </p>
        )}
      </div>

      {/* Score */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: "68px",
          fontWeight: 900,
          color: "white",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
          textShadow: "0 4px 16px rgba(0,0,0,0.6)",
        }}>
          {score}
        </span>
        {penalty > 0 && (
          <span style={{
            fontSize: "12px",
            color: "rgba(255,200,200,0.85)",
            fontWeight: 600,
            letterSpacing: "0.04em",
            marginTop: "2px",
          }}>
            C{penalty}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Timer hook ────────────────────────────────────────────────────────────────

function useCountdown(data: TatamiData | null): { remaining: number; urgent: boolean } {
  const [remaining, setRemaining] = useState(120);

  useEffect(() => {
    if (!data) return;

    const { timerRunning, timerBase, matchStartedAt, matchDuration } = data.tatami;
    const duration = matchDuration ?? 120;

    function calc() {
      let elapsed = timerBase;
      if (timerRunning && matchStartedAt) {
        elapsed += (Date.now() - new Date(matchStartedAt).getTime()) / 1000;
      }
      return Math.max(0, duration - elapsed);
    }

    setRemaining(calc());

    if (!timerRunning) return;

    const iv = setInterval(() => setRemaining(calc()), 200);
    return () => clearInterval(iv);
  }, [data]);

  return { remaining, urgent: remaining <= 30 && remaining > 0 };
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Main overlay ──────────────────────────────────────────────────────────────

export default function TatamiOverlay() {
  const { id, tatamiId } = useParams<{ id: string; tatamiId: string }>();
  const [data, setData] = useState<TatamiData | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const r = await fetch(`/api/public/tatami-display/${tatamiId}`, { cache: "no-store" });
        if (!r.ok) return;
        const payload: TatamiData = await r.json();
        setData(payload);
      } catch { /* silent */ }
    }

    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, [tatamiId, id]);

  const { remaining, urgent } = useCountdown(data);

  const isLive  = data?.tatami.streamStatus === "live";
  const match   = data?.match ?? null;
  const totals  = match?.totals;
  const score1  = totals?.total1 ?? 0;
  const score2  = totals?.total2 ?? 0;
  const penalty1 = totals?.penalty1 ?? 0;
  const penalty2 = totals?.penalty2 ?? 0;

  const isWinner1 = !!match?.winnerId && match.winnerId === match.participant1?.id;
  const isWinner2 = !!match?.winnerId && match.winnerId === match.participant2?.id;

  return (
    <div style={{
      width: "1920px",
      height: "1080px",
      position: "relative",
      background: "transparent",
      fontFamily: "'Segoe UI', 'Arial', sans-serif",
      overflow: "hidden",
    }}>

      {/* ── Top-left: tatami name ── */}
      <div style={{
        position: "absolute",
        top: "28px",
        left: "36px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}>
        <div style={{
          width: "14px", height: "14px", borderRadius: "50%",
          background: data?.tatami.color ?? "#C0392B",
          border: "2px solid rgba(255,255,255,0.4)",
          flexShrink: 0,
        }} />
        <span style={{
          color: "white",
          fontSize: "20px",
          fontWeight: 800,
          textShadow: "0 2px 10px rgba(0,0,0,0.9)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>
          {data?.tatami.name ?? ""}
        </span>
      </div>

      {/* ── Top-left: bracket info (below tatami name) ── */}
      {match && (
        <div style={{
          position: "absolute",
          top: "60px",
          left: "58px",
          color: "rgba(255,255,255,0.6)",
          fontSize: "13px",
          textShadow: "0 1px 6px rgba(0,0,0,0.8)",
        }}>
          {match.bracketName}{match.bracketGender ? ` · ${match.bracketGender === "M" ? "Masculino" : "Femenino"}` : ""} · R{match.round} #{match.matchNumber}
        </div>
      )}

      {/* ── Top-right: EN VIVO badge ── */}
      {isLive && (
        <div style={{
          position: "absolute",
          top: "28px",
          right: "36px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(220,38,38,0.92)",
          color: "white",
          padding: "8px 18px",
          borderRadius: "8px",
          fontSize: "15px",
          fontWeight: 800,
          letterSpacing: "0.12em",
          boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
        }}>
          <span style={{
            width: "10px", height: "10px", borderRadius: "50%",
            background: "white", display: "inline-block",
            animation: "pulse 1.5s ease-in-out infinite",
          }} />
          EN VIVO
        </div>
      )}

      {/* ── Hantei banner (top strip) ── */}
      {match && match.hanteiStatus === "voting" && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          background: "rgba(17,24,39,0.95)",
          padding: "14px 40px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
          zIndex: 10,
        }}>
          <span style={{ color: "#F59E0B", fontSize: "22px", fontWeight: 900, letterSpacing: "0.18em" }}>
            ⚖️  H A N T E I
          </span>
        </div>
      )}

      {/* ── Video Review banner (top strip) ── */}
      {match && match.reviewStatus !== "none" && match.reviewStatus !== "confirmed" && match.reviewStatus !== "reversed" && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          background: "rgba(37,99,235,0.95)",
          padding: "14px 40px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
          zIndex: 10,
        }}>
          <span style={{ fontSize: "22px" }}>📹</span>
          <span style={{
            color: "white", fontSize: "22px", fontWeight: 900,
            letterSpacing: "0.15em", textTransform: "uppercase",
          }}>
            VIDEO REVIEW
          </span>
          <span style={{ fontSize: "22px" }}>📹</span>
        </div>
      )}

      {/* ── Bottom: competitor cards ── */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "0 0 28px",
      }}>
        {match ? (
          <div style={{
            display: "flex",
            alignItems: "stretch",
            gap: 0,
            margin: "0 28px",
          }}>
            {/* AO — left / competitor 1 */}
            <CompetitorCard
              participant={match.participant1}
              score={score1}
              penalty={penalty1}
              isWinner={isWinner1}
              side="ao"
            />

            {/* Timer / VS separator */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 16px",
              background: "rgba(0,0,0,0.80)",
              gap: "2px",
              minWidth: "120px",
              flexShrink: 0,
            }}>
              {/* Countdown */}
              <span style={{
                fontSize: "52px",
                fontWeight: 900,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
                letterSpacing: "-0.02em",
                color: remaining === 0
                  ? "#EF4444"
                  : urgent
                    ? "#FCD34D"
                    : "white",
                textShadow: urgent
                  ? "0 0 20px rgba(252,211,77,0.6)"
                  : remaining === 0
                    ? "0 0 20px rgba(239,68,68,0.6)"
                    : "0 2px 12px rgba(0,0,0,0.7)",
                animation: remaining === 0 ? "flashRed 0.8s ease-in-out infinite" : "none",
              }}>
                {formatTime(remaining)}
              </span>

              {/* VS label */}
              <span style={{
                color: "rgba(255,255,255,0.35)",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                marginTop: "2px",
              }}>
                VS
              </span>

              {/* Kata badge */}
              {match.isKata && (
                <span style={{
                  color: "rgba(255,255,255,0.3)",
                  fontSize: "9px",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}>KATA</span>
              )}
            </div>

            {/* AKA — right / competitor 2 */}
            <CompetitorCard
              participant={match.participant2}
              score={score2}
              penalty={penalty2}
              isWinner={isWinner2}
              side="aka"
            />
          </div>
        ) : (
          /* Sin match activo: solo mensaje */
          data?.tatami.overlayMessage ? (
            <div style={{
              margin: "0 36px",
              color: "rgba(255,255,255,0.6)",
              fontSize: "20px",
              fontWeight: 500,
              textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            }}>
              {data.tatami.overlayMessage}
            </div>
          ) : null
        )}
      </div>

      <style>{`
        @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes flashRed { 0%,100% { opacity:1; } 50% { opacity:0.25; } }
        body, html { background: transparent !important; margin: 0; padding: 0; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
