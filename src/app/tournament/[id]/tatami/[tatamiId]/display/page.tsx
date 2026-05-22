"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";

/* ── Tipos ─────────────────────────────────────────────── */
interface Participant {
  id: string; fullName: string; photo: string | null;
  nationality: string | null; belt: string | null;
  dojoName: string | null;
}
interface KumiTotals {
  ippon1:    number; wazaari1: number; yuko1: number;
  ippon2:    number; wazaari2: number; yuko2: number;
  chukoku1:  number; hansoku1: number;
  chukoku2:  number; hansoku2: number;
  total1:    number; total2:   number;
  lastTech1: string | null; lastTech2: string | null;
}
interface KataCalc {
  raw1: number[]; raw2: number[];
  dropped1: number[]; dropped2: number[];
  total1: number; total2: number;
}
interface JudgeScore {
  judge: { id: string; name: string; role: string };
  kataScore1: number | null; kataScore2: number | null;
  score1: number; score2: number;
}
interface MatchInfo {
  id: string; round: number; matchNumber: number;
  bracketName: string; bracketType: string; bracketGender: string;
  participant1: Participant | null; participant2: Participant | null;
  winnerId: string | null; winnerName: string | null;
  senshu: string | null; // participantId del primer anotador
  isKata: boolean;
  judgeScores: JudgeScore[];
  totals: KumiTotals;
  kataCalc: KataCalc | null;
}
interface DisplayData {
  tatami: {
    id: string; name: string; color: string; streamStatus: string;
    overlayMessage: string | null; matchStartedAt: string | null;
    timerRunning: boolean; timerBase: number; matchDuration: number;
    matchDisplayState: string;
    winnerParticipantId: string | null;
    winnerReason: string | null;
    matchWonAt: string | null;
    videoReviewEnabled: boolean;
  };
  tournament: { id: string; name: string; dojo: { name: string; logo: string | null } };
  match: (MatchInfo & {
    reviewStatus: string;
    reviewRequestedBy: string | null;
    hanteiStatus: string;
    hanteiVotesAo: number;
    hanteiVotesAka: number;
    hanteiWinnerId: string | null;
  }) | null;
}

/* ── Colores de cinta ───────────────────────────────────── */
const BELT: Record<string, string> = {
  "blanca":"#FFF","blanca-celeste":"#87CEEB","blanco-amarillo":"#FFE566",
  "amarilla":"#FFD700","naranja":"#FFA500","verde":"#228B22",
  "azul":"#1E3A8A","morada":"#6B21A8","roja":"#DC2626",
  "café":"#92400E","café-1-raya":"#92400E","negra":"#111",
  "negra-1-dan":"#111","negra-2-dan":"#111","negra-3-dan":"#111",
};

/* ── Técnica → etiqueta ──────────────────────────────────── */
const TECH_LABEL: Record<string, { label: string; color: string }> = {
  ippon:    { label: "IPPON",     color: "#F59E0B" },
  wazaari:  { label: "WAZA-ARI",  color: "#3B82F6" },
  yuko:     { label: "YUKO",      color: "#10B981" },
  chukoku:  { label: "CHUKOKU",   color: "#EF4444" },
  hansoku:  { label: "HANSOKU",   color: "#DC2626" },
};

/* ── Bandera emoji por código de país ───────────────────── */
function nationalityToFlag(code: string): string {
  // Convierte código de 2-3 letras a emoji de bandera (ISO 3166-1 alpha-2)
  const c = code.toUpperCase().slice(0, 2);
  const KNOWN: Record<string, string> = {
    PA:"🇵🇦",CR:"🇨🇷",MX:"🇲🇽",CO:"🇨🇴",VE:"🇻🇪",DO:"🇩🇴",GT:"🇬🇹",
    HN:"🇭🇳",NI:"🇳🇮",SV:"🇸🇻",BO:"🇧🇴",PE:"🇵🇪",CL:"🇨🇱",AR:"🇦🇷",
    BR:"🇧🇷",EC:"🇪🇨",UY:"🇺🇾",PY:"🇵🇾",CU:"🇨🇺",ES:"🇪🇸",US:"🇺🇸",
    JP:"🇯🇵",KR:"🇰🇷",CN:"🇨🇳",FR:"🇫🇷",DE:"🇩🇪",IT:"🇮🇹",GB:"🇬🇧",
    AU:"🇦🇺",CA:"🇨🇦",PT:"🇵🇹",RU:"🇷🇺",TR:"🇹🇷",EG:"🇪🇬",MA:"🇲🇦",
  };
  return KNOWN[c] ?? "🏳️";
}

