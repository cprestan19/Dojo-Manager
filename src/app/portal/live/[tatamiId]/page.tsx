"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface TatamiInfo {
  id: string; name: string; color: string; youtubeVideoId: string | null;
  streamStatus: string; overlayMessage: string | null;
}
interface TournamentInfo { id: string; name: string; date: string }

export default function LiveTatamiPage() {
  const { tatamiId } = useParams<{ tatamiId: string }>();
  const router        = useRouter();
  const [tatami, setTatami]       = useState<TatamiInfo | null>(null);
  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`/api/public/tatami-display/${tatamiId}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        setTatami(d.tatami);
        setTournament(d.tournament);
      } finally { setLoading(false); }
    }
    load();
  }, [tatamiId]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-dojo-muted text-sm animate-pulse">Cargando transmisión...</div>
    </div>
  );

  if (!tatami?.youtubeVideoId) return (
    <div className="card text-center py-12 space-y-3">
      <p className="text-dojo-white font-semibold">Transmisión no disponible</p>
      <button onClick={() => router.back()} className="btn-secondary text-sm">← Volver</button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-dojo-muted hover:text-dojo-white transition-colors text-sm">
        <ArrowLeft size={16} /> Volver a transmisiones
      </button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full" style={{ background: tatami.color }} />
        <div>
          <h1 className="font-bold text-dojo-white">{tatami.name}</h1>
          {tournament && (
            <p className="text-xs text-dojo-muted">{tournament.name}</p>
          )}
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-xs font-bold text-red-400">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          EN VIVO
        </span>
      </div>

      {/* YouTube embed — youtubeStreamKey nunca expuesta */}
      <div className="rounded-xl overflow-hidden bg-black aspect-video w-full">
        <iframe
          src={`https://www.youtube.com/embed/${tatami.youtubeVideoId}?autoplay=1&rel=0&modestbranding=1`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* Overlay message */}
      {tatami.overlayMessage && (
        <div className="card text-center text-dojo-white text-sm py-3">
          {tatami.overlayMessage}
        </div>
      )}
    </div>
  );
}
