"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CoachPortalClient } from "./CoachPortalClient";

export default function CoachPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // Pre-validate: just check if API responds (actual validation happens in CoachPortalClient)
  useEffect(() => {
    fetch(`/api/public/tournament-club/${token}`)
      .then(r => {
        if (r.ok) setStatus("ok");
        else r.json().then(d => { setErrorMsg(d.error ?? "Enlace inválido o expirado"); setStatus("error"); });
      })
      .catch(() => { setErrorMsg("Error de conexión"); setStatus("error"); });
  }, [token]);

  if (status === "loading") return (
    <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "15px" }}>Cargando portal...</p>
    </div>
  );

  if (status === "error") return (
    <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <div style={{ textAlign: "center", padding: "32px", maxWidth: "400px" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔗</div>
        <h2 style={{ color: "white", fontSize: "20px", fontWeight: 700, marginBottom: "10px" }}>Enlace no válido</h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", lineHeight: 1.6 }}>
          {errorMsg}<br/>
          Este enlace puede haber expirado (30 días). Contacta al organizador del torneo para solicitar uno nuevo.
        </p>
      </div>
    </div>
  );

  return <CoachPortalClient token={token} />;
}
