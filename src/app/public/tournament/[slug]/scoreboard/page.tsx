"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Wifi, WifiOff } from "lucide-react";

interface Participant { fullName: string; beltColor: string | null }
interface MatchInfo {
  round: number; matchNumber: number;
  bracketName: string; bracketType: string;
  participant1: Participant | null;
  participant2: Participant | null;
  judgeTotal1: number; judgeTotal2: number;
  score1: number | null; score2: number | null;
}
interface TatamiCard {
  id: string; name: string; color: string; order: number;
  streamStatus: string; overlayMessage: string | null;
  youtubeVideoId: string | null;
  currentMatch: MatchInfo | null;
}
interface ScoreboardData {
  tournament: { id: string; name: string; status: string };
  tatamis:    TatamiCard[];
}

const BELT_HEX: Record<string, string> = {
  "blanca":"#FFF","blanca-celeste":"#87CEEB","blanco-amarillo":"#FFE566",
  "amarilla":"#FFD700","naranja":"#FFA500","verde":"#228B22",
  "azul":"#1E3A8A","morada":"#6B21A8","roja":"#DC2626",
  "café":"#92400E","negra":"#111",
};

function BeltDot({ belt }: { belt: string | null }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
    style={{ background: belt ? (BELT_HEX[belt] ?? "#888") : "#888" }} />;
}

function TatamiCard({ tatami }: { tatami: TatamiCard }) {
  const isLive  = tatami.streamStatus === "live";
  const match   = tatami.currentMatch;
  const s1 = match ? (match.judgeTotal1 || match.score1 || 0) : 0;
  const s2 = match ? (match.judgeTotal2 || match.score2 || 0) : 0;

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "#111827", border: `2px solid ${tatami.color}40` }}>
      {/* Header tatami */}
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ background: tatami.color + "22", borderBottom: `1px solid ${tatami.color}30` }}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: tatami.color }}/>
          <span className="font-black text-white text-sm uppercase tracking-wide">{tatami.name}</span>
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: "#DC2626" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/>
            <span className="text-white text-[10px] font-black tracking-widest">EN VIVO</span>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 p-4">
        {match ? (
          <div className="space-y-3">
            {/* Categoría */}
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
              {match.bracketName} · R{match.round} · M{match.matchNumber}
            </p>

            {/* Scores */}
            <div className="space-y-2">
              {/* C1 */}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(30,58,138,0.5)" }}>
                <BeltDot belt={match.participant1?.beltColor ?? null} />
                <span className="text-white text-sm font-bold flex-1 truncate">{match.participant1?.fullName ?? "—"}</span>
                <span className="font-black text-2xl text-white tabular-nums">{s1}</span>
              </div>
              {/* C2 */}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(127,29,29,0.5)" }}>
                <BeltDot belt={match.participant2?.beltColor ?? null} />
                <span className="text-white text-sm font-bold flex-1 truncate">{match.participant2?.fullName ?? "—"}</span>
                <span className="font-black text-2xl text-white tabular-nums">{s2}</span>
              </div>
            </div>

            {tatami.overlayMessage && (
              <p className="text-xs text-white/50 italic">{tatami.overlayMessage}</p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-20 text-white/25 text-sm">
            En espera...
          </div>
        )}
      </div>

      {/* YouTube link si está en vivo */}
      {isLive && tatami.youtubeVideoId && (
        <a href={`https://www.youtube.com/watch?v=${tatami.youtubeVideoId}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-white/60 hover:text-white transition-colors border-t border-white/5"
          style={{ background: "rgba(220,38,38,0.1)" }}>
          <span>▶</span> Ver en YouTube
        </a>
      )}
    </div>
  );
}

export default function ScoreboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data,       setData]       = useState<ScoreboardData | null>(null);
  const [connected,  setConnected]  = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const r = await fetch(`/api/public/tournaments/${slug}/scoreboard`);
        if (r.ok) { setData(await r.json()); setConnected(true); setLastUpdate(new Date()); }
        else setConnected(false);
      } catch { setConnected(false); }
    }
    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, [slug]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080C14" }}>
        <div className="text-white/40 text-sm animate-pulse">Cargando scoreboard...</div>
      </div>
    );
  }

  const cols = data.tatamis.length <= 2 ? 2
             : data.tatamis.length <= 4 ? 2
             : data.tatamis.length <= 6 ? 3
             : 4;

  return (
    <div className="min-h-screen" style={{ background: "#080C14", fontFamily: "'Nunito', sans-serif" }}>

      {/* Header */}
      <div className="border-b border-white/5 px-6 py-3 flex items-center justify-between"
        style={{ background: "rgba(8,12,20,0.95)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-black text-white text-lg tracking-wide">{data.tournament.name}</h1>
          <p className="text-white/40 text-xs">Marcador en tiempo real · {data.tatamis.length} tatamis</p>
        </div>
        <div className="flex items-center gap-2">
          {connected
            ? <><Wifi size={14} className="text-green-400"/><span className="text-green-400 text-xs font-semibold">En vivo</span></>
            : <><WifiOff size={14} className="text-red-400"/><span className="text-red-400 text-xs">Sin conexión</span></>
          }
          {lastUpdate && (
            <span className="text-white/20 text-xs ml-2">
              {lastUpdate.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      {/* Grid de tatamis */}
      <div className="p-4" style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "12px" }}>
        {data.tatamis.map(tatami => (
          <TatamiCard key={tatami.id} tatami={tatami} />
        ))}
      </div>

      {/* Tatamis en vivo por YouTube */}
      {data.tatamis.some(t => t.streamStatus === "live" && t.youtubeVideoId) && (
        <div className="px-4 pb-8">
          <p className="text-xs text-white/30 font-bold uppercase tracking-widest mb-3">Streams en vivo</p>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(cols, 3)}, 1fr)` }}>
            {data.tatamis
              .filter(t => t.streamStatus === "live" && t.youtubeVideoId)
              .map(t => (
                <div key={t.id} className="rounded-2xl overflow-hidden border border-white/5">
                  <div className="flex items-center gap-2 px-3 py-2" style={{ background: "#111827" }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }}/>
                    <span className="text-white text-sm font-bold">{t.name}</span>
                  </div>
                  <div style={{ position: "relative", paddingBottom: "56.25%" }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${t.youtubeVideoId}?autoplay=1&mute=1`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
