"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Bell, BellOff, Send, Zap, Users, CheckCircle2,
  AlertCircle, RefreshCw, Smartphone, ToggleLeft, ToggleRight, Mail,
} from "lucide-react";
import { usePushSubscription } from "@/lib/hooks/usePushSubscription";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface PushSettings {
  enabled:               boolean;
  notifyAttendance:      boolean;
  notifyPaymentReminder: boolean;
  notifyNewVideo:        boolean;
  notifyNewEvent:        boolean;
  notifyBirthday:        boolean;
  notifyExamPublished:   boolean;
  notifyExamResult:      boolean;
  notifyExamDeadline:    boolean;
}

interface LogEntry {
  id:          string;
  type:        string;
  title:       string;
  body:        string;
  url:         string | null;
  targetCount: number;
  successCount:number;
  failCount:   number;
  sentBy:      string | null;
  sentAt:      string;
}

interface PushData {
  settings:        PushSettings;
  subscriberCount: number;
  logs:            LogEntry[];
}

const TYPE_LABELS: Record<string, string> = {
  manual:          "📢 Manual",
  attendance:      "✅ Asistencia",
  payment:         "💳 Pago",
  birthday:        "🎂 Cumpleaños",
  video:           "🎥 Video",
  event:           "📅 Evento",
  exam_published:  "📋 Examen publicado",
  exam_result:     "🏆 Resultado examen",
  exam_deadline:   "⚠️ Recordatorio examen",
};

const SETTING_LABELS: { key: keyof PushSettings; label: string; icon: string }[] = [
  { key: "notifyAttendance",      label: "Confirmar asistencia del alumno",             icon: "✅" },
  { key: "notifyPaymentReminder", label: "Recordatorio de pago (3 días antes)",          icon: "💳" },
  { key: "notifyNewVideo",        label: "Nuevo video publicado",                         icon: "🎥" },
  { key: "notifyNewEvent",        label: "Nuevo evento en el dojo",                      icon: "📅" },
  { key: "notifyBirthday",        label: "Cumpleaños del alumno",                        icon: "🎂" },
  { key: "notifyExamPublished",   label: "Convocatoria de examen publicada",             icon: "📋" },
  { key: "notifyExamResult",      label: "Resultados de examen disponibles",             icon: "🏆" },
  { key: "notifyExamDeadline",    label: "Recordatorio: vence plazo de postulación",     icon: "⚠️" },
];

