"use client";
import { useState, useEffect, useCallback } from "react";
import { Video, Lock, Users } from "lucide-react";
import { BeltBadge } from "@/components/ui/BeltBadge";
import { BELT_COLORS, VIDEO_RANKING_CATEGORIES } from "@/lib/utils";
import { videoNoTransform } from "@/lib/upload-validation";

const VIDEO_CATEGORIES = [...BELT_COLORS, ...VIDEO_RANKING_CATEGORIES];

interface FamilyMember { id: string; fullName: string; isMe: boolean; }

interface BeltVideo {
  id: string; beltColor: string; title: string;
  description: string | null; videoUrl: string | null; tachiKataUrl: string | null; order: number;
}

interface VideoData {
  videos:      BeltVideo[];
  earnedBelts: string[];
}

export default function PortalVideosPage() {
  const [data,          setData]          = useState<VideoData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [playing,       setPlaying]       = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedId,    setSelectedId]    = useState<string>("");

  // Cargar familia al montar — solo muestra selector si hay 2+ miembros.
  // Sin opción "Todos": cada hermano desbloquea por su propia cinta, así que
  // combinar videos de varios alumnos filtraría de más para el de cinta menor.
  useEffect(() => {
    fetch("/api/portal/family")
      .then(r => r.ok ? r.json() : [])
      .then((members: FamilyMember[]) => {
        setFamilyMembers(members);
        if (members.length > 1) {
          const me = members.find(m => m.isMe);
          if (me) setSelectedId(me.id);
        }
      })
      .catch(() => { /* sin familia, comportamiento normal */ });
  }, []);

  const isFamily = familyMembers.length > 1;

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (isFamily && selectedId) p.set("studentId", selectedId);
    fetch(`/api/portal/belt-videos?${p}`)
      .then(r => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.json();
      })
      .then((d: VideoData | VideoData[]) => {
        // Guard: API should always return { videos, earnedBelts }
        if (Array.isArray(d)) {
          setData({ videos: [], earnedBelts: [] });
        } else {
          setData(d);
        }
      })
      .catch(err => {
        console.error("Error cargando videos:", err);
        setError("No se pudieron cargar los videos. Intenta de nuevo.");
      })
      .finally(() => setLoading(false));
  }, [isFamily, selectedId]);

  useEffect(() => {
    if (!isFamily || selectedId) load();
  }, [load, isFamily, selectedId]);

  // Selector de alumno — solo cuando hay familia (2+ miembros)
  const selector = isFamily ? (
    <div className="w-full space-y-1">
      <label className="form-label text-xs flex items-center gap-1.5">
        <Users size={12} /> Alumno
      </label>
      <select
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        className="form-input"
        style={{ fontSize: "16px" }}
      >
        {familyMembers.map(m => (
          <option key={m.id} value={m.id}>
            {m.fullName}{m.isMe ? " (yo)" : ""}
          </option>
        ))}
      </select>
    </div>
  ) : null;

  if (loading) {
    return (
      <div className="space-y-4">
        {selector}
        {[1, 2, 3].map(i => (
          <div key={i} className="card space-y-2">
            <div className="h-4 w-3/4 bg-dojo-border/60 rounded animate-pulse" />
            <div className="h-36 w-full bg-dojo-border/40 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        {selector}
        <div className="text-center py-16 text-dojo-muted">
          <Video size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-semibold text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.videos.length === 0) {
    return (
      <div className="space-y-4">
        {selector}
        <div className="text-center py-16 text-dojo-muted">
          <Video size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-semibold text-dojo-white">Sin videos disponibles</p>
          <p className="text-sm mt-1">
            {data?.earnedBelts.length === 0
              ? "Aún no tiene cintas registradas."
              : "No hay videos cargados para las cintas actuales."}
          </p>
        </div>
      </div>
    );
  }

  // Group videos by belt color / categoría, preserving VIDEO_CATEGORIES order
  const grouped = VIDEO_CATEGORIES.reduce<Record<string, BeltVideo[]>>((acc, b) => {
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
          Solo se ven los videos de las cintas obtenidas.{" "}
          <span className="inline-flex items-center gap-1 text-dojo-gold">
            <Lock size={11} /> Los demás están bloqueados.
          </span>
        </p>
      </div>

      {selector}

      {Object.entries(grouped).map(([beltColor, list]) => {
        const belt = VIDEO_CATEGORIES.find(b => b.value === beltColor);
        if (!belt) return null;
        const isRealBelt = BELT_COLORS.some(b => b.value === beltColor);
        return (
          <div key={beltColor} className="space-y-3">
            {/* Belt / category header */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ backgroundColor: belt.hex + "18" }}
            >
              <span className="w-3 h-3 rounded-full border border-white/30 flex-shrink-0" style={{ backgroundColor: belt.hex }} />
              <p className="font-semibold text-sm" style={{ color: belt.hex === "#FFFFFF" ? "#ccc" : belt.hex }}>
                {isRealBelt ? `Cinta ${belt.label}` : belt.label}
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

                  {/* Video principal — solo si tiene URL */}
                  {v.videoUrl && (
                    <div className="bg-black">
                      {playing === v.id ? (
                        <video
                          src={videoNoTransform(v.videoUrl)}
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
                  )}

                  {/* Tachi Kata — video opcional */}
                  {v.tachiKataUrl && (
                    <>
                      <div className="px-4 py-2 border-t border-dojo-border/40 flex items-center gap-2 bg-dojo-dark/50">
                        <span className="text-xs font-semibold text-dojo-gold">Tachi Kata</span>
                      </div>
                      <div className="bg-black">
                        {playing === `tachi-${v.id}` ? (
                          <video
                            src={videoNoTransform(v.tachiKataUrl)}
                            controls
                            autoPlay
                            className="w-full max-h-72"
                            onEnded={() => setPlaying(null)}
                          />
                        ) : (
                          <button
                            onClick={() => setPlaying(`tachi-${v.id}`)}
                            className="w-full h-28 flex flex-col items-center justify-center gap-2 text-dojo-muted hover:text-dojo-white transition-colors group"
                          >
                            <div className="w-12 h-12 rounded-full bg-dojo-gold/20 group-hover:bg-dojo-gold/40 flex items-center justify-center transition-colors">
                              <Video size={22} className="text-dojo-gold" />
                            </div>
                            <p className="text-xs">Reproducir Tachi Kata</p>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