/* ── Componente: Columna de competidor ───────────────────── */
function CompetitorCol({
  participant, total, isLeft, isWinner, isSenshu,
  ippon, wazaari, yuko, chukoku, hansoku, lastTech, color,
}: {
  participant: Participant | null; total: number; isLeft: boolean; isWinner: boolean;
  isSenshu: boolean;
  ippon: number; wazaari: number; yuko: number; chukoku: number; hansoku: number;
  lastTech: string | null; color: string;
}) {
  const belt  = participant?.belt ? (BELT[participant.belt] ?? "#888") : "#555";
  const tech  = lastTech ? TECH_LABEL[lastTech] : null;
  const totalPenalties = chukoku + hansoku;

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      padding: "32px 40px",
      background: isLeft ? "rgba(30,58,138,0.85)" : "rgba(127,29,29,0.85)",
      position: "relative", overflow: "hidden",
      border: isWinner ? `4px solid #F59E0B` : "4px solid transparent",
      borderRadius: isLeft ? "24px 0 0 24px" : "0 24px 24px 0",
      transition: "border-color 0.5s ease",
    }}>

      {/* Borde de cinta */}
      <div style={{
        position: "absolute", [isLeft ? "left" : "right"]: 0, top: 0, bottom: 0,
        width: "12px", background: belt, opacity: 0.9,
      }}/>

      {/* Senshu badge — primer anotador */}
      {isSenshu && !isWinner && (
        <div style={{
          position: "absolute", top: "12px", [isLeft ? "right" : "left"]: "20px",
          background: "rgba(245,158,11,0.9)", color: "#111",
          padding: "4px 12px", borderRadius: "8px",
          fontSize: "14px", fontWeight: 900, letterSpacing: "0.1em",
        }}>
          先取 SENSHU
        </div>
      )}

      {/* Winner banner */}
      {isWinner && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          background: "linear-gradient(135deg, #F59E0B, #D97706)",
          padding: "10px 20px", textAlign: "center",
          fontSize: "28px", fontWeight: 900, color: "#111",
          letterSpacing: "0.15em",
        }}>
          🏆 GANADOR
        </div>
      )}

      {/* Chui / Hansoku — SIEMPRE visible, prominente */}
      <div style={{
        position: "absolute", bottom: "16px", [isLeft ? "right" : "left"]: "20px",
        display: "flex", gap: "6px", alignItems: "center",
      }}>
        {Array.from({ length: Math.min(chukoku, 5) }).map((_, i) => (
          <div key={`c${i}`} style={{
            width: "22px", height: "22px", borderRadius: "50%",
            background: "#EF4444", border: "2px solid #FCA5A5",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "11px", fontWeight: 900, color: "white",
          }}>C</div>
        ))}
        {Array.from({ length: Math.min(hansoku, 3) }).map((_, i) => (
          <div key={`h${i}`} style={{
            width: "22px", height: "22px", borderRadius: "50%",
            background: "#DC2626", border: "2px solid #FF6B6B",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "10px", fontWeight: 900, color: "white",
          }}>H</div>
        ))}
        {totalPenalties === 0 && (
          <p style={{ color: "rgba(255,255,255,0.15)", fontSize: "13px", fontWeight: 700, margin: 0 }}>
            Sin faltas
          </p>
        )}
      </div>

      {/* Foto + Nombre + Dojo + País */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px", marginTop: isWinner ? "60px" : "0", flex: 1 }}>
        {participant?.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={participant.photo} alt="" style={{
            width: "100px", height: "100px", borderRadius: "50%",
            objectFit: "cover", border: `3px solid ${belt}`,
            flexShrink: 0,
          }}/>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Bandera + Nacionalidad */}
          {participant?.nationality && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "24px" }}>
                {nationalityToFlag(participant.nationality)}
              </span>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "16px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>
                {participant.nationality}
              </p>
            </div>
          )}
          {/* Nombre del competidor */}
          <p style={{
            color: "white", fontSize: "clamp(24px, 3.5vw, 44px)", fontWeight: 900,
            lineHeight: 1.05, overflow: "hidden", textOverflow: "ellipsis",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            margin: 0,
          }}>
            {participant?.fullName ?? "—"}
          </p>
          {/* Nombre del dojo */}
          {participant?.dojoName && (
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "14px", fontWeight: 600, marginTop: "4px", letterSpacing: "0.04em" }}>
              {participant.dojoName}
            </p>
          )}
        </div>
      </div>

      {/* Puntuación total */}
      <div style={{
        fontSize: "clamp(80px, 14vw, 160px)", fontWeight: 900, color: "white",
        lineHeight: 1, textAlign: "center", margin: "20px 0",
        textShadow: "0 4px 24px rgba(0,0,0,0.5)",
        fontVariantNumeric: "tabular-nums",
      }}>
        {total}
      </div>

      {/* Técnicas */}
      <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
        {[
          { label: "IPPON",    val: ippon,    color: "#F59E0B", pts: "×3" },
          { label: "WAZA-ARI", val: wazaari,  color: "#3B82F6", pts: "×2" },
          { label: "YUKO",     val: yuko,     color: "#10B981", pts: "×1" },
        ].map(t => (
          <div key={t.label} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "10px 18px", borderRadius: "14px",
            background: `${t.color}22`, border: `1.5px solid ${t.color}55`,
          }}>
            <span style={{ color: t.color, fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em" }}>{t.label}</span>
            <span style={{ color: "white", fontSize: "36px", fontWeight: 900, lineHeight: 1.1 }}>{t.val}</span>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px" }}>{t.pts}</span>
          </div>
        ))}
      </div>

      {/* Penalizaciones */}
      {(chukoku > 0 || hansoku > 0) && (
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "12px" }}>
          {chukoku > 0 && (
            <div style={{
              padding: "6px 14px", borderRadius: "10px",
              background: "rgba(239,68,68,0.2)", border: "1.5px solid rgba(239,68,68,0.5)",
              color: "#FCA5A5", fontSize: "15px", fontWeight: 800,
            }}>
              C×{chukoku}
            </div>
          )}
          {hansoku > 0 && (
            <div style={{
              padding: "6px 14px", borderRadius: "10px",
              background: "rgba(220,38,38,0.3)", border: "1.5px solid rgba(220,38,38,0.6)",
              color: "#FCA5A5", fontSize: "15px", fontWeight: 800,
            }}>
              H×{hansoku}
            </div>
          )}
        </div>
      )}

      {/* Última técnica */}
      {tech && (
        <div style={{
          position: "absolute", [isLeft ? "right" : "left"]: "20px", top: "50%",
          transform: "translateY(-50%)",
          padding: "14px 24px", borderRadius: "16px",
          background: tech.color, color: "white",
          fontSize: "22px", fontWeight: 900, letterSpacing: "0.1em",
          boxShadow: `0 4px 20px ${tech.color}88`,
          animation: "fadeBadge 0.4s ease",
        }}>
          {tech.label}
        </div>
      )}
    </div>
  );
}