export default function PushSettingsPage() {
  const { state: pushState, subscribe, sendTest } = usePushSubscription();

  const [data,        setData]        = useState<PushData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  const [title,   setTitle]   = useState("");
  const [message, setMessage] = useState("");
  const [url,     setUrl]     = useState("/portal");

  const [testEmail,        setTestEmail]        = useState("");
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult,  setTestEmailResult]  = useState<{ ok: boolean; name?: string; sent?: number; total?: number; error?: string } | null>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/push/settings");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleSetting(key: keyof PushSettings) {
    if (!data) return;
    const next = { ...data.settings, [key]: !data.settings[key] };
    setData(prev => prev ? { ...prev, settings: next } : prev);
    setSaving(true);
    try {
      const res = await fetch("/api/push/settings", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(next),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revertir en caso de error
      setData(prev => prev ? { ...prev, settings: data.settings } : prev);
      showToast("Error al guardar configuración", false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!title.trim() || !message.trim()) return;
    setSendLoading(true);
    try {
      const res = await fetch("/api/push/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: title.trim(), message: message.trim(), url }),
      });
      const d = await res.json() as { sent?: number; total?: number; error?: string; message?: string };
      if (!res.ok) {
        showToast(d.error ?? "Error al enviar", false);
      } else {
        showToast(d.message ?? `✅ Enviado a ${d.sent ?? 0} de ${d.total ?? 0} dispositivos`, true);
        setTitle(""); setMessage(""); setUrl("/portal");
        load();
      }
    } finally {
      setSendLoading(false);
    }
  }

  async function handleTest() {
    setTestLoading(true);
    let ok = false;
    if (pushState !== "subscribed") {
      ok = await subscribe();
    } else {
      ok = await sendTest();
    }
    showToast(ok ? "✅ Notificación de prueba enviada" : "❌ Error — verifica que los permisos estén activos", ok);
    setTestLoading(false);
  }

  async function handleEmailTest() {
    if (!testEmail.trim()) return;
    setTestEmailLoading(true);
    setTestEmailResult(null);
    try {
      const res = await fetch("/api/push/test", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: testEmail.trim() }),
      });
      const d = await res.json() as { ok?: boolean; name?: string; sent?: number; total?: number; error?: string };
      if (!res.ok) {
        setTestEmailResult({ ok: false, error: d.error ?? "Error al enviar" });
      } else {
        setTestEmailResult({ ok: d.ok ?? false, name: d.name, sent: d.sent ?? 0, total: d.total ?? 0 });
      }
    } catch {
      setTestEmailResult({ ok: false, error: "Error de red" });
    } finally {
      setTestEmailLoading(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-dojo-muted" />
      </div>
    );
  }

  const { settings, subscriberCount, logs } = data;
  const totalSent    = logs.reduce((s, l) => s + l.successCount, 0);
  const successRate  = logs.length > 0
    ? Math.round((logs.reduce((s, l) => s + l.successCount, 0) / Math.max(1, logs.reduce((s, l) => s + l.targetCount, 0))) * 100)
    : 0;

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-dojo-white font-display flex items-center gap-2">
            <Bell size={20} className="text-dojo-gold" />
            Notificaciones Push
          </h1>
          <p className="text-sm text-dojo-muted mt-0.5">
            Alertas en tiempo real al celular de los alumnos — sin apps de tienda
          </p>
        </div>
        <button onClick={load} className="p-2 text-dojo-muted hover:text-dojo-white transition-colors" title="Recargar">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
          toast.ok
            ? "bg-green-900/20 border-green-700/50 text-green-300"
            : "bg-red-900/20 border-red-700/50 text-red-300"
        }`}>
          {toast.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-dojo-gold">{subscriberCount}</p>
          <p className="text-xs text-dojo-muted mt-0.5 flex items-center justify-center gap-1">
            <Smartphone size={11} /> Dispositivos activos
          </p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-dojo-white">{totalSent}</p>
          <p className="text-xs text-dojo-muted mt-0.5 flex items-center justify-center gap-1">
            <Send size={11} /> Enviadas (total)
          </p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-green-400">{successRate}%</p>
          <p className="text-xs text-dojo-muted mt-0.5 flex items-center justify-center gap-1">
            <CheckCircle2 size={11} /> Tasa de entrega
          </p>
        </div>
      </div>

      {/* Notif de prueba para el admin */}
      {pushState !== "subscribed" && pushState !== "loading" && pushState !== "unsupported" && (
        <div className="card border-dojo-gold/30 bg-dojo-gold/5">
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-dojo-gold shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-dojo-white">Activa las alertas en este dispositivo</p>
              <p className="text-xs text-dojo-muted">Suscríbete para recibir un push de prueba y verificar que funciona.</p>
            </div>
            <button
              onClick={handleTest}
              disabled={testLoading}
              className="btn-secondary text-xs whitespace-nowrap shrink-0"
            >
              {testLoading ? "..." : "Activar y probar"}
            </button>
          </div>
        </div>
      )}
      {pushState === "subscribed" && (
        <div className="card border-green-700/30">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={16} className="text-green-400 shrink-0" />
            <p className="text-sm text-green-300 flex-1">Este dispositivo tiene notificaciones activas.</p>
            <button onClick={handleTest} disabled={testLoading} className="btn-ghost text-xs shrink-0">
              {testLoading ? "Enviando..." : "Enviar prueba"}
            </button>
          </div>
        </div>
      )}

      {/* Prueba por correo del alumno */}
      <div className="card">
        <h2 className="font-semibold text-dojo-white flex items-center gap-2 mb-3">
          <Mail size={15} className="text-dojo-gold" />
          Probar notificación a un alumno
        </h2>
        <p className="text-xs text-dojo-muted mb-3">
          Ingresa el correo del alumno para verificar que su dispositivo recibe las notificaciones.
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            className="form-input flex-1 text-sm"
            placeholder="correo@ejemplo.com"
            value={testEmail}
            onChange={e => { setTestEmail(e.target.value); setTestEmailResult(null); }}
            onKeyDown={e => { if (e.key === "Enter") void handleEmailTest(); }}
          />
          <button
            onClick={handleEmailTest}
            disabled={testEmailLoading || !testEmail.trim()}
            className="btn-secondary text-xs whitespace-nowrap shrink-0 disabled:opacity-40"
          >
            {testEmailLoading ? "Enviando…" : "Enviar prueba"}
          </button>
        </div>
        {testEmailResult && (
          <div className={`mt-3 flex items-start gap-2 p-3 rounded-lg text-xs border ${
            testEmailResult.ok
              ? "bg-green-900/20 border-green-700/40 text-green-300"
              : "bg-red-900/20 border-red-700/40 text-red-300"
          }`}>
            {testEmailResult.ok
              ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              : <AlertCircle  size={14} className="shrink-0 mt-0.5" />
            }
            <span>
              {testEmailResult.error
                ? testEmailResult.error
                : testEmailResult.ok
                  ? `Enviado a ${testEmailResult.sent} de ${testEmailResult.total} dispositivo${(testEmailResult.total ?? 0) !== 1 ? "s" : ""} de ${testEmailResult.name}`
                  : `${testEmailResult.name} no tiene dispositivos suscritos`
              }
            </span>
          </div>
        )}
      </div>

      {/* Notificaciones automáticas */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-dojo-white flex items-center gap-2">
            <Zap size={15} className="text-dojo-gold" />
            Notificaciones automáticas
          </h2>
          {saving && <span className="text-xs text-dojo-muted animate-pulse">Guardando…</span>}
        </div>

        <div className="space-y-1">
          {SETTING_LABELS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => toggleSetting(key)}
              disabled={saving}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-dojo-border/30 transition-colors text-left disabled:opacity-60"
            >
              <span className="flex items-center gap-2 text-sm text-dojo-white">
                <span className="text-base w-6 text-center">{icon}</span>
                {label}
              </span>
              {settings[key]
                ? <ToggleRight size={22} className="text-green-400 shrink-0" />
                : <ToggleLeft  size={22} className="text-dojo-border shrink-0" />
              }
            </button>
          ))}
        </div>
      </div>

      {/* Envío manual */}
      <div className="card">
        <h2 className="font-semibold text-dojo-white flex items-center gap-2 mb-4">
          <Send size={15} className="text-dojo-gold" />
          Enviar notificación manual
        </h2>
        <div className="space-y-3">
          <div>
            <label className="form-label text-xs">Título <span className="text-dojo-red">*</span></label>
            <input
              className="form-input"
              placeholder="Ej: 🥋 Clase especial hoy a las 5 PM"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={80}
            />
            <p className="text-[11px] text-dojo-muted mt-0.5 text-right">{title.length}/80</p>
          </div>
          <div>
            <label className="form-label text-xs">Mensaje <span className="text-dojo-red">*</span></label>
            <textarea
              className="form-input resize-none"
              rows={3}
              placeholder="Texto de la notificación…"
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={300}
            />
            <p className="text-[11px] text-dojo-muted mt-0.5 text-right">{message.length}/300</p>
          </div>
          <div>
            <label className="form-label text-xs">Al hacer clic ir a</label>
            <select className="form-input" value={url} onChange={e => setUrl(e.target.value)}>
              <option value="/portal">Portal del alumno (inicio)</option>
              <option value="/portal/payments">Portal → Pagos</option>
              <option value="/portal/schedules">Portal → Horarios</option>
              <option value="/portal/events">Portal → Eventos</option>
              <option value="/portal/videos">Portal → Videos</option>
              <option value="/portal/postulaciones">Portal → Exámenes</option>
            </select>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-dojo-muted flex items-center gap-1">
              <Users size={12} />
              Se enviará a <strong className="text-dojo-white">{subscriberCount}</strong> dispositivos de alumnos
            </span>
            <button
              onClick={handleSend}
              disabled={sendLoading || !title.trim() || !message.trim() || subscriberCount === 0}
              className="btn-primary text-sm disabled:opacity-40"
            >
              {sendLoading ? "Enviando…" : `Enviar → ${subscriberCount}`}
            </button>
          </div>
        </div>
      </div>

      {/* Historial */}
      {logs.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-dojo-white flex items-center gap-2 mb-4">
            <Bell size={15} className="text-dojo-gold" />
            Últimos envíos
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-dojo-muted border-b border-dojo-border">
                  <th className="pb-2 font-medium">Tipo</th>
                  <th className="pb-2 font-medium">Mensaje</th>
                  <th className="pb-2 font-medium text-right">Entregado</th>
                  <th className="pb-2 font-medium text-right hidden sm:table-cell">Hace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dojo-border/50">
                {logs.map(log => (
                  <tr key={log.id} className="group">
                    <td className="py-2.5 pr-3">
                      <span className="text-xs font-medium text-dojo-muted whitespace-nowrap">
                        {TYPE_LABELS[log.type] ?? log.type}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <p className="text-dojo-white text-xs font-medium truncate max-w-[180px]">{log.title}</p>
                      <p className="text-dojo-muted text-[11px] truncate max-w-[180px]">{log.body}</p>
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <span className={`text-xs font-semibold ${log.successCount === log.targetCount ? "text-green-400" : log.failCount > 0 ? "text-yellow-400" : "text-dojo-white"}`}>
                        {log.successCount}/{log.targetCount}
                      </span>
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap hidden sm:table-cell">
                      <span className="text-xs text-dojo-muted">
                        {formatDistanceToNow(new Date(log.sentAt), { addSuffix: true, locale: es })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {logs.length === 0 && (
        <div className="card text-center py-10">
          <BellOff size={28} className="text-dojo-muted mx-auto mb-2" />
          <p className="text-sm text-dojo-muted">Aún no se han enviado notificaciones push.</p>
          <p className="text-xs text-dojo-muted/70 mt-1">
            Las notificaciones automáticas aparecerán aquí cuando ocurran eventos.
          </p>
        </div>
      )}
    </div>
  );
}
