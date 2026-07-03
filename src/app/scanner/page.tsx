"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  LogIn, LogOut, QrCode, AlertTriangle, XCircle,
  Clock, ChevronRight, ArrowLeft, ChevronDown, Search, SwitchCamera,
} from "lucide-react";
import { getBeltInfo } from "@/lib/utils";
import Image from "next/image";
import type { Html5Qrcode as Html5QrcodeType } from "html5-qrcode";
import { DisciplineBarScanner } from "@/components/discipline/DisciplineBar";

interface Schedule {
  id: string; name: string; days: string;
  startTime: string; endTime: string; active: boolean;
}

type ScanMode = "entry" | "exit";
type ResultKind = "success" | "not_assigned" | "duplicate" | "error";

interface ScanResult {
  type:      ResultKind;
  student?:  { id: string; studentCode: number | null; fullName: string; photo: string | null; belt: string | null };
  attendanceType?: ScanMode;
  message?:  string;
}

const DAY_MAP = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"];

function parseDays(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

function fmtTime(time: string) {
  const [hPart, mPart] = time.split(":");
  const h = parseInt(hPart ?? "0", 10);
  const m = parseInt(mPart ?? "0", 10);
  if (isNaN(h) || isNaN(m)) return time;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function nowTime() {
  return new Date().toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function ScannerPage() {
  const { status } = useSession();

  const [view,             setView]             = useState<"scheduleSelection" | "cameraReady" | "scanning">("scheduleSelection");
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
  const [cameraError,      setCameraError]      = useState("");
  const [cameraErrorType,  setCameraErrorType]  = useState<"permission" | "busy" | "generic">("generic");
  const [facingMode,       setFacingMode]       = useState<"environment" | "user">("environment");
  // true = usar BarcodeDetector nativo (Chrome/Edge/Safari 17+), false = html5-qrcode
  const [hasNativeDetector, setHasNativeDetector] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────
  const scannerRef      = useRef<Html5QrcodeType | null>(null);
  const isProcessingRef = useRef(false);
  const modeRef         = useRef<ScanMode>("entry");
  const scheduleRef     = useRef<Schedule | null>(null);
  // Native BarcodeDetector
  const videoRef        = useRef<HTMLVideoElement>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const animFrameRef    = useRef<number | null>(null);
  // Cooldown para evitar re-escaneo del mismo QR mientras se muestra el resultado
  const lastScanRef     = useRef(0);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Detectar BarcodeDetector nativo al montar — verificar que qr_code esté soportado
  useEffect(() => {
    if (!("BarcodeDetector" in window)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (window as any).BarcodeDetector.getSupportedFormats()
      .then((fmts: string[]) => setHasNativeDetector(fmts.includes("qr_code")))
      .catch(() => setHasNativeDetector(false));
  }, []);

  // Fetch dojo branding for the header
  // ?logo=1 is safe — API sanitizes base64 and only returns Cloudinary URLs
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/dojo?logo=1")
      .then(r => r.ok ? r.json() : null)
      .then((d: { name?: string; logo?: string | null } | null) => {
        if (!d?.name) return;
        // Validate logo is an absolute https URL before rendering (XSS guard)
        const safeLogo = d.logo && /^https:\/\//i.test(d.logo) ? d.logo : null;
        setDojoInfo({ name: d.name, logo: safeLogo });
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

    // El QR puede contener: número puro (1000), cuid, cardToken, o URL del carnet (/id/<token>).
    // Extraer solo el ID en los tres casos para pasarlo a /api/scan.
    let rawId = decodedText.trim();
    const urlMatch = rawId.match(/\/id\/([^/?#\s]+)\s*$/);
    if (urlMatch) rawId = urlMatch[1];
    const resolvedId = rawId;

    try {
      const scanRes  = await fetch(`/api/scan?id=${encodeURIComponent(resolvedId)}${scheduleParam}`);
      const scanData = await scanRes.json();

      if (scanRes.status === 404) {
        setResult({ type: "error", message: "Este ID no existe" });
        fetch("/api/scanner-log", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "QR_NOT_FOUND", message: `ID: ${resolvedId.slice(0, 30)}`, context: `raw: ${decodedText.slice(0, 60)}` }),
        }).catch(() => {});
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
            source:     "qr",
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

  // ── BarcodeDetector nativo — mejor lectura en superficies curvas ──
  useEffect(() => {
    if (view !== "scanning" || !hasNativeDetector) return;

    let cancelled = false;
    setCameraError("");
    setCameraErrorType("generic");

    async function startNative() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
        });

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        function loop() {
          if (cancelled) return;
          const now = Date.now();
          // Esperar cooldown de 5s tras el último escaneo para no re-leer el mismo QR
          if (isProcessingRef.current || !video || video.readyState < 2 || (now - lastScanRef.current < 5000)) {
            animFrameRef.current = requestAnimationFrame(loop);
            return;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          detector.detect(video).then((codes: any[]) => {
            if (codes.length > 0 && codes[0]?.rawValue) {
              lastScanRef.current = Date.now(); // cooldown desde este momento
              handleScan(codes[0].rawValue as string);
            }
          }).catch(() => {/* errores de frame son normales */}).finally(() => {
            if (!cancelled) animFrameRef.current = requestAnimationFrame(loop);
          });
        }

        animFrameRef.current = requestAnimationFrame(loop);
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        const msg  = (err instanceof Error ? err.message : String(err)).toLowerCase();

        fetch("/api/scanner-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "CAMERA_FAILED", name, message: msg.slice(0, 200), context: navigator.userAgent.slice(0, 200) }),
        }).catch(() => {});

        if (msg.includes("dismissed")) {
          setCameraErrorType("generic");
          setCameraError("Toca «Activar Cámara» y acepta el permiso cuando te lo solicite.");
          setView("cameraReady");
        } else if (name === "NotAllowedError" || msg.includes("permission") || msg.includes("notallowed") || msg.includes("not allowed")) {
          setCameraErrorType("permission");
          setCameraError("El acceso a la cámara fue denegado. Actívalo en la configuración del navegador y recarga.");
        } else {
          // Cualquier otro error (qr_code no soportado, dispositivo ocupado, etc.)
          // → caer silenciosamente a html5-qrcode en lugar de mostrar error
          setHasNativeDetector(false);
        }
      }
    }

    startNative();

    return () => {
      cancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [view, hasNativeDetector, facingMode, handleScan]);

  // ── html5-qrcode — fallback para navegadores sin BarcodeDetector ──
  useEffect(() => {
    if (view !== "scanning" || hasNativeDetector) return;

    let cancelled = false;
    setCameraError("");
    setCameraErrorType("generic");

    import("html5-qrcode").then(async ({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
      if (cancelled) return;

      // ── Pre-flight con getUserMedia nativo ──────────────────────────────────
      // html5-qrcode v2.x lanza objetos personalizados {errorMessage, type}, no
      // DOMException, por lo que la detección del tipo de error es imposible desde
      // su .catch(). Verificamos el acceso a cámara aquí con getUserMedia directo
      // (que sí lanza DOMException con .name correcto) antes de ceder el control.
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraErrorType("permission");
        setCameraError("La cámara requiere HTTPS. Accede desde la URL principal de la app.");
        return;
      }
      try {
        const ts = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        if (cancelled) { ts.getTracks().forEach(t => t.stop()); return; }
        ts.getTracks().forEach(t => t.stop());
        // Pausa mínima para que el dispositivo libere el hardware antes de html5-qrcode
        await new Promise<void>(r => setTimeout(r, 120));
        if (cancelled) return;
      } catch (preErr) {
        if (cancelled) return;
        const name = preErr instanceof DOMException ? preErr.name : "";
        const msg  = (preErr instanceof Error ? preErr.message : String(preErr)).toLowerCase();
        fetch("/api/scanner-log", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "CAMERA_PREFLIGHT_FAILED", name, message: msg.slice(0, 200), context: navigator.userAgent.slice(0, 200) }),
        }).catch(() => {});
        if (name === "NotAllowedError" || msg.includes("notallowed") || msg.includes("permission denied")) {
          setCameraErrorType("permission");
          setCameraError("El acceso a la cámara fue denegado. Actívalo en la configuración del navegador y recarga.");
        } else if (name === "NotReadableError") {
          setCameraErrorType("busy");
          setCameraError("La cámara está siendo usada por otra aplicación. Ciérrala e intenta de nuevo.");
          setManualOpen(true);
        } else if (name === "NotFoundError" || name === "OverconstrainedError" || msg.includes("no camera") || msg.includes("not found")) {
          setCameraErrorType("generic");
          setCameraError("No se encontró la cámara seleccionada. Intenta con la otra cámara.");
          setManualOpen(true);
        } else {
          setCameraErrorType("generic");
          setCameraError("La cámara no pudo iniciarse. Puedes marcar con el código del alumno.");
          setManualOpen(true);
        }
        return;
      }

      // ── Cámara accesible — iniciar html5-qrcode ─────────────────────────────
      const qr = new Html5Qrcode("qr-reader", {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = qr;

      qr.start(
        { facingMode },
        {
          fps: 22,
          qrbox: (w: number, h: number) => {
            // 70% del lado menor — zona más amplia para QR pequeños y superficies difíciles
            const side = Math.floor(Math.min(w, h) * 0.70);
            return { width: side, height: side };
          },
          // Para cámara frontal desactivamos el flip interno de html5-qrcode (está
          // roto en v2.3.8: aplica el transform pero no redibuja el frame antes de
          // volver a escanear, por lo que los píxeles nunca cambian). En su lugar
          // parcheamos drawImage directamente para que cada frame quede espejado.
          disableFlip: facingMode === "user",
        },
        (decoded) => { handleScan(decoded); },
        () => { /* scan failures are normal between frames — ignore */ },
      ).then(() => {
        // Parche de cámara frontal: reemplaza drawImage en el canvas interno de
        // html5-qrcode para escribir cada frame espejado horizontalmente.
        if (facingMode !== "user" || cancelled) return;
        setTimeout(() => {
          if (cancelled) return;
          const canvas = document.querySelector<HTMLCanvasElement>("#qr-reader canvas");
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          const origDraw = ctx.drawImage.bind(ctx);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (ctx as any).drawImage = function(this: unknown, ...args: any[]) {
            ctx.save();
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (origDraw as any)(...args);
            ctx.restore();
          };
        }, 100);
      }).catch(() => {
        // Pre-flight pasó pero html5-qrcode aún falló (muy raro)
        if (cancelled) return;
        setCameraErrorType("generic");
        setCameraError("La cámara no pudo iniciarse. Puedes marcar con el código del alumno.");
        setManualOpen(true);
      });
    });

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current.stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {})
          .finally(() => { scannerRef.current = null; });
      }
    };
  }, [view, hasNativeDetector, handleScan, facingMode]);

  useEffect(() => {
    if (!result) { setCountdown(0); return; }
    const autoSecs = (result.type === "success") ? 4 : 3;
    setCountdown(autoSecs);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          lastScanRef.current = 0; // permitir siguiente escaneo inmediatamente
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
    lastScanRef.current = 0; // permitir siguiente escaneo inmediatamente
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
          body:    JSON.stringify({ studentId: scanData.id, type: currentMode, scheduleId: currentSchedule?.id ?? null, source: "manual" }),
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
    setCameraError("");
    // Go to pre-permission screen first so the user taps intentionally
    setView("cameraReady");
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
    <header className="h-14 flex items-center justify-between px-4 bg-dojo-dark border-b border-dojo-border shrink-0 gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Dojo logo → app logo fallback */}
        <div className="w-8 h-8 rounded-lg overflow-hidden bg-dojo-red flex items-center justify-center shrink-0">
          {dojoInfo?.logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={dojoInfo.logo} alt={dojoInfo.name} className="w-full h-full object-contain" />
            : <Image src="/logo.png" alt="Dojo Master" width={32} height={32} className="object-contain" />
          }
        </div>
        <span className="font-display text-dojo-white text-sm font-bold tracking-wide truncate max-w-[140px]">
          {dojoInfo?.name ?? "DOJO MASTER"}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-dojo-muted font-mono">{nowTime()}</span>
        {/* Back to dashboard — no re-login needed */}
        <a
          href="/dashboard"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-dojo-border text-dojo-muted hover:text-dojo-white hover:border-dojo-border/80 transition-colors"
          title="Volver al menú principal"
        >
          <ArrowLeft size={13} />
          Menú
        </a>
      </div>
    </header>
  );

  // ── Pre-permission screen ────────────────────────────────────────
  if (view === "cameraReady") {
    return (
      <div className="min-h-screen flex flex-col bg-dojo-darker select-none">
        {Header}
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8 text-center">
          {/* Camera icon */}
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-dojo-red/15 border-2 border-dojo-red/30 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-dojo-red/20 flex items-center justify-center">
                <QrCode size={42} className="text-dojo-red" />
              </div>
            </div>
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-full border-2 border-dojo-red/20 animate-ping" />
          </div>

          {/* Text */}
          <div className="space-y-2">
            <p className="font-display text-dojo-white text-xl font-bold">
              {selectedSchedule?.name ?? "Marcación Libre"}
            </p>
            {cameraError && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-yellow-900/40 border border-yellow-700/50 max-w-xs mx-auto">
                <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-yellow-200 text-sm leading-snug">{cameraError}</p>
              </div>
            )}
            <p className="text-dojo-muted/60 text-xs">
              Solo se usará para leer códigos QR — no se graba ni almacena nada.
            </p>
          </div>

          {/* Camera selector */}
          <div className="w-full max-w-xs space-y-2">
            <p className="text-dojo-muted text-xs uppercase tracking-wider font-semibold">Selecciona la cámara</p>
            <div className="flex rounded-2xl overflow-hidden border border-dojo-border bg-dojo-dark">
              <button
                type="button"
                onClick={() => setFacingMode("environment")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold font-display tracking-wide transition-all duration-200 ${
                  facingMode === "environment" ? "bg-dojo-red text-white" : "text-dojo-muted hover:text-dojo-white"
                }`}
              >
                <SwitchCamera size={16} />
                Trasera
              </button>
              <div className="w-px bg-dojo-border" />
              <button
                type="button"
                onClick={() => setFacingMode("user")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold font-display tracking-wide transition-all duration-200 ${
                  facingMode === "user" ? "bg-dojo-red text-white" : "text-dojo-muted hover:text-dojo-white"
                }`}
              >
                <SwitchCamera size={16} className="scale-x-[-1]" />
                Frontal
              </button>
            </div>
          </div>

          {/* Main CTA */}
          <div className="w-full max-w-xs space-y-3">
            <button
              onClick={() => { setCameraError(""); setView("scanning"); }}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-display font-bold text-lg tracking-wide transition-all active:scale-95"
              style={{ background: "#C0392B", color: "#fff", boxShadow: "0 4px 20px rgba(192,57,43,0.4)" }}
            >
              <QrCode size={22} />
              {cameraError ? "Reintentar" : "Escanear"}
            </button>

            <button
              onClick={() => { setCameraError(""); setView("scheduleSelection"); }}
              className="w-full py-3 rounded-xl text-dojo-muted text-sm hover:text-dojo-white transition-colors"
            >
              ← Volver a turnos
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          onClick={() => {
            const qr = scannerRef.current;
            if (qr) {
              qr.stop().then(() => qr.clear()).catch(() => {});
              scannerRef.current = null;
            }
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            setView("scheduleSelection");
          }}
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
        {/* Camera error — show how to enable permissions */}
        {/* Error de cámara — compacto para no-permiso, instrucciones solo para permiso denegado */}
        {cameraError && cameraErrorType !== "permission" && (
          <div className="mx-4 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-900/30 border border-amber-700/40">
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
            <p className="flex-1 text-amber-200 text-xs leading-snug">{cameraError}</p>
            <button
              onClick={() => {
                setCameraError("");
                setCameraErrorType("generic");
                setView("cameraReady");
              }}
              className="text-xs font-semibold text-amber-300 underline underline-offset-2 shrink-0 whitespace-nowrap"
            >
              Reintentar
            </button>
          </div>
        )}

        {cameraError && cameraErrorType === "permission" && (
          <div className="mx-4 mt-4 space-y-3">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-900/30 border border-red-800/50">
              <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 text-sm font-semibold">Permiso de cámara denegado</p>
                <p className="text-red-300/80 text-xs mt-0.5">{cameraError}</p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-dojo-dark border border-dojo-border space-y-3">
              <p className="text-dojo-white text-xs font-semibold uppercase tracking-wider">
                📋 Cómo activar el permiso de cámara
              </p>
              <div className="space-y-1">
                <p className="text-dojo-gold text-xs font-semibold">Chrome (Android)</p>
                <ol className="text-dojo-muted text-xs space-y-0.5 pl-3 list-decimal">
                  <li>Toca el ícono 🔒 o ⓘ en la barra de dirección</li>
                  <li>Selecciona <span className="text-dojo-white">"Permisos del sitio"</span></li>
                  <li>Activa <span className="text-dojo-white">"Cámara"</span></li>
                  <li>Recarga la página</li>
                </ol>
              </div>
              <div className="space-y-1">
                <p className="text-dojo-gold text-xs font-semibold">Safari (iPhone / iPad)</p>
                <ol className="text-dojo-muted text-xs space-y-0.5 pl-3 list-decimal">
                  <li>Ve a <span className="text-dojo-white">Ajustes → Safari</span></li>
                  <li>Busca <span className="text-dojo-white">"Cámara"</span></li>
                  <li>Cambia a <span className="text-dojo-white">"Permitir"</span></li>
                  <li>Vuelve y recarga la página</li>
                </ol>
              </div>
              <div className="space-y-1">
                <p className="text-dojo-gold text-xs font-semibold">Firefox (Android)</p>
                <ol className="text-dojo-muted text-xs space-y-0.5 pl-3 list-decimal">
                  <li>Toca los <span className="text-dojo-white">3 puntos → Configuración del sitio</span></li>
                  <li>Activa <span className="text-dojo-white">"Cámara"</span></li>
                  <li>Recarga la página</li>
                </ol>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary w-full justify-center mt-2"
              >
                🔄 Recargar página
              </button>
            </div>
            <p className="text-xs text-dojo-muted text-center">
              También puedes usar la entrada manual ↓
            </p>
          </div>
        )}

        {/* ── Área de cámara — oculta cuando hay error ── */}
        {!cameraError && (
          hasNativeDetector ? (
            // BarcodeDetector nativo: video con max-height controlado por CSS
            <div className="relative w-full bg-black max-h-[55vh] md:max-h-[70vh]">
              <video
                ref={videoRef}
                className={`w-full object-cover max-h-[55vh] md:max-h-[70vh]${facingMode === "user" ? " scale-x-[-1]" : ""}`}
                style={{ display: "block" }}
                playsInline
                muted
              />
              {/* Visor de encuadre — guía visual para posicionar el QR */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {/* min() adapta el marco al ancho real del visor: ~65% en móvil, tope 460px en tablet */}
                <div className="relative" style={{ width: "min(65vw, 460px)", height: "min(65vw, 460px)" }}>
                  {/* Esquinas: 18% del marco para mantener proporción en cualquier tamaño */}
                  <div className="absolute top-0 left-0 border-t-[3px] border-l-[3px] border-dojo-red" style={{ width: "18%", height: "18%" }} />
                  <div className="absolute top-0 right-0 border-t-[3px] border-r-[3px] border-dojo-red" style={{ width: "18%", height: "18%" }} />
                  <div className="absolute bottom-0 left-0 border-b-[3px] border-l-[3px] border-dojo-red" style={{ width: "18%", height: "18%" }} />
                  <div className="absolute bottom-0 right-0 border-b-[3px] border-r-[3px] border-dojo-red" style={{ width: "18%", height: "18%" }} />
                </div>
              </div>
            </div>
          ) : (
            // html5-qrcode fallback: contenedor con altura máxima para tablet/PC
            <div className="w-full overflow-hidden max-h-[55vh] md:max-h-[70vh]">
              <div id="qr-reader" className="w-full" />
            </div>
          )
        )}

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
                <div className="w-28 h-28 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-2xl overflow-hidden bg-dojo-border flex items-center justify-center shadow-lg">
                  {result.student.photo ? (
                    <Image
                      src={result.student.photo} alt="foto"
                      width={384} height={384}
                      className="object-cover w-full h-full"
                      unoptimized
                    />
                  ) : (
                    <span className="font-display text-4xl md:text-8xl lg:text-9xl font-bold text-dojo-gold">
                      {result.student.fullName.split(" ").slice(0,2).map(w => w[0]).join("")}
                    </span>
                  )}
                </div>
                <div className="text-center">
                  <p className="font-display text-white text-2xl md:text-3xl font-bold leading-tight">
                    {result.student.fullName}
                  </p>
                  <p className="font-mono text-xs md:text-sm text-white/60 tracking-widest mt-1">
                    #{result.student.studentCode ?? "—"}
                  </p>
                </div>
                {belt && (
                  <div
                    className="px-4 py-1.5 rounded-full border text-sm md:text-base font-semibold flex items-center gap-2"
                    style={{ backgroundColor: beltBg, color: beltColor, borderColor: `${belt.hex}66` }}
                  >
                    <span className="w-3 h-3 md:w-4 md:h-4 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: belt.hex }} />
                    Cinta {belt.label}
                  </div>
                )}

                {/* Disciplina del mes — solo en entrada exitosa */}
                {result.type === "success" && result.attendanceType === "entry" && result.student?.id && (
                  <div className="w-full max-w-xs mt-1">
                    <DisciplineBarScanner studentId={result.student.id} />
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
