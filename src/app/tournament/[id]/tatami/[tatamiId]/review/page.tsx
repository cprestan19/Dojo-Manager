"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  buildYouTubeEmbedUrl,
  buildOBSSeekInstruction,
  formatReviewOffset,
  calculateYouTubeSeekSeconds,
  type ReviewDecision,
  type ReviewStatus,
} from "@/lib/video-review";

// ── Types ────────────────────────────────────────────────────

interface Participant { fullName: string; dojoName: string | null }
interface MatchData {
  id: string;
  round: number;
  matchNumber: number;
  bracketName: string;
  participant1: Participant | null;
  participant2: Participant | null;
  score1: number;
  score2: number;
  reviewStatus: ReviewStatus;
  reviewRequestedBy: string | null;
}
interface TatamiData {
  id: string;
  name: string;
  color: string;
  youtubeVideoId: string | null;
  obsRecordingPath: string | null;
  videoReviewEnabled: boolean;
}
interface ReviewData {
  reviewStatus: ReviewStatus;
  reviewRequestedBy: string | null;
  reviewDecision: string | null;
  offsetSeconds: number | null;
  offsetFormatted: string | null;
  youtubeVideoId: string | null;
  videoReviewEnabled: boolean;
}

// ── YouTube IFrame player helper ─────────────────────────────

declare global {
  interface Window {
    YT: { Player: new (el: string | HTMLElement, opts: object) => YouTubePlayer };
    onYouTubeIframeAPIReady: () => void;
  }
}
interface YouTubePlayer { seekTo: (seconds: number, allowSeekAhead: boolean) => void }

function loadYouTubeAPI(onReady: () => void) {
  if (typeof window === "undefined") return;
  if (window.YT) { onReady(); return; }
  window.onYouTubeIframeAPIReady = onReady;
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
}

// ── Main component ───────────────────────────────────────────

