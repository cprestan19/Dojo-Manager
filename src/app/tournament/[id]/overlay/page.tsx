"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface StreamInfo {
  status: string;
  overlayMessage: string | null;
  activeOverlay: string;
  youtubeVideoId: string | null;
  title: string | null;
}

interface TournamentInfo {
  id: string;
  name: string;
}

interface OverlayData {
  tournament: TournamentInfo | null;
  stream: StreamInfo | null;
}

export default function OverlayPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<OverlayData>({ tournament: null, stream: null });
  const [dojoName, setDojoName] = useState<string>("");

  useEffect(() => {
    async function fetchOverlayData() {
      try {
        const res = await fetch(`/api/tournaments/${id}/stream`);
        if (res.ok) {
          const streamData = await res.json();
          setData(prev => ({ ...prev, stream: streamData }));
        }
      } catch {
        // silent
      }
    }

    fetchOverlayData();
    const interval = setInterval(fetchOverlayData, 3000);
    return () => clearInterval(interval);
  }, [id]);

  const isLive = data.stream?.status === "live";
  const message = data.stream?.overlayMessage;

  return (
    <div
      style={{
        width: "1920px",
        height: "1080px",
        position: "relative",
        background: "transparent",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute",
        top: "32px",
        left: "40px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}>
        {dojoName && (
          <div style={{
            color: "white",
            fontSize: "18px",
            fontWeight: "600",
            textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            letterSpacing: "0.05em",
          }}>
            {dojoName}
          </div>
        )}
        {data.tournament?.name && (
          <div style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: "14px",
            fontWeight: "400",
            textShadow: "0 2px 6px rgba(0,0,0,0.8)",
          }}>
            {data.tournament.name}
          </div>
        )}
      </div>

      {isLive && (
        <div style={{
          position: "absolute",
          top: "32px",
          right: "40px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "rgba(220,38,38,0.9)",
          color: "white",
          padding: "8px 16px",
          borderRadius: "8px",
          fontSize: "16px",
          fontWeight: "700",
          letterSpacing: "0.1em",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        }}>
          <span style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: "white",
            display: "inline-block",
            animation: "pulse 1.5s ease-in-out infinite",
          }} />
          EN VIVO
        </div>
      )}

      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "20px 40px",
        background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
        display: "flex",
        alignItems: "flex-end",
      }}>
        <div style={{
          color: message ? "white" : "rgba(255,255,255,0.4)",
          fontSize: message ? "22px" : "16px",
          fontWeight: message ? "500" : "400",
          textShadow: "0 2px 8px rgba(0,0,0,0.8)",
          letterSpacing: "0.02em",
          maxWidth: "80%",
        }}>
          {message ?? "En espera..."}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        body, html {
          background: transparent !important;
          margin: 0;
          padding: 0;
        }
      `}</style>
    </div>
  );
}
