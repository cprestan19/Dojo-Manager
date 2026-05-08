"use client";
import { useState, useEffect } from "react";
import { Video, Lock } from "lucide-react";
import { BeltBadge } from "@/components/ui/BeltBadge";
import { BELT_COLORS } from "@/lib/utils";

interface BeltVideo {
  id: string; beltColor: string; title: string;
  description: string | null; videoUrl: string; order: number;
}

interface VideoData {
  videos:      BeltVideo[];
  earnedBelts: string[];
}

export default function PortalVideosPage() {
  const [data,    setData]    = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portal/belt-videos")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card space-y-2">
            <div className="h-4 w-3/4 bg-dojo-border/60 rounded animate-pulse" />
            <div className="h-36 w-full bg-dojo-border/40 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.videos.length === 0) {
    return (
      <div className="text-center py-16 text-dojo-muted">
        <Video size={48} className="mx-auto mb-4 opacity-30" />
        <p className="font-semibold text-dojo-white">Sin videos disponibles</p>
        <p className="text-sm mt-1">
          {data?.earnedBelts.length === 0
            ? "Aún no tienes cintas registradas."
            : "No hay videos cargados para tus cintas actuales."}
        </p>
      </div>
    );
  }

  // Group videos by belt color, preserving BELT_COLORS order
  const grouped = BELT_COLORS.reduce<Record<string, BeltVideo[]>>((acc, b) => {
    const list = data.videos.filter(v => v.beltColor === b.value);
    if (list.length) acc[b.value] = list;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-dojo-white tracking-wide flex items-center gap-2">
          <Video size={20} className="text-dojo-red" /> Videos de Entrenamiento
        </h1>
        <p className="text-dojo-muted text-sm mt-1">
          Solo ves los videos de las cintas que has obtenido.{" "}
          <span className="inline-flex items-center gap-1 text-dojo-gold">
            <Lock size={11} /> Los demás están bloqueados.
          </span>
        </p>
      </div>

      {Object.entries(grouped).map(([beltColor, list]) => {
        const belt = BELT_COLORS.find(b => b.value === beltColor);
        if (!belt) return null;
        return (
          <div key={beltColor} className="space-y-3">
            {/* Belt header */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ backgroundColor: belt.hex + "18" }}
            >
              <span className="w-3 h-3 rounded-full border border-white/30 flex-shrink-0" style={{ backgroundColor: belt.hex }} />
              <p className="font-semibold text-sm" style={{ color: belt.hex === "#FFFFFF" ? "#ccc" : belt.hex }}>
                Cinta {belt.label}
              </p>
              <span className="text-xs text-dojo-muted ml-auto">{list.length} video(s)</span>
            </div>

            {/* Videos de esta cinta */}
            <div className="space-y-3">
              {list.map(v => (
                <div key={v.id} className="card p-0 overflow-hidden">
                  <div className="px-4 py-3 border-b border-dojo-border/40 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-dojo-white text-sm">{v.title}</p>
                      {v.description && (
                        <p className="text-xs text-dojo-muted mt-0.5">{v.description}</p>
                      )}
                    </div>
                    <BeltBadge beltColor={v.beltColor} />
                  </div>

                  {/* Video player — lazy: only render when the user clicks play */}
                  <div className="bg-black">
                    {playing === v.id ? (
                      <video
                        src={v.videoUrl}
                        controls
                        autoPlay
                        className="w-full max-h-72"
                        onEnded={() => setPlaying(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setPlaying(v.id)}
                        className="w-full h-36 flex flex-col items-center justify-center gap-2 text-dojo-muted hover:text-dojo-white transition-colors group"
                      >
                        <div className="w-14 h-14 rounded-full bg-dojo-red/20 group-hover:bg-dojo-red/40 flex items-center justify-center transition-colors">
                          <Video size={28} className="text-dojo-red" />
                        </div>
                        <p className="text-xs">Reproducir video</p>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