/* ── Pantalla de espera ─────────────────────────────────── */
function WaitingScreen({ tatami, tournament }: { tatami: DisplayData["tatami"]; tournament: DisplayData["tournament"] }) {
  const sencho = useSencho(tatami.matchStartedAt, tatami.timerRunning, tatami.timerBase, tatami.matchDuration);
  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "#080C14", overflow: "hidden",
    }}>
      {/* Header con Sencho siempre visible */}
      <div style={{
        padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: tatami.color, boxShadow: `0 0 10px ${tatami.color}` }}/>
          <div>
            <p style={{ color: "white", fontSize: "22px", fontWeight: 800, margin: 0 }}>{tatami.name}</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", margin: 0 }}>{tournament.name}</p>
          </div>
        </div>
        <SenchoBlock sencho={sencho}/>
      </div>

      {/* Centro: En espera */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "16px",
      }}>
        <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: tatami.color, boxShadow: `0 0 24px ${tatami.color}` }}/>
        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "22px", margin: 0, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          En espera del siguiente combate
        </p>
        {tatami.overlayMessage && (
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "18px", margin: 0 }}>{tatami.overlayMessage}</p>
        )}
      </div>
    </div>
  );
}

/* ── Pantalla Kata ──────────────────────────────────────── */
function KataScreen({ match, tatami }: { match: MatchInfo; tatami: DisplayData["tatami"] }) {
  const sencho = useSencho(tatami.matchStartedAt, tatami.timerRunning, tatami.timerBase, tatami.matchDuration);
  const calc     = match.kataCalc;
  const isWinner = !!match.winnerId;

  // Vista de 1 competidor por vez según participantes disponibles
  const showBoth = match.participant1 && match.participant2;

  function KataCompCard({ participant, rawScores, dropped, total, isWinner: win }: {
    participant: Participant | null;
    rawScores: number[]; dropped: number[]; total: number; isWinner: boolean;
  }) {
    const belt = participant?.belt ? (BELT[participant.belt] ?? "#888") : "#555";
    return (
      <div style={{
        flex: 1, padding: "32px", borderRadius: "20px",
        background: "rgba(30,30,60,0.85)",
        border: win ? "3px solid #F59E0B" : "3px solid rgba(255,255,255,0.08)",
      }}>
        {win && (
          <div style={{ textAlign: "center", color: "#F59E0B", fontSize: "22px", fontWeight: 900, marginBottom: "12px", letterSpacing: "0.1em" }}>
            🏆 GANADOR
          </div>
        )}
        {/* Nombre */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px" }}>
          <div style={{ width: "10px", height: "60px", borderRadius: "5px", background: belt, flexShrink: 0 }}/>
          <p style={{ color: "white", fontSize: "clamp(22px,3vw,38px)", fontWeight: 900, margin: 0 }}>
            {participant?.fullName ?? "—"}
          </p>
        </div>
        {/* Notas de jueces */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
          {rawScores.map((score, i) => {
            const isDropped = dropped.includes(score);
            return (
              <div key={i} style={{
                padding: "12px 18px", borderRadius: "14px", minWidth: "70px", textAlign: "center",
                background: isDropped ? "rgba(255,255,255,0.05)" : "rgba(59,130,246,0.2)",
                border: isDropped ? "1.5px solid rgba(255,255,255,0.1)" : "1.5px solid rgba(59,130,246,0.4)",
                opacity: isDropped ? 0.4 : 1,
                position: "relative",
              }}>
                {isDropped && (
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%) rotate(-20deg)", color: "rgba(255,255,255,0.4)", fontSize: "28px", fontWeight: 900 }}>
                    —
                  </div>
                )}
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", marginBottom: "4px" }}>J{i+1}</p>
                <p style={{ color: isDropped ? "rgba(255,255,255,0.3)" : "white", fontSize: "26px", fontWeight: 900, margin: 0 }}>
                  {score.toFixed(1)}
                </p>
              </div>
            );
          })}
        </div>
        {/* Total */}
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", margin: "0 0 4px", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Total
          </p>
          <p style={{ color: "white", fontSize: "clamp(60px,10vw,100px)", fontWeight: 900, margin: 0, lineHeight: 1 }}>
            {total.toFixed(2)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "#080C14", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: tatami.color }}/>
          <div>
            <p style={{ color: "white", fontSize: "22px", fontWeight: 800, margin: 0 }}>{tatami.name}</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", margin: 0 }}>
              {match.bracketName} · Ronda {match.round} · Match {match.matchNumber}
            </p>
          </div>
        </div>
        <SenchoBlock sencho={sencho}/>
        <div style={{
          padding: "8px 20px", borderRadius: "10px",
          background: "rgba(139,92,246,0.3)", border: "1.5px solid rgba(139,92,246,0.5)",
          color: "#A78BFA", fontSize: "18px", fontWeight: 800, letterSpacing: "0.1em",
        }}>
          KATA {match.bracketGender?.toUpperCase()}
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, display: "flex", gap: "20px", padding: "24px 40px", alignItems: "stretch" }}>
        {showBoth ? (
          <>
            <KataCompCard
              participant={match.participant1}
              rawScores={calc?.raw1 ?? []}
              dropped={calc?.dropped1 ?? []}
              total={calc?.total1 ?? 0}
              isWinner={match.winnerId != null && match.participant1 != null && match.winnerName === match.participant1?.fullName}
            />
            <div style={{ width: "2px", background: "rgba(255,255,255,0.08)", borderRadius: "1px", flexShrink: 0 }}/>
            <KataCompCard
              participant={match.participant2}
              rawScores={calc?.raw2 ?? []}
              dropped={calc?.dropped2 ?? []}
              total={calc?.total2 ?? 0}
              isWinner={match.winnerId != null && match.participant2 != null && match.winnerName === match.participant2?.fullName}
            />
          </>
        ) : (
          <KataCompCard
            participant={match.participant1 ?? match.participant2}
            rawScores={calc?.raw1 ?? calc?.raw2 ?? []}
            dropped={calc?.dropped1 ?? calc?.dropped2 ?? []}
            total={calc?.total1 ?? calc?.total2 ?? 0}
            isWinner={isWinner}
          />
        )}
      </div>
    </div>
  );
}

