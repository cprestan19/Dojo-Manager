"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  LogIn, LogOut, QrCode, AlertTriangle, XCircle,
  Clock, ChevronRight, ArrowLeft, ChevronDown, Search,
} from "lucide-react";
import { getBeltInfo } from "@/lib/utils";
import Image from "next/image";
import type { Html5QrcodeScanner as ScannerType } from "html5-qrcode";

interface Schedule {
  id: string; name: string; days: string;
  startTime: string; endTime: string; active: boolean;
}

type ScanMode = "entry" | "exit";
type ResultKind = "success" | "not_assigned" | "duplicate" | "error";

interface ScanResult {
  type:      ResultKind;
  student?:  { id: string; fullName: string; photo: string | null; belt: string | null };
  attendanceType?: ScanMode;
  message?:  string;
}

const DAY_MAP = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"];

function parseDays(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

function fmtTime(time: string) { return time; }

function nowTime() {
  return new Date().toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit" });
}

export default function ScannerPage() {
  const { status } = useSession();

  const [view,             setView]             = useState<"scheduleSelection" | "scanning">("scheduleSelection");
  const [mode,             setMode]             = useState<ScanMode>("entry");
  const [schedules,        setSchedules]        = useState<Schedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [result,           setResult]           = useState<ScanResult | null>(null);
  const [loadingSch,       setLoadingSch]       = useState(false);
  const [countdown,        setCountdown]        = useState(0);
  const [manualOpen,       setManualOpen]       = useState(false);
  const [manualInput,      setManualInput]      = useState("");
  const [manualError,      setManualError]      = useState("");
  const [manualLoading,    setManualLoading]    = useState(false);
  const [dojoInfo,         setDojoInfo]         = useState<{ name: string; logo: string | null } | null>(null);

  const scannerRef      = useRef<ScannerType | null>(null);
  const isProcessingRef = useRef(false);
  const modeRef         = useRef<ScanMode>("entry");
  const scheduleRef     = useRef<Schedule | null>(null);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Fetch dojo branding for the header
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/dojo")
      .then(r => r.ok ? r.json() : null)
      .then((d: { name?: string; logo?: string | null } | null) => {
        if (d?.name) setDojoInfo({ name: d.name, logo: d.logo?.startsWith("http") ? d.logo : null });
      })
      .catch(() => {});
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoadingSch(true);
    fetch("/api/schedules")
      .then(r => r.ok ? r.json() : [])
      .then((all: Schedule[]) => {
        const today = DAY_MAP[new Date().getDay()];
        setSchedules(all.filter(s => s.active && parseDays(s.days).includes(today)));
      })
      .finally(() => setLoadingSch(false));
  }, [status]);

  const handleScan = useCallback(async (decodedText: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    try { await scannerRef.current?.pause(true); } catch { /* already paused or not scanning */ }

    const currentMode     = modeRef.current;
    const currentSchedule = scheduleRef.current;
    const scheduleParam   = currentSchedule ? `&scheduleId=${currentSchedule.id}` : "";

    try {
      const scanRes  = await fetch(`/api/scan?id=${encodeURIComponent(decodedText)}${scheduleParam}`);
      const scanData = await scanRes.json();

      if (scanRes.status === 404) {
        setResult({ type: "error", message: "Este ID no existe" });
      } else if (scanData.code === "NOT_ASSIGNED") {
        setResult({ type: "not_assigned", student: scanData.student });
      } else if (!scanRes.ok) {
        setResult({ type: "error", message: scanData.error ?? "Error al verificar alumno" });
      } else {
        const attRes  = await fetch("/api/attendance", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            studentId:  scanData.id,
            type:       currentMode,
            scheduleId: currentSchedule?.id ?? null,
          }),
        });
        const attData = await attRes.json();
        setResult({
          type:          attData.duplicate ? "duplicate" : "success",
          student:       attData.student,
          attendanceType: currentMode,
        });
      }
    } catch {
      setResult({ type: "error", message: "Sin conexión con el servidor" });
    }

    isProcessingRef.current = false;
  }, []);

  useEffect(() => {
    if (view !== "scanning") return;

    let cancelled = false;
    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
      if (cancelled) return;
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
        false
      );
      scanner.render(
        (decoded) => { handleScan(decoded); },
        () => {}
      );
      scannerRef.current = scanner;
    });
    return () => {
      cancelled = true;
      scannerRef.current?.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [view, handleScan]);

  useEffect(() => {
    if (!result) { setCountdown(0); return; }
    const autoSecs = (result.type === "success") ? 5 : 3;
    setCountdown(autoSecs);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setResult(null);
          try { scannerRef.current?.resume(); } catch { /* scanner may have been cleared */ }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [result]);

  function next() {
    setResult(null);
    try { scannerRef.current?.resume(); } catch { /* scanner may have been cleared */ }
  }

  async function handleManualSearch() {
    const val = manualInput.trim();
    if (!val) { setManualError("Ingrese un ID válido"); return; }
    setManualError("");
    setManualLoading(true);
    isProcessingRef.current = true;
    try { await scannerRef.current?.pause(true); } catch { /* already paused or not scanning */ }

    const currentMode     = modeRef.current;
    const currentSchedule = scheduleRef.current;
    const scheduleParam   = currentSchedule ? `&scheduleId=${currentSchedule.id}` : "";

    try {
      let scanRes  = await fetch(`/api/scan?id=${encodeURIComponent(val)}${scheduleParam}`);
      let scanData = await scanRes.json();

      if (scanRes.status === 404) {
        const searchRes = await fetch(`/api/students?search=${encodeURIComponent(val)}&active=true`);
        if (searchRes.ok) {
          const list = await searchRes.json();
          if (list.length === 1) {
            scanRes  = await fetch(`/api/scan?id=${encodeURIComponent(list[0].id)}${scheduleParam}`);
            scanData = await scanRes.json();
          } else {
            setManualError("Este ID no existe");
            setManualLoading(false);
            isProcessingRef.current = false;
            scannerRef.current?.resume();
            return;
          }
        } else {
          setManualError("Este ID no existe");
          setManualLoading(false);
          isProcessingRef.current = false;
          scannerRef.current?.resume();
          return;
        }
      }

      if (scanRes.status === 404) {
        setResult({ type: "error", message: "Este ID no existe" });
      } else if (scanData.code === "NOT_ASSIGNED") {
        setResult({ type: "not_assigned", student: scanData.student });
      } else if (!scanRes.ok) {
        setResult({ type: "error", message: scanData.error ?? "Error al verificar alumno" });
      } else {
        const attRes  = await fetch("/api/attendance", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ studentId: scanData.id, type: currentMode, scheduleId: currentSchedule?.id ?? null }),
        });
        const attData = await attRes.json();
        setResult({
          type:           attData.duplicate ? "duplicate" : "success",
          student:        attData.student,
          attendanceType: currentMode,
        });
      }
      setManualOpen(false);
      setManualInput("");
    } catch {
      setResult({ type: "error", message: "Sin conexión con el servidor" });
    }

    isProcessingRef.current = false;
    setManualLoading(false);
  }

  function goToScan(schedule: Schedule | null) {
    setSelectedSchedule(schedule);
    scheduleRef.current = schedule;
    setResult(null);
    setView("scanning");
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dojo-darker">
        <div className="w-10 h-10 rounded-full border-4 border-dojo-red border-t-transparent animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-dojo-darker px-6 text-center">
        <div className="w-20 h-20 bg-dojo-red/20 border-2 border-dojo-red/40 rounded-3xl flex items-center justify-center overflow-hidden">
          <Image src="/logo.png" alt="Dojo Master" width={64} height={64} className="object-contain" />
        </div>
        <div>
          <p className="font-display text-dojo-white text-xl font-bold">Sesión requerida</p>
          <p className="text-dojo-muted text-sm mt-2">Inicia sesión para usar el scanner.</p>
        </div>
        <a href="/login" className="btn-primary px-8 py-3">Iniciar sesión</a>
      </div>
    );
  }

  const Header = (
    <header className="h-14 flex items-center justify-between px-4 bg-dojo-dark border-b border-dojo-border shrink-0">
      <div className="flex items-center gap-2.5">
        {/* Dojo logo → app logo fallback */}
        <div className="w-8 h-8 rounded-lg overflow-hidden bg-dojo-red flex items-center justify-center shrink-0">
          {dojoInfo?.logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={dojoInfo.logo} alt={dojoInfo.name} className="w-full h-full object-contain" />
            : <Image src="/logo.png" alt="Dojo Master" width={32} height={32} className="object-contain" />
          }
        </div>
        <span className="font-display text-dojo-white text-sm font-bold tracking-wide truncate max-w-[180px]">
          {dojoInfo?.name ?? "DOJO MASTER"}
        </span>
      </div>
      <span className="text-xs text-dojo-muted font-mono shrink-0">{nowTime()}</span>
    </header>
  );

  if (view === "scheduleSelection") {
    return (
      <div className="min-h-screen flex flex-col bg-dojo-darker select-none" style={{ touchAction: "manipulation" }}>
        {Header}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
          <div className="mb-4">
            <h2 className="font-display text-dojo-white text-lg font-bold tracking-wide">Turnos de Hoy</h2>
            <p className="text-dojo-muted text-sm mt-0.5 capitalize">
              {new Date().toLocaleDateString("es-PA", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>

          {loadingSch && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-4 border-dojo-red border-t-transparent animate-spin" />
            </div>
          )}

          {!loadingSch && schedules.length === 0 && (
            <div className="text-center py-12 text-dojo-muted">
              <Clock size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay clases programadas para hoy.</p>
            </div>
          )}

          {!loadingSch && schedules.map(s => (
            <button
              key={s.id}
              onClick={() => goToScan(s)}
              className="w-full flex items-center justify-between p-4 bg-dojo-dark border border-dojo-border rounded-2xl active:bg-dojo-border transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-dojo-red/20 rounded-xl flex items-center justify-center shrink-0">
                  <Clock size={18} className="text-dojo-red" />
                </div>
                <div>
                  <p className="font-semibold text-dojo-white text-sm">{s.name}</p>
                  <p className="text-dojo-gold font-mono text-xs mt-0.5">
                    {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-dojo-muted shrink-0" />
            </button>
          ))}

          {!loadingSch && (
            <button
              onClick={() => goToScan(null)}
              className="w-full flex items-center justify-between p-4 bg-dojo-dark border border-dojo-border rounded-2xl active:bg-dojo-border transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-dojo-border rounded-xl flex items-center justify-center shrink-0">
                  <QrCode size={18} className="text-dojo-muted" />
                </div>
                <div>
                  <p className="font-semibold text-dojo-muted text-sm">Continuar sin clase</p>
                  <p className="text-dojo-muted text-xs mt-0.5">Escanear sin asignar turno</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-dojo-muted shrink-0" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const belt      = result?.student?.belt ? getBeltInfo(result.student.belt) : null;
  const beltBg    = belt ? `${belt.hex}33` : "transparent";
  const beltColor = belt ? (belt.hex === "#FFFFFF" ? "#CCC" : belt.textColor) : "#CCC";

  const resultBg =
    result?.type === "success"
      ? result.attendanceType === "entry" ? "#064e3b" : "#450a0a"
      : result?.type === "duplicate"
      ? "#451a03"
      : "#450a0a";

  return (
    <div className="min-h-screen flex flex-col bg-dojo-darker select-none" style={{ touchAction: "manipulation" }}>
      {Header}

      <div className="bg-dojo-dark border-b border-dojo-border px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => { scannerRef.current?.clear().catch(() => {}); setView("scheduleSelection"); }}
          className="p-1.5 rounded-lg hover:bg-dojo-border transition-colors"
        >
          <ArrowLeft size={18} className="text-dojo-muted" />
        </button>
        <p className="font-display text-dojo-white text-sm font-bold flex-1 truncate">
          {selectedSchedule?.name ?? "Marcación Libre"}
        </p>
      </div>

      <div className="px-4 pt-4 pb-2 shrink-0">
        <div className="flex rounded-2xl overflow-hidden border border-dojo-border bg-dojo-dark">
          <button
            onClick={() => setMode("entry")}
            className={`flex-1 flex items-center justify-center gap-2 py-4 text-base font-bold font-display tracking-wide transition-all duration-200 ${
              mode === "entry" ? "bg-green-700 text-white" : "text-dojo-muted hover:text-dojo-white"
            }`}
          >
            <LogIn size={20} /> ENTRADA
          </button>
          <div className="w-px bg-dojo-border" />
          <button
            onClick={() => setMode("exit")}
            className={`flex-1 flex items-center justify-center gap-2 py-4 text-base font-bold font-display tracking-wide transition-all duration-200 ${
              mode === "exit" ? "bg-red-700 text-white" : "text-dojo-muted hover:text-dojo-white"
            }`}
          >
            <LogOut size={20} /> SALIDA
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative overflow-y-auto">
        <div id="qr-reader" className="w-full" />

        {!result && (
          <div className="px-4 py-3 border-t border-dojo-border bg-dojo-dark">
            <button
              onClick={() => { setManualOpen(o => !o); setManualError(""); }}
              className="flex items-center gap-2 text-dojo-muted text-sm w-full justify-center"
            >
              <Search size={14} />
              Ingresar ID manualmente
              <ChevronDown size={14} className={manualOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
            {manualOpen && (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleManualSearch(); }}
                  placeholder="Ingrese el ID del alumno..."
                  autoComplete="off" autoCorrect="off" spellCheck={false}
                  className="form-input w-full text-center tracking-widest uppercase"
                  style={{ fontSize: "16px" }}
                />
                {manualError && <p className="text-red-400 text-xs text-center">{manualError}</p>}
                <p className="text-xs text-dojo-muted text-center">
                  El ID es el código numérico del alumno o su código único
                </p>
                <button
                  onClick={handleManualSearch}
                  disabled={manualLoading}
                  className="btn-primary w-full justify-center"
                >
                  {manualLoading ? "Buscando..." : "Buscar y Marcar"}
                </button>
                <button
                  onClick={() => { setManualOpen(false); setManualInput(""); setManualError(""); }}
                  className="text-xs text-dojo-muted w-full text-center py-1"
                >
                  Cancelar ✕
                </button>
              </div>
            )}
          </div>
        )}

        {result && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-between px-6 py-8 z-10"
            style={{ backgroundColor: resultBg }}
          >
            <div className="w-full text-center pt-4">
              {result.type === "success" && (
                <p className="font-display text-white text-lg font-bold tracking-wide">
                  {result.attendanceType === "entry" ? "✓ ENTRADA REGISTRADA" : "✓ SALIDA REGISTRADA"}
                </p>
              )}
              {result.type === "not_assigned" && (
                <div className="flex flex-col items-center gap-3">
                  <XCircle size={64} className="text-red-400" />
                  <p className="font-display text-white text-lg font-bold">ALUMNO NO ASIGNADO A ESTA CLASE</p>
                </div>
              )}
              {result.type === "duplicate" && (
                <div className="flex flex-col items-center gap-3">
                  <AlertTriangle size={64} className="text-yellow-400" />
                  <p className="font-display text-yellow-300 text-lg font-bold">YA REGISTRADO RECIENTEMENTE</p>
                </div>
              )}
              {result.type === "error" && (
                <div className="flex flex-col items-center gap-3">
                  <XCircle size={64} className="text-red-400" />
                  <p className="font-display text-white text-lg font-bold">{result.message ?? "Error"}</p>
                </div>
              )}
            </div>

            {result.student && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-28 h-28 rounded-2xl overflow-hidden bg-dojo-border flex items-center justify-center shadow-lg">
                  {result.student.photo ? (
                    <Image
                      src={result.student.photo} alt="foto"
                      width={112} height={112}
                      className="object-cover w-full h-full"
                      unoptimized
                    />
                  ) : (
                    <span className="font-display text-4xl font-bold text-dojo-gold">
                      {result.student.fullName.split(" ").slice(0,2).map(w => w[0]).join("")}
                    </span>
                  )}
                </div>
                <div className="text-center">
                  <p className="font-display text-white text-2xl font-bold leading-tight">
                    {result.student.fullName}
                  </p>
                  <p className="font-mono text-xs text-white/60 tracking-widest mt-1">
                    ID · {result.student.id.slice(-8).toUpperCase()}
                  </p>
                </div>
                {belt && (
                  <div
                    className="px-4 py-1.5 rounded-full border text-sm font-semibold flex items-center gap-2"
                    style={{ backgroundColor: beltBg, color: beltColor, borderColor: `${belt.hex}66` }}
                  >
                    <span className="w-3 h-3 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: belt.hex }} />
                    Cinta {belt.label}
                  </div>
                )}
              </div>
            )}

            {result.type === "success" && (
              <button
                onClick={next}
                className="w-full max-w-xs py-4 bg-white/20 hover:bg-white/30 rounded-2xl font-display font-bold text-white text-lg tracking-wide transition-colors"
              >
                SIGUIENTE ▶ ({countdown})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
