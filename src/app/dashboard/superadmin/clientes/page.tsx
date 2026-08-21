"use client";
import { useState, useEffect, useCallback } from "react";
import {
  PhoneCall, RefreshCw, Search, CheckCircle, Clock, Send,
  AlertTriangle, MessageSquarePlus, ChevronDown, ChevronUp, Power, Rocket,
  FileText, Eye, CheckCheck, Mail, Users, Calendar, ShieldCheck, ShieldOff, Bot,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DojoOption { id: string; name: string; slug: string; }

interface LifecycleDojoInfo {
  name: string; phone: string | null; email: string | null; active: boolean;
  whatsappOptIn: boolean; whatsappOptOutDate: string | null; createdAt: string;
  _count: { students: number };
}

interface LifecycleMessage {
  id: string; dojoId: string; type: string; channel: string;
  templateName: string | null; status: string; recipientPhone: string | null;
  errorDetail: string | null; note: string | null; metaMessageId: string | null;
  sentAt: string | null; createdAt: string;
  dojo: LifecycleDojoInfo;
}

const TYPE_CFG: Record<string, { label: string; color: string }> = {
  WELCOME:           { label: "Bienvenida",          color: "text-green-400 bg-green-900/20"  },
  HELP_NO_STUDENTS:  { label: "Ayuda · sin alumnos",  color: "text-orange-400 bg-orange-900/20" },
  FOLLOWUP:          { label: "Seguimiento",          color: "text-blue-400 bg-blue-900/20"    },
  LAST_ATTEMPT:      { label: "Último intento",       color: "text-red-400 bg-red-900/20"      },
  REACTIVATION:      { label: "Reactivación",         color: "text-purple-400 bg-purple-900/20" },
  MANUAL:            { label: "Manual",               color: "text-dojo-muted bg-dojo-border/30" },
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "Pendiente",  color: "badge-yellow" },
  SENT:      { label: "Enviado",    color: "badge-blue"   },
  DELIVERED: { label: "Entregado",  color: "badge-blue"   },
  READ:      { label: "Leído",     color: "badge-green"  },
  FAILED:    { label: "Fallido",    color: "badge-red"    },
};

// ── Referencia de templates — para no tener que abrir Meta cada vez ────────
interface TemplateInfo {
  type: string; name: string; category: string; trigger: string;
  header?: string; body: string; buttons?: string[];
}

const TEMPLATES: TemplateInfo[] = [
  {
    type: "WELCOME", name: "bienvenida_2", category: "MARKETING",
    trigger: "Día 0 — al crear el dojo",
    header: "Bienvenido a DojoMaster",
    body: "Próximo paso: agrega tu primer alumno.\n\nPuedes hacerlo de dos formas:\n- Manual, desde tu panel\n- Generando un enlace de autoregistro (menú \"Autoregistro\")\n\n¿Dudas? Escríbenos a Soporte: +507 6626-1768",
  },
  {
    type: "HELP_NO_STUDENTS", name: "ayuda_primer_alumno", category: "MARKETING (es_ES)",
    trigger: "Día 2+ — sigue con 0 alumnos",
    header: "Hola {{1}}, ¿cómo vas con tu dojo?",
    body: "Vi que aún no has agregado alumnos.\nSi quieres te muestro en 2 minutos cómo hacerlo, o te comparto el link para que ellos mismos se registren.\n\n¿Te ayudo con algo puntual?",
    buttons: ["Sí, ayúdame", "Ya lo tengo controlado"],
  },
  {
    type: "FOLLOWUP", name: "seguimiento_activo", category: "MARKETING",
    trigger: "Día 3+ — ya tiene 1+ alumno",
    header: "¡Vas muy bien!",
    body: "¿Cómo te ha ido con la plataforma hasta ahora?\n\nCualquier duda o algo que quieras que ajustemos, aquí estoy — para eso construí esto, para que te haga la vida más fácil.",
  },
  {
    type: "LAST_ATTEMPT", name: "ultimo_intento_activacion", category: "MARKETING",
    trigger: "Día 7+ — sigue con 0 alumnos",
    header: "Hola {{1}}, no quiero ser pesado",
    body: "Pero sí quiero asegurarme de que le saques provecho a tu dojo en DojoMaster.\n\nTe dejo otra vez el paso a paso rápido: {{1}}\n\nSi prefieres que te ayude yo directamente, solo dime y lo vemos juntos.",
  },
];