/* ── Pantalla Kumite ────────────────────────────────────── */
function KumiteScreen({ match, tatami, matchStartedAt }: {
  match: MatchInfo; tatami: DisplayData["tatami"]; matchStartedAt: string | null
}) {
  const t      = match.totals as KumiTotals;
  const sencho = useSencho(matchStartedAt, tatami.timerRunning, tatami.timerBase, tatami.matchDuration);

  // Detectar Senshu perdido (≥5 penalizaciones del competidor que tiene senshu)
  const p1Penalties  = t.chukoku1 + t.hansoku1;
  const p2Penalties  = t.chukoku2 + t.hansoku2;
  const p1HasSenshu  = !!(match.senshu && match.participant1?.id && match.senshu === match.participant1.id);
  const p2HasSenshu  = !!(match.senshu && match.participant2?.id && match.senshu === match.participant2.id);
  const senshuPerdido       = (p1HasSenshu && p1Penalties >= 5) || (p2HasSenshu && p2Penalties >= 5);
  const senshuPerdidoNombre = senshuPerdido
    ? (p1HasSenshu ? match.participant1?.fullName : match.participant2?.fullName) ?? ""
    : null;

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "#080C14", overflow: "hidden",
    }}>
      {/* Overlay SENSHU PERDIDO */}
      {senshuPerdido && !match.winnerId && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 40, textAlign: "center",
          padding: "32px 56px", borderRadius: "20px",
          background: "rgba(0,0,0,0.85)",
          border: "3px solid rgba(239,68,68,0.6)",
          animation: "fadeIn 0.3s ease",
        }}>
          <p style={{ color: "#EF4444", fontSize: "clamp(36px,5vw,64px)", fontWeight: 900, letterSpacing: "0.12em", margin: 0, textShadow: "0 0 30px rgba(239,68,68,0.7)" }}>
            先取 SENSHU PERDIDO
          </p>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "clamp(18px,2.5vw,28px)", fontWeight: 700, margin: "12px 0 0", letterSpacing: "0.1em" }}>
            {senshuPerdidoNombre}
          </p>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "16px", marginTop: "8px" }}>5 faltas acumuladas</p>
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: tatami.color, boxShadow: `0 0 10px ${tatami.color}` }}/>
          <div>
            <p style={{ color: "white", fontSize: "20px", fontWeight: 800, margin: 0, letterSpacing: "0.05em" }}>{tatami.name}</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>
              {match.bracketName} · Ronda {match.round} · Match {match.matchNumber}
              {match.bracketGender && ` · ${match.bracketGender}`}
            </p>
          </div>
        </div>

        {/* Sencho — siempre visible, tamaño grande en Kumite */}
        <SenchoBlock sencho={sencho} large/>

        <div style={{
          padding: "8px 20px", borderRadius: "10px",
          background: "rgba(239,68,68,0.2)", border: "1.5px solid rgba(239,68,68,0.4)",
          color: "#FCA5A5", fontSize: "16px", fontWeight: 800, letterSpacing: "0.1em",
        }}>
          KUMITE
        </div>
      </div>

      {/* Scores */}
      <div style={{ flex: 1, display: "flex", gap: "0", overflow: "hidden" }}>
        <CompetitorCol
          participant={match.participant1} total={t.total1} isLeft={true}
          isWinner={!!match.winnerId && match.winnerName === match.participant1?.fullName}
          isSenshu={p1HasSenshu && !senshuPerdido}
          ippon={t.ippon1} wazaari={t.wazaari1} yuko={t.yuko1}
          chukoku={t.chukoku1} hansoku={t.hansoku1}
          lastTech={t.lastTech1}
          color={tatami.color}
        />

        {/* Centro VS + indicador empate Senshu */}
        <div style={{
          width: "80px", flexShrink: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: "8px",
          background: "#0D1117", zIndex: 1,
        }}>
          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "22px", fontWeight: 900 }}>VS</span>
          {t.total1 === t.total2 && match.senshu && !match.winnerId && (
            <div style={{
              fontSize: "9px", fontWeight: 900, padding: "3px 6px", borderRadius: "4px",
              background: "rgba(245,158,11,0.2)", color: "#F59E0B", letterSpacing: "0.05em",
              textAlign: "center", lineHeight: 1.3,
            }}>
              EMPATE<br/>先取
            </div>
          )}
        </div>

        <CompetitorCol
          participant={match.participant2} total={t.total2} isLeft={false}
          isWinner={!!match.winnerId && match.winnerName === match.participant2?.fullName}
          isSenshu={p2HasSenshu && !senshuPerdido}
          ippon={t.ippon2} wazaari={t.wazaari2} yuko={t.yuko2}
          chukoku={t.chukoku2} hansoku={t.hansoku2}
          lastTech={t.lastTech2}
          color={tatami.color}
        />
      </div>

      {/* Footer con mensaje */}
      {tatami.overlayMessage && !sencho.finished && (
        <div style={{
          padding: "12px 32px", background: "rgba(255,255,255,0.04)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.6)", fontSize: "16px", textAlign: "center",
        }}>
          {tatami.overlayMessage}
        </div>
      )}

      {/* ── OVERLAY TERMINADO — cubre toda la pantalla al llegar a 0:00 ── */}
      {sencho.finished && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 50,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.88)",
          animation: "fadeIn 0.4s ease",
        }}>
          <div style={{
            textAlign: "center", padding: "48px 64px", borderRadius: "24px",
            background: "rgba(220,38,38,0.15)",
            border: "3px solid rgba(220,38,38,0.5)",
          }}>
            <p style={{
              color: "#EF4444", fontSize: "clamp(48px,8vw,96px)", fontWeight: 900,
              letterSpacing: "0.15em", margin: 0, lineHeight: 1,
              textShadow: "0 0 40px rgba(239,68,68,0.8)",
            }}>
              TIEMPO
            </p>
            <p style={{
              color: "rgba(255,255,255,0.7)", fontSize: "clamp(20px,3vw,32px)", fontWeight: 700,
              letterSpacing: "0.2em", margin: "16px 0 0", textTransform: "uppercase",
            }}>
              Combate Terminado
            </p>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "16px", marginTop: "12px" }}>
              {tatami.name}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Hook: cronómetro Sencho regresivo (2:00 → 0:00) ─────── */
