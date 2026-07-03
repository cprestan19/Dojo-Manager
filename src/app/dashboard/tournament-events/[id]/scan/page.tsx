"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import type { Html5Qrcode as Html5QrcodeType } from "html5-qrcode";
import { ArrowLeft, QrCode, AlertTriangle, Search, ChevronDown } from "lucide-react";

interface ScanResult {
  type:        "success" | "already" | "not-enrolled" | "error";
  studentName: string;
  belt?:       string;
  arrivedAt?:  string | null;
  message?:    string;
}

export default function TournamentEventScanPage() {
  const { id } = useParams<{ id: string }>();
  const [eventName,      setEventName]      = useState("");
  const [arrivedCount,   setArrivedCount]   = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [totalCount,     setTotalCount]     = useState(0);
  const [view,         setView]         = useState<"ready" | "scanning">("ready");
  const [cameraError,   setCameraError]   = useState("");
  const [lastResult,    setLastResult]    = useState<ScanResult | null>(null);
  const [countdown,     setCountdown]     = useState(0);
  const [manualOpen,    setManualOpen]    = useState(false);
  const [manualInput,   setManualInput]   = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError,   setManualError]   = useState("");

  const scannerRef      = useRef<Html5QrcodeType | null>(null);
  const isProcessingRef = useRef(false);
  const manualBusyRef   = useRef(false); // guard contra doble envío en entrada manual

  // Cargar datos básicos del evento
  useEffect(() => {
    fetch(`/api/tournament-events/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setEventName(d.name ?? "");
        setArrivedCount(d.arrivedCount ?? 0);
        setConfirmedCount(d.confirmedCount ?? 0);
        setTotalCount(d.totalStudents ?? 0);
      });
  }, [id]);

  const handleScan = useCallback(async (decoded: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    try { await scannerRef.current?.pause(true); } catch { /* ok */ }

    const val = decoded.trim();
    try {
      // Acepta studentCode numérico o id directo (igual que el scanner de clases)
      const body = /^\d+$/.test(val) ? { studentCode: parseInt(val, 10) } : { studentId: val };
      const res  = await fetch(`/api/tournament-events/${id}/checkin`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.notEnrolled) {
          setLastResult({ type: "not-enrolled", studentName: data.studentName ?? "", message: data.error });
        } else {
          setLastResult({ type: "error", studentName: "", message: data.error ?? "QR no válido para este torneo" });
        }
      } else if (data.alreadyArrived) {
        setLastResult({ type: "already", studentName: data.studentName, belt: data.belt, arrivedAt: data.arrivedAt });
      } else {
        setLastResult({ type: "success", studentName: data.studentName, belt: data.belt });
        setArrivedCount(n => n + 1);
      }
    } catch {
      setLastResult({ type: "error", studentName: "", message: "Error de conexión" });
    }
    isProcessingRef.current = false;
  }, [id]);

  // Entrada manual de ID o código numérico
  const handleManual = useCallback(async () => {
    if (manualBusyRef.current) return; // prevenir doble envío
    const val = manualInput.trim();
    if (!val) { setManualError("Ingresa el ID o código del alumno"); return; }
    setManualError("");
    manualBusyRef.current = true;
    setManualLoading(true);
    try { await scannerRef.current?.pause(true); } catch { /* ok */ }

    const body = /^\d+$/.test(val) ? { studentCode: parseInt(val, 10) } : { studentId: val };
    try {
      const res  = await fetch(`/api/tournament-events/${id}/checkin`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.notEnrolled) {
          setLastResult({ type: "not-enrolled", studentName: data.studentName ?? "", message: data.error });
        } else {
          setLastResult({ type: "error", studentName: "", message: data.error ?? "ID no válido para este torneo" });
        }
      } else if (data.alreadyArrived) {
        setLastResult({ type: "already", studentName: data.studentName, belt: data.belt, arrivedAt: data.arrivedAt });
      } else {
        setLastResult({ type: "success", studentName: data.studentName, belt: data.belt });
        setArrivedCount(n => n + 1);
      }
      setManualOpen(false);
      setManualInput("");
    } catch {
      setManualError("Error de conexión");
    } finally {
      manualBusyRef.current = false;
      setManualLoading(false);
      try { scannerRef.current?.resume(); } catch { /* ok */ }
    }
  }, [id, manualInput]);

  // Cuenta regresiva para limpiar el resultado
  useEffect(() => {
    if (!lastResult) { setCountdown(0); return; }
    const secs = lastResult.type === "success" ? 4 : lastResult.type === "already" ? 5 : 3;
    setCountdown(secs);
    const iv = setInterval(() => setCountdown(n => {
      if (n <= 1) {
        clearInterval(iv);
        setLastResult(null);
        try { scannerRef.current?.resume(); } catch { /* ok */ }
        return 0;
      }
      return n - 1;
    }), 1000);
    return () => clearInterval(iv);
  }, [lastResult]);

  // Iniciar scanner
  useEffect(() => {
    if (view !== "scanning") return;
    let cancelled = false;
    setCameraError("");

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      const qr = new Html5Qrcode("te-qr-reader");
      scannerRef.current = qr;

      qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: (w: number, h: number) => {
          const side = Math.floor(Math.min(w, h) * 0.65);
          return { width: side, height: side };
        }},
        decoded => { handleScan(decoded); },
        () => {},
      ).catch((err: unknown) => {
        if (cancelled) return;
        const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
        if (msg.includes("dismissed")) {
          setCameraError("Toca «Activar Cámara» y acepta el permiso cuando el navegador lo solicite.");
          setView("ready");
        } else {
          setCameraError("No se pudo acceder a la cámara. Verifica los permisos en tu navegador.");
        }
      });
    });

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [view, handleScan]);

  const base = confirmedCount > 0 ? confirmedCount : totalCount;
  const pct  = base > 0 ? Math.round((arrivedCount / base) * 100) : 0;

  const resultBg: Record<ScanResult["type"], string> = {
    success:        "#064e3b",
    already:        "#78350f",   // ámbar oscuro — llamativo y distinto al éxito
    "not-enrolled": "#1e1b4b",
    error:          "#450a0a",
  };
  const resultBorder: Record<ScanResult["type"], string> = {
    success:        "rgba(34,197,94,0.4)",
    already:        "#f59e0b",   // borde ámbar brillante — inconfundible
    "not-enrolled": "rgba(99,102,241,0.4)",
    error:          "rgba(239,68,68,0.4)",
  };
  const resultIcon: Record<ScanResult["type"], string> = {
    success: "✅", already: "🚫", "not-enrolled": "🔕", error: "❌",
  };
  const resultTitle: Record<ScanResult["type"], string> = {
    success:        "¡Llegada registrada!",
    already:        "YA FUE REGISTRADO HOY",
    "not-enrolled": "No inscrito en este torneo",
    error:          "QR no válido",
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080C14" }}>
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <a href={`/dashboard/tournament-events/${id}`}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white">
            <ArrowLeft size={18} />
          </a>
          <div>
            <p className="font-bold text-white text-sm leading-tight truncate max-w-[180px]">
              {eventName || "Cargando..."}
            </p>
            <p className="text-white/40 text-xs">Scanner de asistencia</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold" style={{ color: "#C0392B" }}>{arrivedCount}</span>
          <span className="text-white/40 text-xs"> / {confirmedCount > 0 ? confirmedCount : totalCount}</span>
          <p className="text-white/40 text-xs">{pct}% {confirmedCount > 0 ? "confirmados" : "presentes"}</p>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-start pt-6 px-4">
        <div className="w-full max-w-sm">

          {view === "ready" ? (
            /* Pantalla pre-permiso */
            <div className="text-center space-y-6 py-4">
              <div className="relative mx-auto w-28 h-28">
                <div className="w-28 h-28 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(192,57,43,0.15)", border: "2px solid rgba(192,57,43,0.3)" }}>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(192,57,43,0.2)" }}>
                    <QrCode size={40} color="#C0392B" />
                  </div>
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-dojo-red/20 animate-ping" />
              </div>

              {cameraError ? (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-left"
                  style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
                  <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-yellow-200 text-sm leading-snug">{cameraError}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-white font-bold text-lg">Escanear QR de Alumnos</p>
                  <p className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">
                    Apunta la cámara al código QR del alumno para registrar su llegada al torneo.
                  </p>
                  <p className="text-white/30 text-xs">Solo se registra la asistencia al torneo — no afecta las clases diarias.</p>
                </div>
              )}

              <button
                onClick={() => { setCameraError(""); setView("scanning"); }}
                className="w-full py-4 rounded-2xl font-bold text-white text-lg transition-all active:scale-95"
                style={{ background: "#C0392B", boxShadow: "0 4px 20px rgba(192,57,43,0.4)" }}
              >
                <QrCode className="inline mr-2" size={20} />
                {cameraError ? "Reintentar" : "Activar Cámara"}
              </button>
            </div>
          ) : (
            /* Pantalla de scanner activo */
            <div className="space-y-4">
              {/* Visor QR */}
              <div className="relative rounded-2xl overflow-hidden bg-black"
                style={{ aspectRatio: "1/1" }}>
                <div id="te-qr-reader" className="w-full h-full" />
                {/* Marco decorativo */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative" style={{ width: "65%", height: "65%" }}>
                    {[
                      "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-lg",
                      "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-lg",
                      "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-lg",
                      "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-lg",
                    ].map(cls => (
                      <div key={cls} className={`absolute w-8 h-8 ${cls}`}
                        style={{ borderColor: "#C0392B" }} />
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setView("ready")}
                className="w-full py-3 rounded-xl text-white/60 text-sm hover:text-white border border-white/10 transition-colors"
              >
                ⏹ Detener cámara
              </button>
            </div>
          )}

          {/* Resultado del último scan */}
          {lastResult && (
            <div className="mt-4 rounded-2xl p-4 transition-all"
              style={{ background: resultBg[lastResult.type], border: `2px solid ${resultBorder[lastResult.type]}` }}>
              <div className="flex items-start gap-3">
                <span className="text-3xl leading-none">{resultIcon[lastResult.type]}</span>
                <div className="flex-1">
                  <p className={`font-bold text-sm ${lastResult.type === "already" ? "text-yellow-300 text-base" : "text-white"}`}>
                    {resultTitle[lastResult.type]}
                  </p>
                  {lastResult.studentName && (
                    <p className="text-white font-bold text-lg mt-0.5">{lastResult.studentName}</p>
                  )}
                  {lastResult.belt && <p className="text-white/60 text-xs">{lastResult.belt}</p>}
                  {lastResult.type === "already" && lastResult.arrivedAt && (
                    <p className="text-yellow-200 text-xs mt-1 font-semibold">
                      Registrado a las {new Date(lastResult.arrivedAt).toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit", hour12: true })}
                    </p>
                  )}
                  {lastResult.type === "already" && (
                    <p className="text-yellow-200/70 text-xs mt-0.5">No se puede registrar dos veces el mismo día.</p>
                  )}
                  {lastResult.message && lastResult.type !== "already" && (
                    <p className="text-white/60 text-xs mt-0.5">{lastResult.message}</p>
                  )}
                </div>
                {countdown > 0 && (
                  <span className="text-white/40 text-sm font-mono shrink-0">{countdown}s</span>
                )}
              </div>
            </div>
          )}

          {/* ── Entrada manual ── */}
          {!lastResult && (
            <div className="mt-4 border border-white/10 rounded-2xl overflow-hidden">
              <button
                onClick={() => { setManualOpen(o => !o); setManualError(""); }}
                className="w-full flex items-center justify-center gap-2 py-3 text-white/50 text-sm hover:text-white/80 transition-colors"
              >
                <Search size={14} />
                Ingresar ID manualmente
                <ChevronDown size={14} className={`transition-transform ${manualOpen ? "rotate-180" : ""}`} />
              </button>

              {manualOpen && (
                <div className="px-4 pb-4 space-y-2 border-t border-white/10">
                  <p className="text-white/40 text-xs pt-3">
                    Ingresa el código numérico del alumno (ej: 1001) o su ID completo
                  </p>
                  <input
                    type="text"
                    value={manualInput}
                    onChange={e => { setManualInput(e.target.value); setManualError(""); }}
                    onKeyDown={e => { if (e.key === "Enter") handleManual(); }}
                    placeholder="Código o ID del alumno..."
                    autoComplete="off"
                    className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 border border-white/15 focus:outline-none focus:border-white/40 transition-colors text-center tracking-widest"
                    style={{ background: "rgba(255,255,255,0.05)", fontSize: "16px" }}
                  />
                  {manualError && <p className="text-red-400 text-xs text-center">{manualError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleManual}
                      disabled={manualLoading || !manualInput.trim()}
                      className="flex-1 py-3 rounded-xl font-semibold text-sm disabled:opacity-40 transition-all"
                      style={{ background: "#C0392B", color: "#fff" }}
                    >
                      {manualLoading ? "Buscando..." : "Registrar llegada"}
                    </button>
                    <button
                      onClick={() => { setManualOpen(false); setManualInput(""); setManualError(""); }}
                      className="px-4 py-3 rounded-xl text-white/50 text-sm hover:text-white border border-white/10 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-white/25 text-xs mt-4">
            Apunta la cámara al QR del alumno · El QR es el código impreso en su ficha
          </p>
        </div>
      </div>
    </div>
  );
}