function panDate(iso: string) {
  const d   = new Date(iso);
  const pan = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  return {
    dd: String(pan.getUTCDate()).padStart(2, "0"),
    mm: String(pan.getUTCMonth() + 1).padStart(2, "0"),
    yy: pan.getUTCFullYear(),
    h24: pan.getUTCHours(),
    min: String(pan.getUTCMinutes()).padStart(2, "0"),
  };
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const { dd, mm, yy, h24, min } = panDate(iso);
  const h12 = h24 % 12 || 12;
  const sfx = h24 >= 12 ? "PM" : "AM";
  return `${dd}/${mm}/${yy} ${h12}:${min} ${sfx}`;
}

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
}

type TabId = "pendientes" | "contactados" | "todos" | "templates" | "respuestas";

interface InboundMessage {
  id: string; fromPhone: string; type: string; text: string | null;
  receivedAt: string; handled: boolean;
  dojo: { name: string; phone: string | null } | null;
}

// Frases de los botones de ayuda_primer_alumno — para resaltar cuando alguien
// pidió ayuda de verdad vs. solo confirmó que ya lo tiene controlado.
const ASKED_FOR_HELP = new Set(["sí, ayúdame", "si, ayudame"]);

function InboundRow({ msg, onToggleHandled }: {
  msg: InboundMessage; onToggleHandled: (id: string, handled: boolean) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const askedHelp = ASKED_FOR_HELP.has((msg.text ?? "").trim().toLowerCase());

  async function toggle() {
    setSaving(true);
    await onToggleHandled(msg.id, !msg.handled);
    setSaving(false);
  }

  return (
    <div className={`border-b border-dojo-border/40 last:border-0 px-4 py-3 flex items-center gap-3 flex-wrap ${!msg.handled && askedHelp ? "bg-orange-900/10" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-dojo-white truncate">{msg.dojo?.name ?? "Dojo desconocido"}</p>
          {askedHelp && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-orange-900/30 text-orange-300">
              🆘 Pidió ayuda
            </span>
          )}
          {!msg.handled && (
            <span className="badge-yellow text-[10px]">Sin atender</span>
          )}
        </div>
        <p className="text-sm text-dojo-white mt-1">&ldquo;{msg.text ?? "(mensaje sin texto)"}&rdquo;</p>
        <p className="text-xs text-dojo-muted mt-0.5">{msg.dojo?.phone ?? msg.fromPhone} · {fmtDate(msg.receivedAt)}</p>
      </div>
      <button onClick={toggle} disabled={saving}
        className={`text-xs px-3 py-1.5 shrink-0 rounded-lg font-semibold transition-colors ${
          msg.handled ? "bg-dojo-border/50 text-dojo-muted hover:text-dojo-white" : "btn-primary"
        }`}>
        {saving ? "…" : msg.handled ? "Marcar sin atender" : "Marcar atendido"}
      </button>
    </div>
  );
}

function Row({ msg, onContacted, onOpenDojo }: {
  msg: LifecycleMessage; onContacted: (id: string, note: string) => Promise<void>;
  onOpenDojo?: (dojoId: string) => void;
}) {
  const [open, setOpen]   = useState(false);
  const [note, setNote]   = useState("");
  const [saving, setSaving] = useState(false);
  const typeCfg   = TYPE_CFG[msg.type] ?? { label: msg.type, color: "text-dojo-muted bg-dojo-border/30" };
  const statusCfg = STATUS_CFG[msg.status] ?? { label: msg.status, color: "bg-dojo-border text-dojo-muted" };

  async function confirm() {
    setSaving(true);
    await onContacted(msg.id, note.trim());
    setSaving(false);
    setOpen(false);
  }

  return (
    <div className="border-b border-dojo-border/40 last:border-0">
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {onOpenDojo ? (
              <button onClick={() => onOpenDojo(msg.dojoId)}
                className="text-sm font-medium text-dojo-white hover:text-dojo-gold hover:underline truncate transition-colors">
                {msg.dojo.name}
              </button>
            ) : (
              <p className="text-sm font-medium text-dojo-white truncate">{msg.dojo.name}</p>
            )}
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${typeCfg.color}`}>
              {typeCfg.label}
            </span>
            <span className={`${statusCfg.color} flex items-center gap-1`}>
              {msg.status === "DELIVERED" && <CheckCheck size={11} />}
              {msg.status === "READ" && <Eye size={11} />}
              {statusCfg.label}
            </span>
          </div>
          <p className="text-xs text-dojo-muted mt-0.5">
            {msg.recipientPhone ?? msg.dojo.phone ?? "Sin teléfono"}
            {msg.templateName && <> · plantilla: <span className="font-mono">{msg.templateName}</span></>}
          </p>
          {msg.status === "FAILED" && msg.errorDetail && (
            <p className="text-xs text-red-400 mt-0.5">{msg.errorDetail}</p>
          )}
          {msg.note && <p className="text-xs text-dojo-muted mt-0.5 italic">{msg.note}</p>}
        </div>
        <div className="text-right shrink-0 text-[10px] text-dojo-muted">
          <p>{msg.status === "PENDING" ? `Detectado ${fmtDate(msg.createdAt)}` : `Enviado ${fmtDate(msg.sentAt)}`}</p>
        </div>
        {msg.status === "PENDING" && (
          <button onClick={() => setOpen(o => !o)}
            className="btn-secondary text-xs px-3 py-1.5 shrink-0 flex items-center gap-1">
            <CheckCircle size={13} /> Marcar contactado {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>
      {open && (
        <div className="px-4 pb-3 flex gap-2 items-start">
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Nota opcional (ej. le escribí por WhatsApp personal)"
            className="form-input flex-1 text-sm" style={{ fontSize: "16px" }} />
          <button onClick={confirm} disabled={saving} className="btn-primary text-xs px-3 py-2 shrink-0">
            {saving ? "Guardando…" : "Confirmar"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ClientesCrmPage() {
  const [tab, setTab] = useState<TabId>("pendientes");
  const [messages, setMessages] = useState<LifecycleMessage[]>([]);
  const [loading, setLoading]   = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [selectedDojoId, setSelectedDojoId] = useState<string | null>(null);

  const [dojos, setDojos] = useState<DojoOption[]>([]);
  const [manualDojoId, setManualDojoId] = useState("");
  const [manualNote, setManualNote]     = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualMsg, setManualMsg]       = useState<string | null>(null);

  const [sendEnabled, setSendEnabled]   = useState<boolean | null>(null);
  const [togglingSend, setTogglingSend] = useState(false);
  const [sendingNow, setSendingNow]     = useState(false);
  const [sendResult, setSendResult]     = useState<string | null>(null);

  const [botEnabled, setBotEnabled]         = useState<boolean | null>(null);
  const [togglingBot, setTogglingBot]       = useState(false);

  const [delinquencyEnabled, setDelinquencyEnabled]       = useState<boolean | null>(null);
  const [togglingDelinquency, setTogglingDelinquency]     = useState(false);
  const [sendingDelinquency, setSendingDelinquency]       = useState(false);
  const [delinquencyResult, setDelinquencyResult]         = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    const r = await fetch("/api/superadmin/crm-settings", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      setSendEnabled(d.whatsappSendEnabled);
      setBotEnabled(d.supportBotEnabled);
      setDelinquencyEnabled(d.delinquencySummaryManualEnabled);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // Trae todo siempre — el filtro por pestaña se aplica en cliente (displayedMessages),
  // así "Contactados" puede incluir SENT/DELIVERED/READ/FAILED sin pedirle al servidor
  // un OR de varios status.
  const load = useCallback(async () => {
    if (tab === "templates") return;
    setLoading(true);
    const r = await fetch("/api/superadmin/dojo-lifecycle-messages", { cache: "no-store" });
    if (r.ok) setMessages(await r.json());
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const displayedMessages = messages.filter(m => {
    if (tab === "pendientes"  && m.status !== "PENDING") return false;
    if (tab === "contactados" && m.status === "PENDING") return false;
    if (search.trim() && !m.dojo.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const dojoMessages = selectedDojoId
    ? messages
        .filter(m => m.dojoId === selectedDojoId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];
  const selectedDojoInfo = dojoMessages[0]?.dojo ?? null;

  useEffect(() => {
    fetch("/api/dojos")
      .then(r => r.ok ? r.json() : [])
      .then((d: DojoOption[]) => setDojos(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const [inbound, setInbound] = useState<InboundMessage[]>([]);
  const [inboundLoading, setInboundLoading] = useState(true);

  const loadInbound = useCallback(async () => {
    setInboundLoading(true);
    const r = await fetch("/api/superadmin/whatsapp-inbound", { cache: "no-store" });
    if (r.ok) setInbound(await r.json());
    setInboundLoading(false);
  }, []);

  // Se carga siempre al entrar (no solo en la pestaña Respuestas) para poder
  // mostrar el contador de "sin atender" en la pestaña sin tener que abrirla.
  useEffect(() => { loadInbound(); }, [loadInbound]);

  async function toggleInboundHandled(id: string, handled: boolean) {
    await fetch(`/api/superadmin/whatsapp-inbound/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handled }),
    });
    loadInbound();
  }

  const unhandledCount = inbound.filter(m => !m.handled).length;

  async function scan() {
    setScanning(true);
    setScanResult(null);
    try {
      const r = await fetch("/api/cron/dojo-lifecycle-messages", { method: "POST" });
      const data = await r.json();
      if (r.ok) {
        setScanResult(data.creados > 0 ? `${data.creados} dojo(s) nuevo(s) detectado(s).` : "Sin candidatos nuevos.");
        load();
      } else {
        setScanResult(data.error ?? "Error al buscar candidatos.");
      }
    } catch {
      setScanResult("Error de red al buscar candidatos.");
    }
    setScanning(false);
  }

  async function markContacted(id: string, note: string) {
    await fetch(`/api/superadmin/dojo-lifecycle-messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note ? { note } : {}),
    });
    load();
  }

  async function submitManual() {
    if (!manualDojoId || !manualNote.trim()) return;
    setManualSaving(true);
    setManualMsg(null);
    const r = await fetch("/api/superadmin/dojo-lifecycle-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dojoId: manualDojoId, note: manualNote.trim() }),
    });
    if (r.ok) {
      setManualMsg("Contacto registrado.");
      setManualNote("");
      setManualDojoId("");
      load();
    } else {
      const data = await r.json().catch(() => ({}));
      setManualMsg(data.error ?? "Error al registrar contacto.");
    }
    setManualSaving(false);
  }

  async function toggleSend() {
    const next = !sendEnabled;
    if (next && !confirm(
      "Vas a ACTIVAR el envío real de WhatsApp a dojos reales.\n\n" +
      "A partir de ahora, cada vez que presiones \"Enviar pendientes ahora\" se les mandará el mensaje de verdad por Meta.\n\n" +
      "¿Confirmas?"
    )) return;

    setTogglingSend(true);
    const r = await fetch("/api/superadmin/crm-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappSendEnabled: next }),
    });
    if (r.ok) setSendEnabled((await r.json()).whatsappSendEnabled);
    setTogglingSend(false);
  }

  async function toggleBot() {
    const next = !botEnabled;
    if (next && !confirm(
      "Vas a ACTIVAR el chatbot de soporte por WhatsApp.\n\n" +
      "A partir de ahora, cuando un dueño de dojo toque \"Sí, ayúdame\" o escriba pidiendo ayuda, " +
      "el sistema le va a responder automático (menú de opciones, o te avisa a vos si pide soporte real).\n\n" +
      "¿Confirmas?"
    )) return;

    setTogglingBot(true);
    const r = await fetch("/api/superadmin/crm-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supportBotEnabled: next }),
    });
    if (r.ok) setBotEnabled((await r.json()).supportBotEnabled);
    setTogglingBot(false);
  }

  async function toggleDelinquency() {
    const next = !delinquencyEnabled;
    if (next && !confirm(
      "Vas a ACTIVAR el envío manual del resumen de morosidad.\n\n" +
      "A partir de ahora, cada vez que presiones \"Enviar resumen ahora\" se le manda por WhatsApp a CADA dojo activo su propio número de alumnos atrasados, monto atrasado y monto recaudado del mes en curso — y a ti te llega una copia de lo que recibió cada uno.\n\n" +
      "¿Confirmas?"
    )) return;

    setTogglingDelinquency(true);
    const r = await fetch("/api/superadmin/crm-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delinquencySummaryManualEnabled: next }),
    });
    if (r.ok) setDelinquencyEnabled((await r.json()).delinquencySummaryManualEnabled);
    setTogglingDelinquency(false);
  }

  async function sendDelinquencyNow() {
    if (!confirm("¿Enviar ahora el resumen de morosidad del mes en curso a TODOS los dojos activos? A cada uno le llega solo su propia información, y a ti una copia de cada uno.")) return;
    setSendingDelinquency(true);
    setDelinquencyResult(null);
    try {
      const r = await fetch("/api/superadmin/delinquency-summary/send-now", { method: "POST" });
      const data = await r.json();
      if (data.ok) {
        setDelinquencyResult(`Dojos: ${data.totalDojos} · Enviados: ${data.sent} · Sin teléfono: ${data.noPhone} · Opt-out: ${data.optOut} · Fallidos: ${data.failed}`);
      } else {
        setDelinquencyResult(data.error ?? "Error al enviar.");
      }
    } catch {
      setDelinquencyResult("Error de red al enviar.");
    }
    setSendingDelinquency(false);
  }

  async function sendPendingNow() {
    if (!confirm("¿Enviar ahora los mensajes PENDING a los dojos reales por WhatsApp?")) return;
    setSendingNow(true);
    setSendResult(null);
    try {
      const r = await fetch("/api/cron/dojo-lifecycle-messages/send-pending", { method: "POST" });
      const data = await r.json();
      if (data.ok) {
        setSendResult(`Enviados: ${data.enviados} · Fallidos: ${data.fallidos} · Sin teléfono: ${data.sinTelefono} · Omitidos: ${data.omitidos} · Espaciados para la próxima corrida: ${data.espaciados ?? 0}`);
        load();
      } else {
        setSendResult(data.error ?? "Error al enviar.");
      }
    } catch {
      setSendResult("Error de red al enviar.");
    }
    setSendingNow(false);
  }

  const pendingByType: Record<string, number> = {};
  for (const m of messages) {
    if (tab === "pendientes" && m.status === "PENDING") pendingByType[m.type] = (pendingByType[m.type] ?? 0) + 1;
  }

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "pendientes",  label: "Pendientes",  icon: <Clock size={14} />       },
    { id: "contactados", label: "Contactados", icon: <CheckCircle size={14} /> },
    { id: "todos",       label: "Todos",       icon: <Search size={14} />      },
    { id: "respuestas",  label: `Respuestas${unhandledCount > 0 ? ` (${unhandledCount})` : ""}`, icon: <MessageSquarePlus size={14} /> },
    { id: "templates",   label: "Templates",   icon: <FileText size={14} />    },
  ];

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
          <PhoneCall size={20} className="text-green-400" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-dojo-white">Clientes — Seguimiento</h1>
          <p className="text-sm text-dojo-muted">Activación y riesgo básico de dojos — detección y bitácora de contacto</p>
        </div>
        <button onClick={scan} disabled={scanning}
          className="ml-auto btn-primary text-xs px-3 py-2 flex items-center gap-1.5 shrink-0">
          <RefreshCw size={13} className={scanning ? "animate-spin" : ""} /> Buscar candidatos nuevos
        </button>
      </div>

      {scanResult && (
        <div className="flex items-center gap-2 text-xs bg-dojo-border/30 border border-dojo-border rounded-lg px-3 py-2 text-dojo-white">
          <AlertTriangle size={13} className="text-dojo-gold shrink-0" /> {scanResult}
        </div>
      )}

      {/* Interruptor de envío real */}
      <div className={`card flex flex-col gap-3 border ${sendEnabled ? "border-green-700/50 bg-green-900/10" : "border-dojo-border"}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${sendEnabled ? "bg-green-500/15" : "bg-dojo-border/40"}`}>
            <Power size={16} className={sendEnabled ? "text-green-400" : "text-dojo-muted"} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-dojo-white">
              Mensajes automáticos a dojos: {sendEnabled === null ? "…" : sendEnabled ? "ENCENDIDO" : "Apagado"}
            </p>
            <p className="text-xs text-dojo-muted">
              {sendEnabled
                ? "El sistema ya revisó todos los dojos y decidió a cuáles hay que escribirles hoy. Al presionar \"Enviar ahora\" se les manda el mensaje de verdad por WhatsApp."
                : "Está apagado — el sistema no le manda nada a nadie todavía, aunque haya decidido a quién le tocaría escribir."}
            </p>
          </div>
          <button onClick={toggleSend} disabled={togglingSend || sendEnabled === null}
            className={`text-xs px-3 py-2 shrink-0 rounded-lg font-semibold transition-colors ${
              sendEnabled ? "bg-red-900/30 text-red-300 hover:bg-red-900/50" : "btn-primary"
            }`}>
            {togglingSend ? "…" : sendEnabled ? "Apagar" : "Encender"}
          </button>
          {sendEnabled && (
            <button onClick={sendPendingNow} disabled={sendingNow}
              className="btn-secondary text-xs px-3 py-2 shrink-0 flex items-center gap-1.5">
              <Rocket size={13} className={sendingNow ? "animate-pulse" : ""} /> {sendingNow ? "Enviando…" : "Enviar ahora"}
            </button>
          )}
        </div>

        {/* Qué tipos de mensaje maneja — para que se entienda de un vistazo */}
        <div className="border-t border-dojo-border/50 pt-3">
          <p className="text-[11px] font-semibold text-dojo-muted uppercase tracking-wide mb-2">
            Maneja 4 tipos de mensaje, según la situación de cada dojo
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-dojo-white">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
              🎉 Bienvenida — el mismo día que se registra
            </div>
            <div className="flex items-center gap-1.5 text-dojo-white">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
              🆘 Sin alumnos todavía — a los 2+ días
            </div>
            <div className="flex items-center gap-1.5 text-dojo-white">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              👋 Seguimiento — a los 3+ días, si ya tiene alumnos
            </div>
            <div className="flex items-center gap-1.5 text-dojo-white">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              ⏰ Último aviso — a los 7+ días, si sigue sin alumnos
            </div>
          </div>
        </div>
      </div>

      {sendResult && (
        <div className="flex items-start gap-2 text-xs bg-dojo-border/30 border border-dojo-border rounded-lg px-3 py-2.5 text-dojo-white">
          <Send size={13} className="text-dojo-gold shrink-0 mt-0.5" />
          <span>{sendResult}</span>
        </div>
      )}

      {/* Interruptor del chatbot de soporte */}
      <div className={`card flex items-center gap-3 flex-wrap border ${botEnabled ? "border-green-700/50 bg-green-900/10" : "border-dojo-border"}`}>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${botEnabled ? "bg-green-500/15" : "bg-dojo-border/40"}`}>
          <Bot size={16} className={botEnabled ? "text-green-400" : "text-dojo-muted"} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-dojo-white">
            Chatbot de soporte: {botEnabled === null ? "…" : botEnabled ? "ACTIVADO" : "Desactivado"}
          </p>
          <p className="text-xs text-dojo-muted">
            {botEnabled
              ? "Responde automático a \"Sí, ayúdame\" con un menú de opciones, y te avisa por WhatsApp si alguien pide soporte real."
              : "Apagado por default — mientras esté así, nadie recibe respuestas automáticas."}
          </p>
        </div>
        <button onClick={toggleBot} disabled={togglingBot || botEnabled === null}
          className={`text-xs px-3 py-2 shrink-0 rounded-lg font-semibold transition-colors ${
            botEnabled ? "bg-red-900/30 text-red-300 hover:bg-red-900/50" : "btn-primary"
          }`}>
          {togglingBot ? "…" : botEnabled ? "Desactivar" : "Activar chatbot"}
        </button>
      </div>

      {/* Interruptor de resumen de morosidad manual */}
      <div className={`card flex flex-col gap-3 border ${delinquencyEnabled ? "border-green-700/50 bg-green-900/10" : "border-dojo-border"}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${delinquencyEnabled ? "bg-green-500/15" : "bg-dojo-border/40"}`}>
            <AlertTriangle size={16} className={delinquencyEnabled ? "text-green-400" : "text-dojo-muted"} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-dojo-white">
              Resumen de morosidad manual: {delinquencyEnabled === null ? "…" : delinquencyEnabled ? "ACTIVADO" : "Desactivado"}
            </p>
            <p className="text-xs text-dojo-muted">
              {delinquencyEnabled
                ? "Al presionar \"Enviar resumen ahora\" se le manda por WhatsApp a CADA dojo activo su propio número de alumnos atrasados, monto atrasado y monto recaudado del mes en curso (recalculado al momento de enviar, no un dato guardado). A ti te llega una copia de lo que recibió cada dojo, para que puedas dar seguimiento."
                : "Apagado por default — mientras esté así, el botón de envío manual no aparece. Esto es aparte del envío automático diario (que solo dispara el mismo día que se le avisa a los padres de un atraso)."}
            </p>
          </div>
          <button onClick={toggleDelinquency} disabled={togglingDelinquency || delinquencyEnabled === null}
            className={`text-xs px-3 py-2 shrink-0 rounded-lg font-semibold transition-colors ${
              delinquencyEnabled ? "bg-red-900/30 text-red-300 hover:bg-red-900/50" : "btn-primary"
            }`}>
            {togglingDelinquency ? "…" : delinquencyEnabled ? "Desactivar" : "Activar"}
          </button>
          {delinquencyEnabled && (
            <button onClick={sendDelinquencyNow} disabled={sendingDelinquency}
              className="btn-secondary text-xs px-3 py-2 shrink-0 flex items-center gap-1.5">
              <Send size={13} className={sendingDelinquency ? "animate-pulse" : ""} /> {sendingDelinquency ? "Enviando…" : "Enviar resumen ahora"}
            </button>
          )}
        </div>
        {delinquencyResult && (
          <p className="text-xs text-dojo-white bg-dojo-border/30 border border-dojo-border rounded-lg px-3 py-2">{delinquencyResult}</p>
        )}
      </div>

      {/* Tabs + buscador */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === t.id ? "bg-dojo-gold text-dojo-darker shadow-sm" : "bg-dojo-border text-dojo-muted hover:text-dojo-white"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {tab !== "templates" && tab !== "respuestas" && (
          <div className="relative ml-auto">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar dojo…" className="form-input pl-8 w-48 text-sm py-2"
              style={{ fontSize: "16px" }} />
          </div>
        )}
      </div>

      {/* ── Pestaña: Respuestas ── */}
      {tab === "respuestas" && (
        <div className="card p-0 overflow-hidden">
          <p className="px-4 pt-3 pb-2 text-xs text-dojo-muted">
            Respuestas de dueños de dojo por WhatsApp — incluye los botones de <span className="font-mono">ayuda_primer_alumno</span> ("Sí, ayúdame" / "Ya lo tengo controlado") y cualquier texto libre.
          </p>
          {inboundLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-dojo-border/40 rounded-xl animate-pulse" />)}
            </div>
          ) : inbound.length === 0 ? (
            <div className="text-center py-14 text-dojo-muted">
              <MessageSquarePlus size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Todavía no hay respuestas registradas.</p>
            </div>
          ) : (
            inbound.map(m => <InboundRow key={m.id} msg={m} onToggleHandled={toggleInboundHandled} />)
          )}
        </div>
      )}

      {/* ── Pestaña: Templates ── */}
      {tab === "templates" && (
        <div className="space-y-3">
          <p className="text-xs text-dojo-muted">
            Referencia rápida de los 4 templates aprobados por Meta — para no tener que abrir el Business Manager cada vez que te olvides qué dice cada uno.
          </p>
          {TEMPLATES.map(t => {
            const cfg = TYPE_CFG[t.type] ?? { label: t.type, color: "text-dojo-muted bg-dojo-border/30" };
            return (
              <div key={t.type} className="card space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className="text-sm font-mono text-dojo-gold">{t.name}</span>
                  <span className="text-[10px] text-dojo-muted px-1.5 py-0.5 rounded bg-dojo-border/40">{t.category}</span>
                  <span className="text-[10px] text-dojo-muted ml-auto">{t.trigger}</span>
                </div>
                {t.header && (
                  <p className="text-sm font-bold text-dojo-white">{t.header}</p>
                )}
                <p className="text-sm text-dojo-muted whitespace-pre-wrap">{t.body}</p>
                {t.buttons && (
                  <div className="flex gap-2 flex-wrap pt-1">
                    {t.buttons.map(b => (
                      <span key={b} className="text-xs px-2.5 py-1 rounded-full border border-dojo-border text-dojo-muted">{b}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resumen por tipo (solo en pendientes) */}
      {tab === "pendientes" && Object.keys(pendingByType).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(pendingByType).map(([type, count]) => {
            const cfg = TYPE_CFG[type] ?? { label: type, color: "text-dojo-muted bg-dojo-border/30" };
            return (
              <span key={type} className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${cfg.color}`}>
                {cfg.label}: {count}
              </span>
            );
          })}
        </div>
      )}

      {/* Lista */}
      {tab !== "templates" && tab !== "respuestas" && (
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-dojo-border/40 rounded-xl animate-pulse" />)}
          </div>
        ) : displayedMessages.length === 0 ? (
          <div className="text-center py-14 text-dojo-muted">
            <CheckCircle size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">
              {tab === "pendientes" ? "No hay contactos pendientes." : tab === "contactados" ? "Sin contactos registrados aún." : "Sin registros."}
            </p>
          </div>
        ) : (
          displayedMessages.map(m => <Row key={m.id} msg={m} onContacted={markContacted} onOpenDojo={setSelectedDojoId} />)
        )}
      </div>
      )}

      {/* Contacto manual ad-hoc */}
      {tab !== "templates" && tab !== "respuestas" && (
      <div className="card space-y-3">
        <p className="text-sm font-bold text-dojo-white flex items-center gap-2">
          <MessageSquarePlus size={15} className="text-dojo-gold" /> Registrar contacto manual
        </p>
        <p className="text-xs text-dojo-muted">
          Para cuando le escribiste o llamaste a un dojo fuera de los disparadores automáticos.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={manualDojoId} onChange={e => setManualDojoId(e.target.value)}
            className="form-input flex-1" style={{ fontSize: "16px" }}>
            <option value="">Selecciona un dojo…</option>
            {dojos.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input type="text" value={manualNote} onChange={e => setManualNote(e.target.value)}
            placeholder="Nota (ej. lo llamé, va a inscribir alumnos esta semana)"
            className="form-input flex-1" style={{ fontSize: "16px" }} />
          <button onClick={submitManual} disabled={manualSaving || !manualDojoId || !manualNote.trim()}
            className="btn-primary text-sm px-4 shrink-0 flex items-center gap-1.5 justify-center">
            <Send size={13} /> Registrar
          </button>
        </div>
        {manualMsg && <p className="text-xs text-dojo-muted">{manualMsg}</p>}
      </div>
      )}

      {/* Ficha del dojo */}
      <Dialog open={!!selectedDojoId} onOpenChange={o => !o && setSelectedDojoId(null)}>
        <DialogContent size="lg">
          {selectedDojoInfo && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {selectedDojoInfo.name}
                  {selectedDojoInfo.active
                    ? <span className="badge-green text-[10px]">Activo</span>
                    : <span className="badge-red text-[10px]">Inactivo</span>}
                  {selectedDojoInfo.whatsappOptIn
                    ? <span className="text-[10px] text-green-400 flex items-center gap-1"><ShieldCheck size={11} /> WhatsApp activo</span>
                    : <span className="text-[10px] text-red-400 flex items-center gap-1"><ShieldOff size={11} /> Dado de baja{selectedDojoInfo.whatsappOptOutDate ? ` (${fmtDate(selectedDojoInfo.whatsappOptOutDate)})` : ""}</span>}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-b border-dojo-border">
                <div>
                  <p className="text-[10px] text-dojo-muted uppercase tracking-wider flex items-center gap-1"><Mail size={10} /> Correo</p>
                  <p className="text-xs text-dojo-white truncate">{selectedDojoInfo.email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-dojo-muted uppercase tracking-wider flex items-center gap-1"><PhoneCall size={10} /> Teléfono</p>
                  <p className="text-xs text-dojo-white font-mono">{selectedDojoInfo.phone ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-dojo-muted uppercase tracking-wider flex items-center gap-1"><Users size={10} /> Alumnos</p>
                  <p className="text-xs text-dojo-white">{selectedDojoInfo._count.students}</p>
                </div>
                <div>
                  <p className="text-[10px] text-dojo-muted uppercase tracking-wider flex items-center gap-1"><Calendar size={10} /> Creado</p>
                  <p className="text-xs text-dojo-white">{daysAgo(selectedDojoInfo.createdAt)}</p>
                </div>
              </div>

              <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1">
                <p className="text-[10px] text-dojo-muted uppercase tracking-wider mb-1 mt-2">
                  Historial completo ({dojoMessages.length})
                </p>
                <div className="border border-dojo-border rounded-lg overflow-hidden">
                  {dojoMessages.map(m => <Row key={m.id} msg={m} onContacted={markContacted} />)}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