function useSencho(startedAt: string | null, running: boolean, baseElapsed: number, duration = 120) {
  const [elapsed, setElapsed] = useState(baseElapsed);
  const beepedRef = useRef(false);

  useEffect(() => {
    if (!running || !startedAt) {
      setElapsed(Math.min(baseElapsed, duration));
      return;
    }
    const start = new Date(startedAt).getTime();
    const tick  = () => {
      const e = Math.min(Math.floor((Date.now() - start) / 1000), duration);
      setElapsed(e);
      // Sonido al llegar a 0
      if (e >= duration && !beepedRef.current) {
        beepedRef.current = true;
        try {
          const ctx  = new AudioContext();
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = "square"; osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.4, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
          osc.start(); osc.stop(ctx.currentTime + 1.2);
        } catch { /* Safari o contexto sin audio */ }
      }
    };
    beepedRef.current = false;
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [startedAt, running, baseElapsed, duration]);

  const remaining = Math.max(0, duration - elapsed);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const finished = remaining === 0;
  return { time: `${mm}:${ss}`, running, elapsed, remaining, finished };
}

/* ── Sencho visual (siempre visible) ─────────────────────── */
function SenchoBlock({ sencho, large = false }: { sencho: { time: string; running: boolean; remaining?: number; finished?: boolean }; large?: boolean }) {
  const paused    = !sencho.running;
  const critical  = (sencho.remaining ?? 999) <= 30 && !sencho.finished;
  const finished  = sencho.finished ?? false;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: large ? "6px" : "2px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <p style={{
          color: "rgba(255,255,255,0.35)", fontSize: large ? "14px" : "11px",
          fontWeight: 700, letterSpacing: "0.18em", margin: 0, textTransform: "uppercase",
        }}>
          SENCHO
        </p>
        {paused && (
          <span style={{
            fontSize: large ? "12px" : "9px", fontWeight: 800, padding: "1px 6px",
            borderRadius: "4px", background: "rgba(239,68,68,0.3)", color: "#FCA5A5",
            letterSpacing: "0.1em", textTransform: "uppercase",
          }}>
            PAUSA
          </span>
        )}
      </div>
      <p style={{
        color: finished ? "#EF4444" : critical ? "#F59E0B" : paused ? "rgba(255,255,255,0.45)" : "white",
        fontSize: large ? "clamp(48px,7vw,80px)" : "clamp(28px,4vw,52px)",
        fontWeight: 900, margin: 0, lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
        fontFamily: "'Courier New', 'Roboto Mono', monospace",
        letterSpacing: "0.06em",
        textShadow: finished ? "0 0 30px rgba(239,68,68,0.8)" : critical ? "0 0 20px rgba(245,158,11,0.6)" : paused ? "none" : "0 2px 12px rgba(0,0,0,0.5)",
        opacity: paused && !finished ? 0.6 : 1,
        animation: finished ? "pulse 0.5s ease infinite" : "none",
      }}>
        {sencho.time}
      </p>
      {finished && (
        <p style={{ color: "#EF4444", fontSize: large ? "14px" : "10px", fontWeight: 900, letterSpacing: "0.2em", margin: 0, textTransform: "uppercase" }}>
          TIEMPO
        </p>
      )}
    </div>
  );
}

