"use client";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { STREAM_STATUS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Copy, Check, ExternalLink, Radio, Square } from "lucide-react";

interface StreamData {
  id: string;
  youtubeVideoId: string | null;
  youtubeStreamKey: string | null;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  status: string;
  overlayMessage: string | null;
  activeOverlay: string;
  startedAt: string | null;
  endedAt: string | null;
}

interface Props {
  tournamentId: string;
  publicSlug?: string | null;
  onRefresh: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={handleCopy}
      className="p-1.5 rounded hover:bg-dojo-border text-dojo-muted hover:text-dojo-white transition-colors"
      title="Copiar">
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  );
}

export function TournamentStream({ tournamentId, publicSlug, onRefresh }: Props) {
  const { show: showToast } = useToast();
  const [stream, setStream]           = useState<StreamData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [showConfirmLive, setShowConfirmLive] = useState(false);

  const [form, setForm] = useState({
    youtubeVideoId: "",
    youtubeStreamKey: "",
    title: "",
    description: "",
    overlayMessage: "",
  });

  const [videoIdValid, setVideoIdValid] = useState<boolean | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    loadStream();
  }, [tournamentId]);

  async function loadStream() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/stream?showKey=1`);
      if (res.ok) {
        const data: StreamData | null = await res.json();
        setStream(data);
        if (data) {
          setForm({
            youtubeVideoId: data.youtubeVideoId ?? "",
            youtubeStreamKey: data.youtubeStreamKey ?? "",
            title: data.title ?? "",
            description: data.description ?? "",
            overlayMessage: data.overlayMessage ?? "",
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }

  function handleVideoIdChange(val: string) {
    setForm(p => ({ ...p, youtubeVideoId: val }));
    if (!val) { setVideoIdValid(null); return; }
    setVideoIdValid(/^[a-zA-Z0-9_-]{11}$/.test(val));
  }

  async function handleSaveConfig() {
    setSaving(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/stream`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeVideoId: form.youtubeVideoId || null,
          youtubeStreamKey: form.youtubeStreamKey || null,
          title: form.title || null,
          description: form.description || null,
          overlayMessage: form.overlayMessage || null,
        }),
      });
      if (res.ok) {
        await loadStream();
        showToast("Configuración guardada");
        onRefresh();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast((d as { error?: string }).error ?? "Error al guardar", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    const res = await fetch(`/api/tournaments/${tournamentId}/stream`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      await loadStream();
      setShowConfirmLive(false);
      showToast(newStatus === "live" ? "¡Stream iniciado EN VIVO!" : "Stream finalizado");
      onRefresh();
    } else {
      const d = await res.json().catch(() => ({}));
      showToast((d as { error?: string }).error ?? "Error", "error");
    }
  }

  if (loading) {
    return <div className="card py-12 text-center text-dojo-muted animate-pulse">Cargando stream...</div>;
  }

  const currentStatus = stream?.status ?? "offline";
  const statusInfo = STREAM_STATUS[currentStatus as keyof typeof STREAM_STATUS];
  const videoId = form.youtubeVideoId || stream?.youtubeVideoId;

  const overlayUrl  = `${origin}/tournament/${tournamentId}/overlay`;
  const publicPageUrl = publicSlug ? `${origin}/public/tournament/${publicSlug}` : null;

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-3 h-3 rounded-full", currentStatus === "live" ? "bg-red-500 animate-pulse" : "bg-gray-500")} />
          <p className={cn("font-semibold text-sm", statusInfo?.color ?? "text-dojo-muted")}>
            {statusInfo?.label ?? currentStatus}
          </p>
          {stream?.startedAt && (
            <span className="text-xs text-dojo-muted">
              Inicio: {new Date(stream.startedAt).toLocaleTimeString("es-PA")}
            </span>
          )}
        </div>

        <div className="flex gap-3 flex-wrap">
          {currentStatus === "offline" && (
            <button onClick={() => setShowConfirmLive(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">
              <Radio size={15} /> Iniciar EN VIVO
            </button>
          )}
          {currentStatus === "live" && (
            <button onClick={() => handleStatusChange("finished")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors">
              <Square size={15} /> Finalizar Stream
            </button>
          )}
          {currentStatus === "finished" && (
            <button onClick={() => handleStatusChange("offline")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dojo-card border border-dojo-border hover:bg-dojo-border text-dojo-white text-sm font-medium transition-colors">
              ↺ Reiniciar Stream
            </button>
          )}
        </div>
      </div>

      <div className="card space-y-4">
        <p className="font-semibold text-dojo-white">Configuración del Stream</p>
        <div>
          <label className="form-label">YouTube Video ID (11 caracteres)</label>
          <div className="relative">
            <input
              className={cn(
                "form-input pr-10",
                videoIdValid === true && "border-green-600/50",
                videoIdValid === false && "border-red-600/50",
              )}
              value={form.youtubeVideoId}
              onChange={e => handleVideoIdChange(e.target.value)}
              placeholder="ej. dQw4w9WgXcQ"
              maxLength={11}
            />
            {videoIdValid === true && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400" />}
            {videoIdValid === false && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 text-xs">!</span>}
          </div>
          {videoIdValid === false && (
            <p className="text-xs text-red-400 mt-1">El Video ID debe tener exactamente 11 caracteres alfanuméricos (ej. dQw4w9WgXcQ)</p>
          )}
        </div>

        {videoId && videoIdValid !== false && (
          <div className="rounded-lg overflow-hidden border border-dojo-border" style={{ aspectRatio: "16/9" }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        <div>
          <label className="form-label">Título del Stream</label>
          <input className="form-input" value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Ej. Torneo Regional de Karate 2025" />
        </div>
        <div>
          <label className="form-label">Descripción</label>
          <textarea rows={2} className="form-input resize-none" value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="form-label">Stream Key (YouTube)</label>
            <button onClick={() => setShowKeyInput(p => !p)}
              className="text-xs text-dojo-muted hover:text-dojo-white transition-colors flex items-center gap-1">
              {showKeyInput ? <><EyeOff size={12} /> Ocultar</> : <><Eye size={12} /> Mostrar</>}
            </button>
          </div>
          <input
            type={showKeyInput ? "text" : "password"}
            className="form-input font-mono text-sm"
            value={form.youtubeStreamKey}
            onChange={e => setForm(p => ({ ...p, youtubeStreamKey: e.target.value }))}
            placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
          />
          <div className="flex items-start gap-2 mt-2 p-2 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
            <span className="text-yellow-400 text-sm mt-0.5">⚠️</span>
            <p className="text-xs text-yellow-300">
              La stream key es confidencial. Nunca la compartas públicamente.
              Se almacena de forma segura y nunca se expone en las respuestas públicas de la API.
            </p>
          </div>
        </div>

        <div>
          <label className="form-label">Mensaje en Overlay</label>
          <input className="form-input" value={form.overlayMessage}
            onChange={e => setForm(p => ({ ...p, overlayMessage: e.target.value }))}
            placeholder="Ej. Bienvenidos al Torneo Nacional" />
        </div>

        <div className="flex justify-end">
          <button onClick={handleSaveConfig} disabled={saving || videoIdValid === false} className="btn-primary">
            {saving ? "Guardando..." : "Guardar Configuración"}
          </button>
        </div>
      </div>

      {videoId && (
        <div className="card space-y-3">
          <p className="font-semibold text-dojo-white">Links del Stream</p>
          <div className="space-y-2">
            {[
              {
                label: "Ver en YouTube",
                url: `https://youtube.com/watch?v=${videoId}`,
                description: "Link directo al video en YouTube",
              },
              ...(publicPageUrl ? [{
                label: "Página Pública del Torneo",
                url: publicPageUrl,
                description: "Página pública con información del torneo",
              }] : []),
              {
                label: "Overlay para OBS",
                url: overlayUrl,
                description: "Overlay transparente para usar en OBS Studio",
              },
            ].map(link => (
              <div key={link.label} className="flex items-center gap-3 p-3 rounded-lg border border-dojo-border bg-dojo-bg/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dojo-white">{link.label}</p>
                  <p className="text-xs text-dojo-muted truncate">{link.url}</p>
                  <p className="text-xs text-dojo-muted/70 mt-0.5">{link.description}</p>
                </div>
                <CopyButton text={link.url} />
                <a href={link.url} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 rounded hover:bg-dojo-border text-dojo-muted hover:text-dojo-white transition-colors">
                  <ExternalLink size={13} />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {showConfirmLive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-dojo-card rounded-xl border border-dojo-border shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <p className="font-semibold text-dojo-white">Iniciar Transmisión EN VIVO</p>
            </div>
            <div className="p-3 bg-dojo-bg/60 rounded-lg border border-dojo-border text-sm text-dojo-muted space-y-2">
              <p className="font-medium text-dojo-white">Instrucciones para OBS Studio:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Abre OBS Studio y ve a Configuración → Stream</li>
                <li>Selecciona YouTube como servicio</li>
                <li>Pega la Stream Key de YouTube en el campo correspondiente</li>
                <li>Agrega una fuente de navegador con la URL del overlay</li>
                <li>Configura el overlay como fuente transparente (1920x1080)</li>
                <li>Presiona Iniciar Streaming en OBS</li>
                <li>Luego presiona el botón de abajo para marcar como EN VIVO</li>
              </ol>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirmLive(false)} className="btn-secondary">Cancelar</button>
              <button
                onClick={() => handleStatusChange("live")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">
                <Radio size={14} /> Marcar como EN VIVO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
