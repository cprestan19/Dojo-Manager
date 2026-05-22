"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Radio } from "lucide-react";

interface LiveTatami {
  id:             string;
  tournamentId:   string;
  name:           string;
  color:          string;
  youtubeVideoId: string | null;
  overlayMessage: string | null;
  currentMatchId: string | null;
  tournament:     { id: string; name: string; date: string } | null;
}

export default function LivePage() {
  const [tatamis, setTatamis] = useState<LiveTatami[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const r = await fetch("/api/portal/live-tatamis", { cache: "no-store" });
      if (r.ok) setTatamis((await r.json()).tatamis ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);

  if (loading) return (
    <div className="space-y-4">
      {[1, 2].map(i => <div key={i} className="h-40 bg-dojo-border/40 rounded-xl animate-pulse" />)}
    </div>
  );

  if (tatamis.length === 0) return (
    <div className="card text-center py-16 space-y-3">
      <Radio size={40} className="text-dojo-muted mx-auto" />
      <p className="text-dojo-white font-semibold">No hay transmisiones activas</p>
      <p className="text-dojo-muted text-sm">
        Cuando tu dojo inicie una transmisión en vivo aparecerá aquí.
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-dojo-muted uppercase tracking-widest flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
        {tatamis.length} {tatamis.length === 1 ? "tatami en vivo" : "tatamis en vivo"}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tatamis.map(t => (
          <Link key={t.id} href={`/portal/live/${t.id}`}
            className="card border border-dojo-border hover:border-dojo-red/50 transition-colors group overflow-hidden block">

            {/* YouTube thumbnail preview */}
            {t.youtubeVideoId && (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://img.youtube.com/vi/${t.youtubeVideoId}/hqdefault.jpg`}
                  alt={t.name}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  EN VIVO
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
                    <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-white border-b-[10px] border-b-transparent ml-1" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-dojo-white">{t.name}</p>
                {t.tournament && (
                  <p className="text-xs text-dojo-muted truncate">{t.tournament.name}</p>
                )}
                {t.overlayMessage && (
                  <p className="text-xs text-dojo-muted/70 truncate mt-0.5">{t.overlayMessage}</p>
                )}
              </div>
              <span className="text-dojo-red text-xs font-bold shrink-0">Ver →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