/* ── Banner de Video Review ─────────────────────────────── */
function VideoReviewBanner({ requestedBy }: { requestedBy: string | null }) {
  const who = requestedBy === "ao" ? "AO" : requestedBy === "aka" ? "AKA" : "Árbitro";
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, zIndex: 60,
      background: "rgba(37,99,235,0.95)",
      padding: "16px 32px",
      display: "flex", alignItems: "center", justifyContent: "center", gap: "16px",
      animation: "fadeIn 0.3s ease",
    }}>
      <span style={{ fontSize: "28px" }}>📹</span>
      <div style={{ textAlign: "center" }}>
        <p style={{
          color: "white", fontSize: "clamp(20px,3vw,36px)", fontWeight: 900,
          letterSpacing: "0.15em", margin: 0,
        }}>
          VIDEO REVIEW EN PROCESO
        </p>
        <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "clamp(13px,1.5vw,18px)", margin: "4px 0 0", letterSpacing: "0.08em" }}>
          Solicitado por {who} · Espere la decisión del árbitro
        </p>
      </div>
      <span style={{ fontSize: "28px" }}>📹</span>
    </div>
  );
}

/* ── Pantalla de Ganador ─────────────────────────────────── */
function WinnerScreen({
  match, tatami,
}: {
  match: DisplayData["match"] & {};
  tatami: DisplayData["tatami"];
}) {
  const winnerId  = tatami.winnerParticipantId;
  const winner    = winnerId === match?.participant1?.id ? match?.participant1 : match?.participant2;
  const loser     = winnerId === match?.participant1?.id ? match?.participant2 : match?.participant1;
  const winnerSide = winnerId === match?.participant1?.id ? "AO" : "AKA";
  const reason    = tatami.winnerReason ?? "points";

  const REASON_LABELS: Record<string, string> = {
    points:  "Victoria por Puntos",
    ippon:   "Victoria por IPPON",
    wazaari: "Victoria por WAZA-ARI",
    hansoku: "Victoria por HANSOKU del contrario",
    kiken:   "Victoria por KIKEN (lesión/ausencia)",
    senshu:  "Victoria por SENSHU (primer anotador)",
  };

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!tatami.matchWonAt) return;
    const wonAt = new Date(tatami.matchWonAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - wonAt) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [tatami.matchWonAt]);

  const belt = winner?.belt ? (BELT[winner.belt] ?? "#888") : "#FFD700";

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "radial-gradient(ellipse at center, #1a1200 0%, #080C14 70%)",
      alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
    }}>
      {/* Confetti rings */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            width: `${200 + i * 80}px`, height: `${200 + i * 80}px`,
            border: `2px solid rgba(255,215,0,${0.08 - i * 0.01})`,
            borderRadius: "50%",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            animation: `ring-pulse ${2 + i * 0.3}s ease-in-out infinite`,
          }}/>
        ))}
      </div>

      {/* Side label */}
      <div style={{
        position: "absolute", top: "24px",
        background: winnerSide === "AO" ? "rgba(30,58,138,0.8)" : "rgba(127,29,29,0.8)",
        padding: "8px 24px", borderRadius: "8px",
        color: winnerSide === "AO" ? "#93C5FD" : "#FCA5A5",
        fontSize: "16px", fontWeight: 900, letterSpacing: "0.2em",
      }}>
        {winnerSide}
      </div>

      {/* Trophy */}
      <div style={{ fontSize: "clamp(48px,7vw,96px)", marginBottom: "8px", filter: "drop-shadow(0 0 30px rgba(255,215,0,0.8))" }}>
        🏆
      </div>

      {/* "GANADOR" title */}
      <p style={{
        color: "#FFD700", fontSize: "clamp(32px,6vw,72px)", fontWeight: 900,
        letterSpacing: "0.2em", textTransform: "uppercase", margin: "0 0 16px",
        textShadow: "0 0 40px rgba(255,215,0,0.8)",
        animation: "pulse 1.5s ease-in-out infinite",
      }}>
        GANADOR
      </p>

      {/* Avatar */}
      {winner?.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={winner.photo} alt="" style={{
          width: "clamp(120px,15vw,200px)", height: "clamp(120px,15vw,200px)",
          borderRadius: "50%", objectFit: "cover",
          border: `6px solid ${belt}`,
          boxShadow: `0 0 40px ${belt}80`,
          marginBottom: "16px",
        }}/>
      ) : (
        <div style={{
          width: "clamp(120px,15vw,200px)", height: "clamp(120px,15vw,200px)",
          borderRadius: "50%", border: `6px solid ${belt}`,
          background: "rgba(255,215,0,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "16px",
          fontSize: "clamp(40px,6vw,80px)", fontWeight: 900, color: belt,
        }}>
          {(winner?.fullName ?? "?")[0]}
        </div>
      )}

      {/* Winner name */}
      <p style={{
        color: "white", fontSize: "clamp(24px,4vw,52px)", fontWeight: 900,
        letterSpacing: "0.03em", margin: "0 0 6px", textAlign: "center", padding: "0 40px",
        textShadow: "0 2px 20px rgba(0,0,0,0.8)",
      }}>
        {winner?.fullName ?? "—"}
      </p>
      {winner?.dojoName && (
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "clamp(14px,2vw,22px)", fontWeight: 600, margin: "0 0 16px" }}>
          {winner.nationality ? `${nationalityToFlag(winner.nationality)} ` : ""}{winner.dojoName}
        </p>
      )}

      {/* Reason */}
      <p style={{
        color: "#FFD700", fontSize: "clamp(14px,2vw,24px)", fontWeight: 700,
        letterSpacing: "0.08em", margin: "0 0 20px",
        background: "rgba(255,215,0,0.1)", padding: "8px 24px", borderRadius: "8px",
        border: "1px solid rgba(255,215,0,0.3)",
      }}>
        {REASON_LABELS[reason] ?? reason}
      </p>

      {/* Final scores */}
      {match && (
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {[
            { label: "AO", score: match.totals.total1, isWinner: winnerSide === "AO" },
            { label: "AKA", score: match.totals.total2, isWinner: winnerSide === "AKA" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <p style={{ color: s.isWinner ? "#FFD700" : "rgba(255,255,255,0.3)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em", margin: "0 0 4px" }}>{s.label}</p>
              <p style={{ color: s.isWinner ? "white" : "rgba(255,255,255,0.4)", fontSize: "clamp(28px,4vw,52px)", fontWeight: 900, margin: 0, fontVariantNumeric: "tabular-nums" }}>{s.score}</p>
            </div>
          ))}
        </div>
      )}

      {/* Counter since win */}
      <p style={{ position: "absolute", bottom: "20px", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>
        {elapsed}s
      </p>

      <style>{`
        @keyframes ring-pulse { 0%,100%{opacity:0.6;transform:translate(-50%,-50%) scale(1)} 50%{opacity:0.3;transform:translate(-50%,-50%) scale(1.05)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
      `}</style>
    </div>
  );
}