export default function VideoReviewPage() {
  const { id, tatamiId } = useParams<{ id: string; tatamiId: string }>();

  const [pin, setPin]         = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [checkingPin, setCheckingPin] = useState(false);

  const [tatami, setTatami]   = useState<TatamiData | null>(null);
  const [match, setMatch]     = useState<MatchData | null>(null);
  const [review, setReview]   = useState<ReviewData | null>(null);

  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [notes, setNotes]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [submitError, setSubmitError] = useState("");

  const iframeRef    = useRef<HTMLIFrameElement>(null);
  const ytPlayerRef  = useRef<YouTubePlayer | null>(null);

  // Cargar datos del tatami (público)
  useEffect(() => {
    async function load() {
      const r = await fetch(`/api/public/tatami-display/${tatamiId}`, { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      setTatami({
        id:                 data.tatami.id,
        name:               data.tatami.name,
        color:              data.tatami.color,
        youtubeVideoId:     data.tatami.youtubeVideoId ?? null,
        obsRecordingPath:   null,
        videoReviewEnabled: true,
      });
      if (data.match) {
        setMatch({
          id:                data.match.id,
          round:             data.match.round,
          matchNumber:       data.match.matchNumber,
          bracketName:       data.match.bracketName,
          participant1:      data.match.participant1,
          participant2:      data.match.participant2,
          score1:            data.match.totals?.total1 ?? 0,
          score2:            data.match.totals?.total2 ?? 0,
          reviewStatus:      "none",
          reviewRequestedBy: null,
        });
      }
    }
    load();
  }, [tatamiId]);

  // Polling del estado del review (solo cuando hay PIN y un match activo)
  useEffect(() => {
    if (!pin || !match) return;
    function poll() {
      fetch(`/api/tournaments/${id}/matches/${match!.id}/video-review`, { cache: "no-store" })
        .then(r => r.ok ? r.json() : null)
        .then((d: ReviewData | null) => { if (d) setReview(d); })
        .catch(() => null);
    }
    poll();
    const iv = setInterval(poll, 2000);
    return () => clearInterval(iv);
  }, [pin, match, id]);

  // Inicializar YouTube IFrame API y hacer seek cuando llegan los datos del review
  useEffect(() => {
    if (!review?.youtubeVideoId || review.offsetSeconds == null) return;
    const seekTo = calculateYouTubeSeekSeconds(review.offsetSeconds);

    loadYouTubeAPI(() => {
      if (!iframeRef.current) return;
      ytPlayerRef.current = new window.YT.Player(iframeRef.current, {
        events: {
          onReady: () => ytPlayerRef.current?.seekTo(seekTo, true),
        },
      });
    });
  }, [review?.youtubeVideoId, review?.offsetSeconds]);

  // ── PIN verification ──────────────────────────────────────────

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pinInput.trim() || !match) return;
    setCheckingPin(true);
    setPinError("");
    try {
      const r = await fetch(`/api/tournaments/${id}/matches/${match.id}/video-review`, {
        method: "GET",
        cache:  "no-store",
      });
      if (!r.ok) { setPinError("No se pudo verificar el PIN"); return; }

      // Intentar un POST con el PIN para verificarlo
      const pr = await fetch(`/api/tournaments/${id}/matches/${match.id}/video-review`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pin: pinInput.trim(), requestedBy: "referee" }),
      });
      const pd = await pr.json();

      if (pr.status === 403) { setPinError("PIN incorrecto"); return; }
      if (pr.status === 409) {
        // Review ya activa — PIN correcto
        setPin(pinInput.trim());
        return;
      }
      if (pr.ok) {
        setPin(pinInput.trim());
        setReview(pd);
        return;
      }
      if (pd.error) { setPinError(pd.error); }
    } catch {
      setPinError("Error de conexión");
    } finally {
      setCheckingPin(false);
    }
  }

  async function handleDecision() {
    if (!decision || !match || !pin) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const r = await fetch(`/api/tournaments/${id}/matches/${match.id}/video-review`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pin, decision, notes: notes.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) { setSubmitError(d.error ?? "Error al registrar decisión"); return; }
      setSubmitted(true);
    } catch {
      setSubmitError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render helpers ─────────────────────────────────────────────

  const bg = "#0d1117";
  const card = "rgba(255,255,255,0.05)";
  const border = "rgba(255,255,255,0.1)";

  // ── PIN screen ─────────────────────────────────────────────────

  if (!pin) {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', sans-serif" }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "16px", padding: "40px", width: "100%", maxWidth: "360px", textAlign: "center" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>📹</div>
          <h1 style={{ color: "white", fontSize: "22px", fontWeight: 800, marginBottom: "6px" }}>Video Review</h1>
          {tatami && (
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", marginBottom: "24px" }}>
              {tatami.name}
            </p>
          )}
          {!match ? (
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>Sin combate activo en este tatami.</p>
          ) : (
            <form onSubmit={handlePinSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="PIN de acreditación"
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.08)", border: `1px solid ${border}`,
                  borderRadius: "10px", padding: "14px 16px", color: "white",
                  fontSize: "20px", textAlign: "center", letterSpacing: "0.3em",
                  outline: "none",
                }}
                autoFocus
              />
              {pinError && (
                <p style={{ color: "#f87171", fontSize: "13px", margin: 0 }}>{pinError}</p>
              )}
              <button
                type="submit"
                disabled={checkingPin || !pinInput.trim()}
                style={{
                  background: "#2563eb", color: "white", border: "none", borderRadius: "10px",
                  padding: "14px", fontSize: "16px", fontWeight: 700, cursor: "pointer",
                  opacity: checkingPin ? 0.6 : 1,
                }}
              >
                {checkingPin ? "Verificando..." : "Acceder →"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Submitted screen ───────────────────────────────────────────

  if (submitted) {
    const isReversed = decision === "reversed";
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', sans-serif" }}>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ fontSize: "72px", marginBottom: "16px" }}>{isReversed ? "↩️" : "✅"}</div>
          <h2 style={{ color: "white", fontSize: "28px", fontWeight: 900, marginBottom: "8px" }}>
            {isReversed ? "DECISIÓN REVERTIDA" : decision === "no_contest" ? "SIN DEFINICIÓN" : "PUNTO CONFIRMADO"}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "15px" }}>
            Decisión registrada. Puedes reanudar el combate.
          </p>
        </div>
      </div>
    );
  }

  // ── Review screen ──────────────────────────────────────────────

  const offsetSecs = review?.offsetSeconds ?? null;
  const youtubeId  = review?.youtubeVideoId ?? tatami?.youtubeVideoId ?? null;
  const obsPath    = tatami?.obsRecordingPath ?? null;

  const DECISIONS: { key: ReviewDecision; label: string; color: string; emoji: string }[] = [
    { key: "confirmed",  label: "Confirmar Punto",  color: "#16a34a", emoji: "✅" },
    { key: "reversed",   label: "Revertir Punto",   color: "#dc2626", emoji: "↩️" },
    { key: "no_contest", label: "Sin Definición",   color: "#d97706", emoji: "⚖️" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "'Segoe UI', sans-serif", padding: "20px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: tatami?.color ?? "#C0392B", flexShrink: 0 }} />
            <span style={{ color: "white", fontWeight: 800, fontSize: "18px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {tatami?.name ?? ""} — VIDEO REVIEW
            </span>
          </div>
          {match && (
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", marginTop: "4px", marginLeft: "22px" }}>
              {match.bracketName} · R{match.round} #{match.matchNumber}
            </p>
          )}
        </div>
        <span style={{ background: "rgba(37,99,235,0.2)", color: "#60a5fa", border: "1px solid rgba(37,99,235,0.4)", borderRadius: "6px", padding: "4px 12px", fontSize: "13px", fontWeight: 700 }}>
          📹 REVIEW
        </span>
      </div>

      {/* Competitors */}
      {match && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "12px", marginBottom: "20px", alignItems: "center" }}>
          <div style={{ background: "rgba(30,58,138,0.4)", border: "1px solid rgba(30,58,138,0.6)", borderRadius: "10px", padding: "14px 16px" }}>
            <p style={{ color: "rgba(147,197,253,0.8)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "4px" }}>AO</p>
            <p style={{ color: "white", fontWeight: 700, fontSize: "16px" }}>{match.participant1?.fullName ?? "—"}</p>
            {match.participant1?.dojoName && <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px" }}>{match.participant1.dojoName}</p>}
            <p style={{ color: "white", fontSize: "32px", fontWeight: 900, marginTop: "6px" }}>{match.score1}</p>
          </div>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "16px", fontWeight: 700, textAlign: "center" }}>VS</p>
          <div style={{ background: "rgba(127,29,29,0.4)", border: "1px solid rgba(127,29,29,0.6)", borderRadius: "10px", padding: "14px 16px", textAlign: "right" }}>
            <p style={{ color: "rgba(252,165,165,0.8)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "4px" }}>AKA</p>
            <p style={{ color: "white", fontWeight: 700, fontSize: "16px" }}>{match.participant2?.fullName ?? "—"}</p>
            {match.participant2?.dojoName && <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px" }}>{match.participant2.dojoName}</p>}
            <p style={{ color: "white", fontSize: "32px", fontWeight: 900, marginTop: "6px" }}>{match.score2}</p>
          </div>
        </div>
      )}

      {/* Momento a revisar */}
      {offsetSecs != null && (
        <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: "10px", padding: "14px 18px", marginBottom: "20px" }}>
          <p style={{ color: "#fbbf24", fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>⏱ Momento a revisar</p>
          <p style={{ color: "white", fontSize: "22px", fontWeight: 900 }}>{formatReviewOffset(offsetSecs)}</p>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", marginTop: "4px" }}>
            Solicitado por: {review?.reviewRequestedBy?.toUpperCase() ?? "árbitro"}
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        {/* YouTube embed */}
        {youtubeId && (
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "10px", overflow: "hidden", aspectRatio: "16/9" }}>
            <iframe
              ref={iframeRef}
              id="yt-review-player"
              src={buildYouTubeEmbedUrl(youtubeId)}
              width="100%"
              height="100%"
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ display: "block" }}
            />
          </div>
        )}

        {/* OBS info */}
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em" }}>
            📁 GRABACIÓN LOCAL OBS
          </p>
          {offsetSecs != null ? (
            <p style={{ color: "white", fontSize: "15px", fontWeight: 600, lineHeight: 1.5 }}>
              {buildOBSSeekInstruction(offsetSecs, obsPath)}
            </p>
          ) : (
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>
              Esperando datos del combate...
            </p>
          )}
          {!youtubeId && (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", marginTop: "auto" }}>
              Sin stream de YouTube configurado — usar solo grabación local.
            </p>
          )}
        </div>
      </div>

      {/* Decision buttons */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "20px" }}>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "14px" }}>
          DECISIÓN DEL ÁRBITRO
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
          {DECISIONS.map(d => (
            <button
              key={d.key}
              onClick={() => setDecision(d.key)}
              style={{
                background: decision === d.key ? d.color : "rgba(255,255,255,0.06)",
                border: `2px solid ${decision === d.key ? d.color : border}`,
                borderRadius: "10px",
                padding: "16px 12px",
                color: "white",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s",
                minHeight: "72px",
              }}
            >
              <span style={{ display: "block", fontSize: "24px", marginBottom: "6px" }}>{d.emoji}</span>
              {d.label}
            </button>
          ))}
        </div>

        {/* Optional notes */}
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Nota del árbitro (opcional)..."
          maxLength={200}
          rows={2}
          style={{
            width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${border}`,
            borderRadius: "8px", padding: "10px 14px", color: "white", fontSize: "14px",
            resize: "none", outline: "none", marginBottom: "14px",
            boxSizing: "border-box",
          }}
        />

        {submitError && (
          <p style={{ color: "#f87171", fontSize: "13px", marginBottom: "10px" }}>{submitError}</p>
        )}

        <button
          onClick={handleDecision}
          disabled={!decision || submitting}
          style={{
            width: "100%",
            background: decision ? "#2563eb" : "rgba(255,255,255,0.08)",
            border: "none", borderRadius: "10px", padding: "16px",
            color: "white", fontSize: "16px", fontWeight: 700, cursor: decision ? "pointer" : "not-allowed",
            opacity: submitting ? 0.6 : 1, transition: "all 0.15s",
          }}
        >
          {submitting ? "Registrando..." : "Enviar Decisión → Reanudar Combate"}
        </button>
      </div>
    </div>
  );
}
