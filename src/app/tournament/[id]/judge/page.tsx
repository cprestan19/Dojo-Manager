"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Plus, Minus, RotateCcw, Check, AlertTriangle, Trophy } from "lucide-react";

interface Judge    { id: string; name: string; role: string; tatamiId: string | null }
interface Tatami   { id: string; name: string; color: string }
interface Participant { id: string; fullName: string; beltColor: string | null }
interface Match {
  id: string; round: number; matchNumber: number;
  participant1Id: string | null; participant2Id: string | null;
  score1: number | null; score2: number | null;
  participant1: Participant | null; participant2: Participant | null;
  bracketName: string; bracketType: string;
  senshu?: string | null; // participantId del primer anotador
}

const PRIMARY = "#C0392B";

/* ── Botón de puntuación grande ── */
function ScoreBtn({ label, value, color, onAdd, onSub }: {
  label: string; value: number; color: string;
  onAdd: () => void; onSub: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</p>
      <div className="flex items-center gap-3">
        <button onPointerDown={onSub}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white active:scale-95 transition-transform"
          style={{ background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.15)" }}>
          <Minus size={20}/>
        </button>
        <div className="min-w-[72px] text-center">
          <span className="font-black text-white" style={{ fontSize: "56px", lineHeight: 1, color }}>{value}</span>
        </div>
        <button onPointerDown={onAdd}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white active:scale-95 transition-transform"
          style={{ background: color, border: `1.5px solid ${color}` }}>
          <Plus size={20}/>
        </button>
      </div>
    </div>
  );
}

/* ── Botón de punto karate (Ippon / Waza-ari / Yuko) ── */
function KarateBtn({ label, pts, color, onPress }: { label: string; pts: number; color: string; onPress: () => void }) {
  return (
    <button onPointerDown={onPress}
      className="flex-1 py-4 rounded-2xl text-white font-black text-sm active:scale-95 transition-transform"
      style={{ background: color }}>
      {label}<br/>
      <span style={{ fontSize: "11px", fontWeight: 500, opacity: 0.8 }}>+{pts} pts</span>
    </button>
  );
}

export default function JudgePage() {
  const { id }       = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const judgeIdParam = searchParams.get("judge");

  // Estado de selección
  const [judges,      setJudges]      = useState<Judge[]>([]);
  const [tatamis,     setTatamis]     = useState<Tatami[]>([]);
  const [selectedJudge, setSelectedJudge] = useState<Judge | null>(null);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState("");

  // Video Review
  const [videoReviewEnabled, setVideoReviewEnabled] = useState(false);
  const [reviewStatus,       setReviewStatus]       = useState("none");
  const [reviewPin,          setReviewPin]          = useState("");
  const [requestingReview,   setRequestingReview]   = useState(false);

  // Hantei
  const [hanteiStatus,   setHanteiStatus]   = useState("none");
  const [hanteiVotesAo,  setHanteiVotesAo]  = useState(0);
  const [hanteiVotesAka, setHanteiVotesAka] = useState(0);
  const [hanteiVoted,    setHanteiVoted]    = useState<"ao" | "aka" | null>(null);
  const [hanteiWinnerId, setHanteiWinnerId] = useState<string | null>(null);
  const [hanteiJudgesVoted, setHanteiJudgesVoted] = useState(0);

  // Kumite: técnicas individuales
  const [ippon1,   setIppon1]   = useState(0);
  const [wazaari1, setWazaari1] = useState(0);
  const [yuko1,    setYuko1]    = useState(0);
  const [ippon2,   setIppon2]   = useState(0);
  const [wazaari2, setWazaari2] = useState(0);
  const [yuko2,    setYuko2]    = useState(0);
  const [chukoku1, setChukoku1] = useState(0);
  const [hansoku1, setHansoku1] = useState(0);
  const [chukoku2, setChukoku2] = useState(0);
  const [hansoku2, setHansoku2] = useState(0);
  const [lastTech1,setLastTech1]= useState<string>("");
  const [lastTech2,setLastTech2]= useState<string>("");

  const score1 = ippon1*3 + wazaari1*2 + yuko1;
  const score2 = ippon2*3 + wazaari2*2 + yuko2;

  // Kata
  const [kata1,    setKata1]    = useState("");
  const [kata2,    setKata2]    = useState("");

  function resetAll() {
    setIppon1(0); setWazaari1(0); setYuko1(0);
    setIppon2(0); setWazaari2(0); setYuko2(0);
    setChukoku1(0); setHansoku1(0);
    setChukoku2(0); setHansoku2(0);
    setLastTech1(""); setLastTech2("");
    setKata1(""); setKata2("");
  }

  // Cargar jueces y tatamis desde endpoint público (sin login)
  useEffect(() => {
    fetch(`/api/public/judge-app/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setJudges(data.judges ?? []);
          setTatamis(data.tatamis ?? []);
        }
      }).catch(() => {});
  }, [id]);

  // Si viene judgeId en la URL, auto-seleccionar
  useEffect(() => {
    if (judgeIdParam && judges.length > 0) {
      const j = judges.find(j => j.id === judgeIdParam);
      if (j) setSelectedJudge(j);
    }
  }, [judgeIdParam, judges]);

  // Ref para detectar cambios de match (evitar recargar scores en cada poll)
  const lastMatchIdRef = useRef<string | null>(null);

  // Polling del match activo — liviano: solo una llamada por ciclo
  const pollMatch = useCallback(async () => {
    if (!selectedJudge?.tatamiId) return;
    try {
      const r = await fetch(`/api/public/tatami-display/${selectedJudge.tatamiId}`);
      if (!r.ok) return;
      const display = await r.json();

      if (!display.match) {
        lastMatchIdRef.current = null;
        setActiveMatch(null);
        return;
      }

      // Actualizar estado de video review y enable flag
      setVideoReviewEnabled(display.tatami?.videoReviewEnabled ?? false);
      setReviewStatus(display.match.reviewStatus ?? "none");

      // Polling del Hantei si el match está en votación
      if (display.match.id && selectedJudge) {
        fetch(`/api/tournaments/${id}/matches/${display.match.id}/hantei`)
          .then(r => r.ok ? r.json() : null)
          .then(h => {
            if (!h) return;
            setHanteiStatus(h.hanteiStatus ?? "none");
            setHanteiVotesAo(h.votesAo ?? 0);
            setHanteiVotesAka(h.votesAka ?? 0);
            setHanteiWinnerId(h.winnerId ?? null);
            setHanteiJudgesVoted(h.judgesVoted ?? 0);
          })
          .catch(() => null);
      }

      const matchData: Match = {
        id:             display.match.id,
        round:          display.match.round,
        matchNumber:    display.match.matchNumber,
        bracketName:    display.match.bracketName,
        bracketType:    display.match.bracketType,
        participant1Id: display.match.participant1?.id ?? null,
        participant2Id: display.match.participant2?.id ?? null,
        score1:         display.match.score1 ?? null,
        score2:         display.match.score2 ?? null,
        participant1:   display.match.participant1 ? { id: display.match.participant1.id, fullName: display.match.participant1.fullName, beltColor: display.match.participant1.belt ?? null } : null,
        participant2:   display.match.participant2 ? { id: display.match.participant2.id, fullName: display.match.participant2.fullName, beltColor: display.match.participant2.belt ?? null } : null,
        senshu:         display.match.senshu ?? null,
      };
      setActiveMatch(matchData);

      // Cargar scores del juez SOLO cuando cambia el match (no en cada poll)
      if (display.match.id !== lastMatchIdRef.current) {
        lastMatchIdRef.current = display.match.id;
        const sr = await fetch(`/api/tournaments/${id}/matches/${display.match.id}/judge-scores`);
        if (sr.ok) {
          const { scores } = await sr.json();
          const mine = scores.find((s: { judgeId: string }) => s.judgeId === selectedJudge.id);
          if (mine) {
            setIppon1(mine.ippon1   ?? 0); setWazaari1(mine.wazaari1 ?? 0); setYuko1(mine.yuko1 ?? 0);
            setIppon2(mine.ippon2   ?? 0); setWazaari2(mine.wazaari2 ?? 0); setYuko2(mine.yuko2 ?? 0);
            setChukoku1(mine.chukoku1 ?? 0); setHansoku1(mine.hansoku1 ?? 0);
            setChukoku2(mine.chukoku2 ?? 0); setHansoku2(mine.hansoku2 ?? 0);
            setKata1(mine.kataScore1 != null ? String(mine.kataScore1) : "");
            setKata2(mine.kataScore2 != null ? String(mine.kataScore2) : "");
          } else {
            resetAll(); // nuevo match → limpiar scores anteriores
          }
        }
      }
    } catch { /* silent */ }
  }, [id, selectedJudge]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedJudge) return;
    pollMatch();
    const iv = setInterval(pollMatch, 1000); // 1 segundo — mismo ritmo que la TV
    return () => clearInterval(iv);
  }, [selectedJudge, pollMatch]);

  // ── Auto-pausa al marcar técnica ─────────────────────────────────────────────
  const pauseTimerOnTech = useCallback(() => {
    if (!selectedJudge?.tatamiId) return;
    // Fire-and-forget — SenchoControls lo reflejará en el próximo poll
    fetch(`/api/tournaments/${id}/tatami/${selectedJudge.tatamiId}/timer`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body:   JSON.stringify({ action: "pause" }),
    }).catch(() => {});
  }, [id, selectedJudge]);

  // ── Asignar / limpiar Senshu ─────────────────────────────────────────────────
  async function castHanteiVote(vote: "ao" | "aka") {
    if (!activeMatch || !selectedJudge) return;
    const r = await fetch(`/api/tournaments/${id}/matches/${activeMatch.id}/hantei/vote`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ judgeId: selectedJudge.id, vote }),
    });
    if (r.ok) {
      const d = await r.json();
      setHanteiVoted(vote);
      setHanteiVotesAo(d.votesAo);
      setHanteiVotesAka(d.votesAka);
      setHanteiJudgesVoted(d.totalVoted);
    }
  }

  async function requestVideoReview(requestedBy: "ao" | "aka" | "referee") {
    if (!activeMatch || !reviewPin) return;
    setRequestingReview(true);
    try {
      const r = await fetch(`/api/tournaments/${id}/matches/${activeMatch.id}/video-review`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pin: reviewPin, requestedBy }),
      });
      const d = await r.json();
      if (!r.ok && r.status !== 409) {
        setError(d.error ?? "Error al solicitar review");
      }
      // Si 409 = review ya activo, igual es OK
    } finally { setRequestingReview(false); }
  }

  async function setSenshu(participantId: string | null) {
    if (!activeMatch) return;
    await fetch("/api/public/match-senshu", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body:   JSON.stringify({ matchId: activeMatch.id, participantId }),
    });
    // El próximo poll actualizará el senshu en activeMatch
  }

  // ── Auto-submit con useEffect ────────────────────────────────────────────────
  // useEffect corre DESPUÉS del render con los valores ya actualizados.
  // Esto evita el problema de stale closures que tenía el enfoque con setTimeout.
  const autoSubmitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeMatch || !selectedJudge || activeMatch.bracketType === "kata") return;
    if (autoSubmitTimer.current) clearTimeout(autoSubmitTimer.current);
    autoSubmitTimer.current = setTimeout(() => {
      // Esta función se define aquí para capturar los valores actuales del render
      const body = {
        judgeId:        selectedJudge.id,
        scoreType:      "kumite",
        ippon1, wazaari1, yuko1,
        ippon2, wazaari2, yuko2,
        chukoku1, hansoku1, chukoku2, hansoku2,
        score1:         ippon1*3 + wazaari1*2 + yuko1,
        score2:         ippon2*3 + wazaari2*2 + yuko2,
        penalty1:       chukoku1 + hansoku1,
        penalty2:       chukoku2 + hansoku2,
        lastTechnique1: lastTech1 || null,
        lastTechnique2: lastTech2 || null,
      };
      fetch(`/api/tournaments/${id}/matches/${activeMatch.id}/judge-scores`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body:   JSON.stringify(body),
      }).then(r => { if (r.ok) setSaved(true); setTimeout(() => setSaved(false), 2000); });
    }, 350);
  }, [ippon1, wazaari1, yuko1, ippon2, wazaari2, yuko2,
      chukoku1, hansoku1, chukoku2, hansoku2, lastTech1, lastTech2]); // eslint-disable-line react-hooks/exhaustive-deps

  function markTech(setter: (v: (n: number) => number) => void, lastTechSetter: (v: string) => void, tech: string) {
    setter(v => v + 1);
    lastTechSetter(tech);
    pauseTimerOnTech(); // pausa el cronómetro automáticamente al marcar técnica
  }

  async function submitScoreCore() {
    if (!activeMatch || !selectedJudge) return;
    setLoading(true); setSaved(false); setError("");
    try {
      const isKata = activeMatch.bracketType === "kata";
      const body: Record<string, unknown> = {
        judgeId:   selectedJudge.id,
        scoreType: isKata ? "kata" : "kumite",
      };
      if (isKata) {
        body.kataScore1 = parseFloat(kata1) || 0;
        body.kataScore2 = parseFloat(kata2) || 0;
      } else {
        body.ippon1   = ippon1;   body.wazaari1 = wazaari1; body.yuko1 = yuko1;
        body.ippon2   = ippon2;   body.wazaari2 = wazaari2; body.yuko2 = yuko2;
        body.chukoku1 = chukoku1; body.hansoku1 = hansoku1;
        body.chukoku2 = chukoku2; body.hansoku2 = hansoku2;
        body.score1   = score1;   body.score2   = score2;
        body.penalty1 = chukoku1 + hansoku1;
        body.penalty2 = chukoku2 + hansoku2;
        body.lastTechnique1 = lastTech1 || null;
        body.lastTechnique2 = lastTech2 || null;
      }

      const r = await fetch(`/api/tournaments/${id}/matches/${activeMatch.id}/judge-scores`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
      else { const d = await r.json(); setError(d.error ?? "Error al guardar"); }
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }

  const isKata   = activeMatch?.bracketType === "kata";
  const myTatami = tatamis.find(t => t.id === selectedJudge?.tatamiId);

  // Estado para el flujo de categoría
  const [categoryConfirmed, setCategoryConfirmed] = useState(false);

  // Cuando cambia el match activo, si el juez ya confirmó categoría y el match cambió de bracket → resetear
  const lastBracketIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeMatch) return;
    // Extraemos bracketId del match a través del bracketName como identificador indirecto
    const bracketKey = `${activeMatch.bracketName}__${activeMatch.bracketType}`;
    if (lastBracketIdRef.current && lastBracketIdRef.current !== bracketKey) {
      // Cambió de categoría → volver a la pantalla de categoría
      setCategoryConfirmed(false);
    }
    lastBracketIdRef.current = bracketKey;
  }, [activeMatch]);

  /* ── Pantalla de selección de juez ── */
  if (!selectedJudge) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#080C14", fontFamily: "'Nunito',sans-serif" }}>
        <div className="flex items-center gap-2 px-4 py-4 border-b border-white/10" style={{ background: "#111827" }}>
          <Trophy size={20} style={{ color: PRIMARY }}/>
          <span className="font-black text-white text-lg">App del Juez</span>
        </div>
        <div className="flex-1 p-4 space-y-4">
          <p className="text-white/50 text-sm text-center mt-4">Selecciona tu nombre para comenzar</p>
          {tatamis.map(tatami => {
            const tJudges = judges.filter(j => j.tatamiId === tatami.id);
            if (tJudges.length === 0) return null;
            return (
              <div key={tatami.id}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: tatami.color }}/>
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest">{tatami.name}</p>
                </div>
                <div className="space-y-2">
                  {tJudges.map(j => (
                    <button key={j.id} onClick={() => setSelectedJudge(j)}
                      className="w-full py-4 px-5 rounded-2xl text-left flex items-center justify-between border border-white/5 active:scale-[0.98] transition-transform"
                      style={{ background: "#111827" }}>
                      <div>
                        <p className="text-white font-bold">{j.name}</p>
                        <p className="text-white/40 text-xs capitalize">{j.role}</p>
                      </div>
                      <span className="text-white/30">→</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {judges.filter(j => !j.tatamiId).length > 0 && (
            <div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 px-1">Sin tatami asignado</p>
              {judges.filter(j => !j.tatamiId).map(j => (
                <button key={j.id} onClick={() => setSelectedJudge(j)}
                  className="w-full py-4 px-5 rounded-2xl text-left border border-white/5 mb-2"
                  style={{ background: "#111827" }}>
                  <p className="text-white font-bold">{j.name}</p>
                  <p className="text-white/40 text-xs capitalize">{j.role}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Pantalla de categoría en curso ── */
  if (!categoryConfirmed) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#080C14", fontFamily: "'Nunito',sans-serif" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10" style={{ background: "#111827" }}>
          <div>
            <p className="text-white font-black text-base">{selectedJudge.name}</p>
            <div className="flex items-center gap-1.5">
              {myTatami && <div className="w-2.5 h-2.5 rounded-full" style={{ background: myTatami.color }}/>}
              <p className="text-white/40 text-xs">{myTatami?.name ?? "Sin tatami"} · {selectedJudge.role}</p>
            </div>
          </div>
          <button onClick={() => setSelectedJudge(null)} className="text-xs text-white/30 hover:text-white transition-colors px-2 py-1">
            Cambiar
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">
          {!activeMatch ? (
            /* Sin combate activo */
            <>
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.08)" }}>
                <span style={{ fontSize: "36px" }}>⏳</span>
              </div>
              <div className="text-center space-y-2">
                <p className="text-white font-black text-xl">Esperando categoría</p>
                <p className="text-white/40 text-sm">El coordinador activará el próximo combate en tu tatami</p>
              </div>
              <div className="w-full rounded-2xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Tu tatami</p>
                <div className="flex items-center gap-2">
                  {myTatami && <div className="w-4 h-4 rounded-full shrink-0" style={{ background: myTatami.color }}/>}
                  <p className="text-white font-bold">{myTatami?.name ?? "—"}</p>
                </div>
              </div>
            </>
          ) : (
            /* Match activo: mostrar categoría */
            <>
              <div className="text-center space-y-1">
                <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Categoría activa</p>
                <p className="text-white font-black text-2xl leading-tight">{activeMatch.bracketName}</p>
                {activeMatch.bracketType === "kata" && (
                  <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.2)", color: "#A78BFA" }}>KATA</span>
                )}
              </div>

              <div className="w-full rounded-2xl p-4 grid grid-cols-2 gap-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-center">
                  <p className="text-white/40 text-xs uppercase tracking-widest">Ronda</p>
                  <p className="text-white font-black text-3xl">{activeMatch.round}</p>
                </div>
                <div className="text-center">
                  <p className="text-white/40 text-xs uppercase tracking-widest">Match</p>
                  <p className="text-white font-black text-3xl">#{activeMatch.matchNumber}</p>
                </div>
              </div>

              {/* Competidores */}
              <div className="w-full space-y-2">
                {[
                  { label: "AO", name: activeMatch.participant1?.fullName, color: "rgba(30,58,138,0.5)" },
                  { label: "AKA", name: activeMatch.participant2?.fullName, color: "rgba(127,29,29,0.5)" },
                ].map(c => (
                  <div key={c.label} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: c.color }}>
                    <span className="text-xs font-black text-white/50 w-8">{c.label}</span>
                    <p className="text-white font-bold truncate">{c.name ?? "—"}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setCategoryConfirmed(true)}
                className="w-full py-5 rounded-2xl font-black text-white text-xl active:scale-[0.98] transition-transform"
                style={{ background: PRIMARY, boxShadow: `0 4px 24px ${PRIMARY}55` }}>
                Comenzar a puntuar →
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── Pantalla de Hantei — votación ── */
  if (activeMatch && hanteiStatus === "voting") {
    const p1 = activeMatch.participant1;
    const p2 = activeMatch.participant2;
    const totalJudges = 3; // default mínimo; ajustar según el torneo
    const pending = totalJudges - hanteiJudgesVoted;

    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#080C14", fontFamily: "'Nunito',sans-serif" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10" style={{ background: "#111827" }}>
          <div>
            <p className="text-white font-black text-base">{selectedJudge.name}</p>
            <p className="text-white/40 text-xs">{myTatami?.name ?? "Sin tatami"} · {selectedJudge.role}</p>
          </div>
          <span className="text-xs font-black px-3 py-1 rounded-full" style={{ background: "rgba(245,158,11,0.2)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.4)" }}>
            ⚖️ HANTEI
          </span>
        </div>

        <div className="flex-1 flex flex-col p-5 gap-5">
          {/* Título */}
          <div className="text-center">
            <p style={{ fontSize: "clamp(28px,6vw,52px)", fontWeight: 900, color: "#F59E0B", letterSpacing: "0.2em", margin: 0 }}>
              ⚖️ HANTEI
            </p>
            <p className="text-white/50 text-sm mt-1">
              {activeMatch.bracketName} · R{activeMatch.round} #{activeMatch.matchNumber}
            </p>
            <p className="text-white/30 text-xs mt-1">
              Evalúa: actitud de ataque · técnica · dominio del combate
            </p>
          </div>

          {hanteiVoted ? (
            /* Ya votó — mostrar confirmación y conteo */
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: hanteiVoted === "ao" ? "rgba(30,58,138,0.5)" : "rgba(127,29,29,0.5)", border: `3px solid ${hanteiVoted === "ao" ? "#60A5FA" : "#F87171"}` }}>
                <span style={{ fontSize: "32px", fontWeight: 900, color: "white" }}>
                  {hanteiVoted === "ao" ? "AO" : "AKA"}
                </span>
              </div>
              <p className="text-white font-bold text-lg">
                ✅ Votaste por <span style={{ color: hanteiVoted === "ao" ? "#60A5FA" : "#F87171" }}>{hanteiVoted.toUpperCase()}</span>
              </p>
              <div className="rounded-2xl p-4 w-full text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Votos recibidos</p>
                <div className="flex items-center justify-center gap-6">
                  <div>
                    <p className="text-blue-400 font-black text-3xl">{hanteiVotesAo}</p>
                    <p className="text-white/40 text-xs">AO</p>
                  </div>
                  <p className="text-white/30 text-xl">—</p>
                  <div>
                    <p className="text-red-400 font-black text-3xl">{hanteiVotesAka}</p>
                    <p className="text-white/40 text-xs">AKA</p>
                  </div>
                </div>
                {pending > 0 && (
                  <p className="text-white/30 text-xs mt-3">Pendientes: {pending} juez{pending !== 1 ? "es" : ""}</p>
                )}
              </div>
            </div>
          ) : (
            /* Votar */
            <div className="flex-1 flex flex-col gap-4">
              {/* Botones de voto */}
              <div className="grid grid-cols-2 gap-3 flex-1">
                {[
                  { side: "ao" as const, label: "AO", name: p1?.fullName, color: "rgba(30,58,138,0.85)", border: "#60A5FA", text: "#93C5FD" },
                  { side: "aka" as const, label: "AKA", name: p2?.fullName, color: "rgba(127,29,29,0.85)", border: "#F87171", text: "#FCA5A5" },
                ].map(opt => (
                  <button
                    key={opt.side}
                    onClick={() => castHanteiVote(opt.side)}
                    className="rounded-3xl active:scale-[0.97] transition-transform flex flex-col items-center justify-center gap-3 py-8"
                    style={{ background: opt.color, border: `3px solid ${opt.border}`, minHeight: "200px" }}
                  >
                    <span style={{ fontSize: "20px", fontWeight: 900, color: opt.text, letterSpacing: "0.15em" }}>
                      {opt.label}
                    </span>
                    <span className="text-white font-bold text-center px-3" style={{ fontSize: "clamp(14px,3vw,18px)", lineHeight: 1.3 }}>
                      {opt.name ?? "—"}
                    </span>
                    <span className="text-white/50 text-xs">Tocar para votar</span>
                  </button>
                ))}
              </div>
              <p className="text-white/25 text-xs text-center">⚠️ Tu voto es definitivo — toca solo cuando estés seguro</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Pantalla de Hantei — resultado ── */
  if (activeMatch && hanteiStatus === "decided" && hanteiWinnerId) {
    const winnerSide = hanteiWinnerId === activeMatch.participant1Id ? "AO" : "AKA";
    const winnerName = winnerSide === "AO" ? activeMatch.participant1?.fullName : activeMatch.participant2?.fullName;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6" style={{ background: "#080C14" }}>
        <p style={{ fontSize: "48px", lineHeight: 1 }}>⚖️</p>
        <p style={{ color: "#F59E0B", fontSize: "clamp(24px,5vw,40px)", fontWeight: 900, letterSpacing: "0.2em", margin: 0 }}>
          HANTEI
        </p>
        <p style={{ color: winnerSide === "AO" ? "#60A5FA" : "#F87171", fontSize: "clamp(20px,4vw,32px)", fontWeight: 900 }}>
          {winnerSide} GANA
        </p>
        <p className="text-white font-bold text-xl text-center">{winnerName ?? "—"}</p>
        <div className="flex items-center gap-4">
          {[...Array(hanteiVotesAo)].map((_, i) => (
            <div key={`ao${i}`} className="w-8 h-8 rounded-full" style={{ background: "#1E3A8A" }} />
          ))}
          {[...Array(hanteiVotesAka)].map((_, i) => (
            <div key={`aka${i}`} className="w-8 h-8 rounded-full" style={{ background: "#7F1D1D" }} />
          ))}
        </div>
        <p className="text-white/40 text-sm">AO: {hanteiVotesAo} — AKA: {hanteiVotesAka}</p>
      </div>
    );
  }

  /* ── App principal de puntuación ── */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080C14", fontFamily: "'Nunito',sans-serif" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10" style={{ background: "#111827" }}>
        <div>
          <p className="text-white font-black text-base">{selectedJudge.name}</p>
          <div className="flex items-center gap-1.5">
            {myTatami && <div className="w-2.5 h-2.5 rounded-full" style={{ background: myTatami.color }}/>}
            <p className="text-white/40 text-xs">
              {activeMatch ? `${activeMatch.bracketName} · R${activeMatch.round} #${activeMatch.matchNumber}` : (myTatami?.name ?? "Sin tatami")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCategoryConfirmed(false)} className="text-xs text-white/30 hover:text-white transition-colors px-2 py-1">
            ← Cat.
          </button>
          <button onClick={() => setSelectedJudge(null)} className="text-xs text-white/30 hover:text-white transition-colors px-2 py-1">
            Cambiar
          </button>
        </div>
      </div>

      {/* Sencho + controles — siempre visible */}
      <SenchoControls
        tatamiId={selectedJudge?.tatamiId ?? null}
        tournamentId={id}
        matchId={activeMatch?.id ?? null}
        onFinished={() => {
          // Vibrar si el dispositivo lo soporta
          if ("vibrate" in navigator) navigator.vibrate([300, 100, 300, 100, 300]);
        }}
      />

      {/* Sin match activo */}
      {!activeMatch && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
            <Trophy size={28} style={{ color: PRIMARY }}/>
          </div>
          <p className="text-white font-semibold">Esperando combate...</p>
          <p className="text-white/40 text-sm">El coordinador asignará el siguiente match en tu tatami</p>
        </div>
      )}

      {/* Match activo */}
      {activeMatch && (() => {
        // Detectar Senshu perdido (≥5 chui del que tiene senshu)
        const p1HasSenshu = activeMatch.senshu && activeMatch.senshu === activeMatch.participant1Id;
        const p2HasSenshu = activeMatch.senshu && activeMatch.senshu === activeMatch.participant2Id;
        const p1Penalties = chukoku1 + hansoku1;
        const p2Penalties = chukoku2 + hansoku2;
        const senshuPerdido = (p1HasSenshu && p1Penalties >= 5) || (p2HasSenshu && p2Penalties >= 5);
        const senshuPerdidoNombre = senshuPerdido
          ? (p1HasSenshu ? activeMatch.participant1?.fullName : activeMatch.participant2?.fullName) ?? ""
          : null;

        return (
        <div className="flex-1 flex flex-col p-4 gap-5">

          {/* Alert SENSHU PERDIDO */}
          {senshuPerdido && (
            <div className="rounded-2xl p-4 text-center animate-pulse"
              style={{ background: "rgba(239,68,68,0.2)", border: "2px solid rgba(239,68,68,0.5)" }}>
              <p className="text-2xl font-black text-red-400 tracking-widest">先取 SENSHU PERDIDO</p>
              <p className="text-sm text-red-300/70 mt-1">{senshuPerdidoNombre} — 5 faltas acumuladas</p>
            </div>
          )}

          {/* Info del match + Sencho */}
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-xs text-white/40 font-bold uppercase tracking-widest">
              {activeMatch.bracketName} · R{activeMatch.round} · M{activeMatch.matchNumber}
            </p>
            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="text-white font-black text-base flex-1">{activeMatch.participant1?.fullName ?? "—"}</p>
              <span className="text-white/30 text-sm font-bold">vs</span>
              <p className="text-white font-black text-base flex-1 text-right">{activeMatch.participant2?.fullName ?? "—"}</p>
            </div>
          </div>

          {/* Puntuación KUMITE */}
          {!isKata && (
            <div className="space-y-4">
              {/* Score totales con Chui visible */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl p-3 text-center space-y-1" style={{ background: "rgba(30,58,138,0.5)", border: "1px solid rgba(30,58,138,0.6)" }}>
                  <p className="text-xs text-white/40 font-bold">{activeMatch.participant1?.fullName?.split(" ")[0] ?? "C1"}</p>
                  <p className="font-black text-white" style={{ fontSize: "52px", lineHeight: 1 }}>{score1}</p>
                  <div className="flex justify-center gap-2">
                    {chukoku1 > 0 && <span className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.25)", color: "#FCA5A5" }}>C×{chukoku1}</span>}
                    {hansoku1 > 0 && <span className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(220,38,38,0.35)", color: "#FCA5A5" }}>H×{hansoku1}</span>}
                  </div>
                </div>
                <div className="rounded-2xl p-3 text-center space-y-1" style={{ background: `rgba(192,57,43,0.5)`, border: `1px solid rgba(192,57,43,0.6)` }}>
                  <p className="text-xs text-white/40 font-bold">{activeMatch.participant2?.fullName?.split(" ")[0] ?? "C2"}</p>
                  <p className="font-black text-white" style={{ fontSize: "52px", lineHeight: 1 }}>{score2}</p>
                  <div className="flex justify-center gap-2">
                    {chukoku2 > 0 && <span className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.25)", color: "#FCA5A5" }}>C×{chukoku2}</span>}
                    {hansoku2 > 0 && <span className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(220,38,38,0.35)", color: "#FCA5A5" }}>H×{hansoku2}</span>}
                  </div>
                </div>
              </div>

              {/* Botones técnicas C1 */}
              <div>
                <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-2">{activeMatch.participant1?.fullName?.split(" ")[0] ?? "Competidor 1"}</p>
                <div className="flex gap-2">
                  <KarateBtn label="Ippon"    pts={3} color="#065F46" onPress={() => markTech(setIppon1,   setLastTech1, "ippon"  )} />
                  <KarateBtn label="Waza-ari" pts={2} color="#1E3A8A" onPress={() => markTech(setWazaari1, setLastTech1, "wazaari")} />
                  <KarateBtn label="Yuko"     pts={1} color="#1E40AF" onPress={() => markTech(setYuko1,    setLastTech1, "yuko"   )} />
                </div>
                {(ippon1+wazaari1+yuko1 > 0) && (
                  <p className="text-xs text-white/40 mt-1 text-center">I:{ippon1} W:{wazaari1} Y:{yuko1}</p>
                )}
              </div>

              {/* Botones técnicas C2 */}
              <div>
                <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-2">{activeMatch.participant2?.fullName?.split(" ")[0] ?? "Competidor 2"}</p>
                <div className="flex gap-2">
                  <KarateBtn label="Ippon"    pts={3} color="#7F1D1D" onPress={() => markTech(setIppon2,   setLastTech2, "ippon"  )} />
                  <KarateBtn label="Waza-ari" pts={2} color="#991B1B" onPress={() => markTech(setWazaari2, setLastTech2, "wazaari")} />
                  <KarateBtn label="Yuko"     pts={1} color={PRIMARY}  onPress={() => markTech(setYuko2,    setLastTech2, "yuko"   )} />
                </div>
                {(ippon2+wazaari2+yuko2 > 0) && (
                  <p className="text-xs text-white/40 mt-1 text-center">I:{ippon2} W:{wazaari2} Y:{yuko2}</p>
                )}
              </div>

              {/* Penalizaciones */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: `Penaliz. ${activeMatch.participant1?.fullName?.split(" ")[0] ?? "C1"}`,
                    chukoku: chukoku1, setChukoku: setChukoku1,
                    hansoku: hansoku1, setHansoku: setHansoku1,
                    setLast: setLastTech1 },
                  { label: `Penaliz. ${activeMatch.participant2?.fullName?.split(" ")[0] ?? "C2"}`,
                    chukoku: chukoku2, setChukoku: setChukoku2,
                    hansoku: hansoku2, setHansoku: setHansoku2,
                    setLast: setLastTech2 },
                ].map((p, i) => (
                  <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: "#111827" }}>
                    <p className="text-xs text-white/40 font-bold">{p.label}</p>
                    <div className="flex gap-2">
                      <button onPointerDown={() => { p.setChukoku(v => Math.min(v+1,10)); p.setLast("chukoku"); }}
                        className="flex-1 py-2 rounded-lg text-xs font-bold"
                        style={{ background: "rgba(239,68,68,0.2)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.3)" }}>
                        Chukoku {p.chukoku > 0 && `(${p.chukoku})`}
                      </button>
                      <button onPointerDown={() => { p.setHansoku(v => Math.min(v+1,5)); p.setLast("hansoku"); }}
                        className="flex-1 py-2 rounded-lg text-xs font-bold"
                        style={{ background: "rgba(220,38,38,0.3)", color: "#FCA5A5", border: "1px solid rgba(220,38,38,0.4)" }}>
                        Hansoku {p.hansoku > 0 && `(${p.hansoku})`}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Puntuación KATA */}
          {isKata && (
            <div className="space-y-4">
              <p className="text-xs text-white/40 font-bold uppercase tracking-widest text-center">
                Nota Kata (0.0 – 10.0)
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: activeMatch.participant1?.fullName?.split(" ")[0] ?? "C1", val: kata1, set: setKata1 },
                  { label: activeMatch.participant2?.fullName?.split(" ")[0] ?? "C2", val: kata2, set: setKata2 },
                ].map(({ label, val, set }, i) => (
                  <div key={i} className="rounded-2xl p-4 space-y-2" style={{ background: "#111827" }}>
                    <p className="text-xs text-white/50 font-bold">{label}</p>
                    <input
                      type="number" step="0.1" min="0" max="10"
                      value={val} onChange={e => set(e.target.value)}
                      className="w-full text-center font-black text-white bg-transparent outline-none border-b-2 border-white/20 focus:border-dojo-red pb-1"
                      style={{ fontSize: "42px" }}
                      placeholder="0.0"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset */}
          <button onClick={resetAll}
            className="flex items-center justify-center gap-2 py-2 text-sm text-white/30 hover:text-white/60 transition-colors">
            <RotateCcw size={14}/> Reiniciar marcador
          </button>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(220,38,38,0.15)", color: "#FCA5A5" }}>
              <AlertTriangle size={14}/> {error}
            </div>
          )}

          {/* ── Botones Senshu ── */}
          {!isKata && (
            <div className="space-y-2">
              <p className="text-xs text-white/40 font-bold uppercase tracking-widest text-center">先取 SENSHU</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: activeMatch.participant1?.fullName?.split(" ")[0] ?? "C1", id: activeMatch.participant1Id },
                  { label: activeMatch.participant2?.fullName?.split(" ")[0] ?? "C2", id: activeMatch.participant2Id },
                ].map((c, i) => {
                  const isCurrent = activeMatch.senshu === c.id;
                  const penalties = i === 0 ? p1Penalties : p2Penalties;
                  const lost = isCurrent && penalties >= 5;
                  return (
                    <button key={i}
                      onClick={() => setSenshu(isCurrent ? null : c.id)}
                      className="py-3 rounded-2xl text-sm font-black transition-all active:scale-95"
                      style={{
                        background: lost ? "rgba(239,68,68,0.2)" :
                                    isCurrent ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.05)",
                        border:     lost ? "2px solid rgba(239,68,68,0.5)" :
                                    isCurrent ? "2px solid rgba(245,158,11,0.6)" : "1px solid rgba(255,255,255,0.1)",
                        color:      lost ? "#FCA5A5" : isCurrent ? "#F59E0B" : "rgba(255,255,255,0.5)",
                      }}>
                      {lost ? "❌" : isCurrent ? "先取 ★" : "先取"} {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Video Review */}
          {videoReviewEnabled && (
            <div className="space-y-2 pt-1 border-t border-white/10">
              {reviewStatus !== "none" && reviewStatus !== "confirmed" && reviewStatus !== "reversed" ? (
                <div className="py-3 rounded-2xl text-center font-bold text-sm"
                  style={{ background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.5)", color: "#93C5FD" }}>
                  📹 Video Review en proceso...
                </div>
              ) : (
                <>
                  <input
                    type="password" maxLength={6} value={reviewPin}
                    onChange={e => setReviewPin(e.target.value)}
                    placeholder="PIN de acreditación"
                    className="w-full py-2 px-3 rounded-xl text-center font-mono text-white"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", fontSize: "16px", outline: "none" }}
                  />
                  <button
                    onClick={() => requestVideoReview("referee")}
                    disabled={requestingReview || !reviewPin}
                    className="w-full py-3 rounded-2xl font-black text-white text-sm active:scale-[0.98] transition-transform disabled:opacity-40"
                    style={{ background: "rgba(37,99,235,0.7)", border: "1px solid rgba(37,99,235,0.5)" }}>
                    {requestingReview ? "Solicitando..." : "📹 Solicitar Video Review"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Guardar */}
          <button onClick={submitScoreCore} disabled={loading}
            className="w-full py-5 rounded-2xl font-black text-white text-xl active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{
              background: saved ? "#065F46" : PRIMARY,
              boxShadow: `0 4px 24px ${saved ? "#065F0644" : PRIMARY + "55"}`,
            }}>
            {loading ? "Enviando..." : saved ? <><Check size={20} className="inline mr-2"/>Enviado</> : "Enviar puntuación"}
          </button>
        </div>
        );
      })()}
    </div>
  );
}

// ── Cronómetro Sencho para el app del juez ────────────────────────────────────
function SenchoTimer({ matchId, tatamiId }: { matchId: string; tatamiId: string | null }) {
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [elapsed,   setElapsed]   = useState(0);

  useEffect(() => {
    if (!tatamiId) return;
    const fetchTime = async () => {
      try {
        const r = await fetch(`/api/public/tatami-display/${tatamiId}`);
        if (r.ok) {
          const d = await r.json();
          setStartedAt(d.tatami?.matchStartedAt ?? null);
        }
      } catch { /* silent */ }
    };
    fetchTime();
    const iv = setInterval(fetchTime, 10000); // actualizar referencia cada 10s
    return () => clearInterval(iv);
  }, [tatamiId, matchId]);

  useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    const start = new Date(startedAt).getTime();
    const tick  = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [startedAt]);

  // Cuenta regresiva desde 120s
  const DURATION = 120;
  const remaining = Math.max(0, DURATION - elapsed);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <p className="font-black tabular-nums"
      style={{
        fontSize: "clamp(32px, 8vw, 52px)", fontFamily: "'Courier New', monospace", lineHeight: 1,
        color: remaining === 0 ? "#EF4444" : remaining <= 30 ? "#F59E0B" : "white",
      }}>
      {mm}:{ss}
    </p>
  );
}

// ── Sencho con controles de Pausa / Reanudar / Reset ─────────────────────────
function SenchoControls({ tatamiId, tournamentId, matchId, onFinished }: {
  tatamiId: string | null; tournamentId: string; matchId: string | null;
  onFinished?: () => void;
}) {
  const [timerData, setTimerData] = useState<{ running: boolean; base: number; startedAt: string | null }>({
    running: false, base: 0, startedAt: null,
  });
  const [elapsed,  setElapsed]  = useState(0);
  const [acting,   setActing]   = useState(false);
  const finishedRef = useRef(false);

  // Cargar estado del timer desde el tatami display
  useEffect(() => {
    if (!tatamiId) return;
    const fetch2 = async () => {
      const r = await fetch(`/api/public/tatami-display/${tatamiId}`);
      if (r.ok) {
        const d = await r.json();
        setTimerData({
          running:   d.tatami?.timerRunning   ?? false,
          base:      d.tatami?.timerBase      ?? 0,
          startedAt: d.tatami?.matchStartedAt ?? null,
        });
      }
    };
    fetch2();
    const iv = setInterval(fetch2, 1500); // 1.5s para refresco rápido
    return () => clearInterval(iv);
  }, [tatamiId, matchId]);

  // Cronómetro local
  useEffect(() => {
    if (!timerData.running || !timerData.startedAt) {
      setElapsed(timerData.base);
      return;
    }
    finishedRef.current = false;
    const start = new Date(timerData.startedAt).getTime();
    const tick  = () => {
      const e = Math.floor((Date.now() - start) / 1000);
      setElapsed(e);
      if (e >= DURATION && !finishedRef.current) {
        finishedRef.current = true;
        onFinished?.();
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [timerData]); // eslint-disable-line react-hooks/exhaustive-deps

  const DURATION  = 120;
  const remaining = Math.max(0, DURATION - elapsed);
  const finished  = remaining === 0 && elapsed > 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  async function control(action: "start" | "pause" | "reset") {
    if (!tatamiId || acting) return;
    setActing(true);

    // ── Actualización optimista inmediata ── responde al instante en UI
    if (action === "start") {
      const adjustedStart = new Date(Date.now() - elapsed * 1000).toISOString();
      setTimerData({ running: true, base: elapsed, startedAt: adjustedStart });
    } else if (action === "pause") {
      setTimerData({ running: false, base: elapsed, startedAt: null });
    } else if (action === "reset") {
      setTimerData({ running: false, base: 0, startedAt: null });
      setElapsed(0);
      finishedRef.current = false;
      // Si es "Nuevo combate" (reset cuando terminado) → limpiar currentMatchId del tatami
      if (finished) {
        fetch(`/api/tournaments/${tournamentId}/tatami/${tatamiId}/active-match`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body:   JSON.stringify({ matchId: null }),
        });
      }
    }

    // ── Llamada al servidor en background (sin bloquear la UI) ──
    fetch(`/api/tournaments/${tournamentId}/tatami/${tatamiId}/timer`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body:   JSON.stringify({ action }),
    }).finally(() => setActing(false));
  }

  return (
    <div className="flex flex-col items-center py-3 px-4 border-b border-white/10 gap-2"
      style={{ background: finished ? "rgba(220,38,38,0.15)" : "#111827",
               borderColor: finished ? "rgba(220,38,38,0.4)" : undefined }}>

      {/* Banner TIEMPO cuando llega a 0:00 */}
      {finished && (
        <div className="w-full text-center py-2 rounded-xl font-black text-xl tracking-widest"
          style={{ background: "rgba(220,38,38,0.3)", color: "#EF4444", letterSpacing: "0.2em" }}>
          ⏱ TIEMPO — COMBATE TERMINADO
        </div>
      )}

      <div className="flex items-center gap-3 w-full justify-between">
        <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">SENCHO</p>
        <p className="font-black tabular-nums"
          style={{ fontSize: "clamp(28px,7vw,44px)", fontFamily: "'Courier New', monospace", lineHeight: 1,
            color: finished ? "#EF4444" : remaining <= 30 ? "#F59E0B" : timerData.running ? "white" : "rgba(255,255,255,0.45)" }}>
          {mm}:{ss}
        </p>
        {!timerData.running && !finished && elapsed > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.2)", color: "#FCA5A5" }}>
            PAUSA
          </span>
        )}
      </div>
      {/* Controles — ocultar si terminó */}
      {!finished && <div className="flex gap-2 w-full">
        {timerData.running ? (
          <button onClick={() => control("pause")} disabled={acting}
            className="flex-1 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{ background: "rgba(239,68,68,0.2)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.3)" }}>
            ⏸ Pausar
          </button>
        ) : (
          <button onClick={() => control("start")} disabled={acting}
            className="flex-1 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{ background: "rgba(16,185,129,0.2)", color: "#34D399", border: "1px solid rgba(16,185,129,0.3)" }}>
            ▶ Reanudar
          </button>
        )}
        <button onClick={() => control("reset")} disabled={acting}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 text-white/40 hover:text-white"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          ↺
        </button>
      </div>}
      {/* Botón reset cuando terminó */}
      {finished && (
        <button onClick={() => control("reset")} disabled={acting}
          className="w-full py-2 rounded-xl text-sm font-bold active:scale-95"
          style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)" }}>
          ↺ Nuevo combate
        </button>
      )}
    </div>
  );
}