/* ── Pantalla de Próximo Combate ─────────────────────────── */
function NextPreviewScreen({ tatami, tournament }: {
  tatami: DisplayData["tatami"];
  tournament: DisplayData["tournament"];
}) {
  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "#080C14", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "32px" }}>
        <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: tatami.color, boxShadow: `0 0 10px ${tatami.color}` }}/>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "18px", margin: 0 }}>{tatami.name} · {tournament.name}</p>
      </div>
      <p style={{
        color: "white", fontSize: "clamp(28px,5vw,64px)", fontWeight: 900,
        letterSpacing: "0.15em", margin: 0, textAlign: "center",
      }}>
        ⏭ PRÓXIMO COMBATE
      </p>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "clamp(14px,2vw,22px)", marginTop: "16px" }}>
        Preparando el siguiente enfrentamiento...
      </p>
    </div>
  );
}

/* ── Componente principal ───────────────────────────────── */
export default function TatamiDisplayPage() {
  const { tatamiId } = useParams<{ id: string; tatamiId: string }>();
  const [data, setData] = useState<DisplayData | null>(null);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/public/tatami-display/${tatamiId}`);
      if (r.ok) setData(await r.json());
    } catch { /* silent */ }
  }, [tatamiId]);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, 1000); // 1 segundo para respuesta rápida
    return () => clearInterval(iv);
  }, [poll]);

  if (!data) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080C14" }}>
        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "24px" }}>Conectando...</p>
      </div>
    );
  }

  const { tatami, tournament, match } = data;
  const displayState = tatami.matchDisplayState ?? "idle";
  const inReview  = match?.reviewStatus && match.reviewStatus !== "none" && match.reviewStatus !== "confirmed" && match.reviewStatus !== "reversed";
  const inHantei  = match?.hanteiStatus === "voting";
  const hanteiDone = match?.hanteiStatus === "decided";

  // ── Máquina de estados del display ───────────────────────
  if (displayState === "winner" && match) {
    return <WinnerScreen match={match} tatami={tatami} />;
  }

  if (displayState === "next_preview") {
    return <NextPreviewScreen tatami={tatami} tournament={tournament} />;
  }

  if (!match || displayState === "idle") {
    return <WaitingScreen tatami={tatami} tournament={tournament} />;
  }

  // displayState === "active" (o cualquier otro valor desconocido)
  // Pantalla especial de Hantei decidido (primeros 8s)
  if (hanteiDone && match.hanteiWinnerId) {
    const winnerSide = match.hanteiWinnerId === match.participant1?.id ? "AO" : "AKA";
    const winner     = winnerSide === "AO" ? match.participant1 : match.participant2;
    const belt       = winner?.belt ? (BELT[winner.belt] ?? "#FFD700") : "#FFD700";
    return (
      <div style={{ height: "100vh", background: "#080C14", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }}>
        <p style={{ color: "#F59E0B", fontSize: "clamp(24px,4vw,52px)", fontWeight: 900, letterSpacing: "0.2em", margin: 0 }}>⚖️ HANTEI</p>
        <p style={{ color: winnerSide === "AO" ? "#60A5FA" : "#F87171", fontSize: "clamp(20px,3.5vw,44px)", fontWeight: 900, margin: 0 }}>
          {winnerSide} GANA POR HANTEI
        </p>
        {winner?.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={winner.photo} alt="" style={{ width: "clamp(100px,12vw,180px)", height: "clamp(100px,12vw,180px)", borderRadius: "50%", objectFit: "cover", border: `5px solid ${belt}` }} />
        )}
        <p style={{ color: "white", fontSize: "clamp(22px,3vw,40px)", fontWeight: 900 }}>{winner?.fullName ?? "—"}</p>
        {winner?.dojoName && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "clamp(14px,2vw,24px)" }}>{winner.dojoName}</p>}
        {/* Círculos de votos */}
        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          {[...Array(match.hanteiVotesAo)].map((_, i)  => <div key={`ao${i}`}  style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#1E3A8A", border: "2px solid #60A5FA" }} />)}
          {[...Array(match.hanteiVotesAka)].map((_, i) => <div key={`aka${i}`} style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#7F1D1D", border: "2px solid #F87171" }} />)}
        </div>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "16px" }}>
          AO: {match.hanteiVotesAo}  —  AKA: {match.hanteiVotesAka}
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {inReview && <VideoReviewBanner requestedBy={match.reviewRequestedBy} />}
      {inHantei && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 60,
          background: "rgba(17,24,39,0.95)", padding: "20px 40px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "20px",
          animation: "fadeIn 0.3s ease",
        }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#F59E0B", fontSize: "clamp(24px,4vw,48px)", fontWeight: 900, letterSpacing: "0.2em", margin: 0, textShadow: "0 0 30px rgba(245,158,11,0.6)" }}>
              ⚖️  H A N T E I
            </p>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "clamp(13px,1.8vw,20px)", margin: "6px 0 0", letterSpacing: "0.08em" }}>
              Panel deliberando su decisión · Empate {match.totals.total1}–{match.totals.total2}
            </p>
          </div>
        </div>
      )}
      {match.isKata
        ? <KataScreen match={match} tatami={tatami} />
        : <KumiteScreen match={match} tatami={tatami} matchStartedAt={tatami.matchStartedAt} />
      }
    </div>
  );
}
