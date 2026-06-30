"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Users, CreditCard, AlertTriangle, CheckCircle2, Clock, XCircle,
  ChevronLeft, ChevronRight, Search, Download, RefreshCw,
  Loader2, Receipt, Building2, Copy, Check, Gift, CalendarPlus, Ban,
  Star,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DojoSub {
  id: string;
  status: string;
  cycle: string;
  gateway: string | null;
  paypalSubscriptionId: string | null;
  mpSubscriptionId: string | null;
  trialEndsAt: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  daysRemaining: number | null;
  invoiceCount: number;
  paidCount: number;
  totalRevenue: number;
  createdAt: string;
  updatedAt: string;
  grantedBy: string | null;
  grantedAt: string | null;
  grantNote: string | null;
  plan: { id: string; name: string; monthlyPrice: number; annualPrice: number } | null;
  dojo: { id: string; name: string; slug: string; ownerName: string | null; email: string | null; active: boolean; createdAt: string };
}

interface PlanOption {
  id: string;
  name: string;
  maxStudents: number | null;
  monthlyPrice: number;
}

interface AccessEmailLogRow {
  id:      string;
  dojoId:  string;
  email:   string;
  daysLeft: number;
  status:  string;
  error:   string | null;
  sentAt:  string;
  dojo:    { name: string; slug: string };
}

interface UnsubDojo {
  id: string; name: string; slug: string;
  ownerName: string | null; email: string | null;
  active: boolean; createdAt: string;
}

interface InvoiceRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  gateway: string;
  gatewayInvoiceId: string | null;
  paidAt: string | null;
  createdAt: string;
  subscriptionId: string;
  subStatus: string;
  subCycle: string;
  paypalSubscriptionId: string | null;
  mpSubscriptionId: string | null;
  dojoId: string;
  dojoName: string;
  dojoSlug: string;
  senseiName: string | null;
  dojoEmail: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  TRIAL:          "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  ACTIVE:         "bg-green-500/20 text-green-300 border border-green-500/30",
  PAST_DUE:       "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  CANCELED:       "bg-red-500/20 text-red-300 border border-red-500/30",
  READ_ONLY:      "bg-red-500/20 text-red-300 border border-red-500/30",
  COMPLIMENTARY:  "bg-dojo-gold/20 text-dojo-gold border border-dojo-gold/40",
  SPECIAL_ACCESS: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  NONE:           "bg-dojo-border/60 text-dojo-muted border border-dojo-border",
};
const STATUS_LABEL: Record<string, string> = {
  TRIAL: "Trial", ACTIVE: "Activa", PAST_DUE: "Vencida",
  CANCELED: "Cancelada", READ_ONLY: "Solo lectura",
  COMPLIMENTARY: "Acc. permanente", SPECIAL_ACCESS: "Acc. especial",
  NONE: "Sin suscripción",
};
const STATUS_ICON: Record<string, React.ElementType> = {
  TRIAL: Clock, ACTIVE: CheckCircle2, PAST_DUE: AlertTriangle,
  CANCELED: XCircle, READ_ONLY: XCircle,
  COMPLIMENTARY: Star, SPECIAL_ACCESS: Star, NONE: Building2,
};
const INV_BADGE: Record<string, string> = {
  PAID:     "bg-green-500/20 text-green-300",
  PENDING:  "bg-amber-500/20 text-amber-300",
  FAILED:   "bg-red-500/20 text-red-300",
  REFUNDED: "bg-dojo-border/60 text-dojo-muted",
};
const GW_LABEL: Record<string, string> = { PAYPAL: "PayPal", MERCADOPAGO: "MercadoPago" };

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "short", year: "numeric" });
}
function fmtMoney(n: number, currency = "USD") {
  return new Intl.NumberFormat("es-PA", { style: "currency", currency }).format(n);
}

// ── Copy to clipboard helper ───────────────────────────────────────────────────

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button onClick={copy} title="Copiar" className="text-dojo-muted hover:text-dojo-white transition-colors ml-1 shrink-0">
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
    </button>
  );
}

// ── Summary Cards ─────────────────────────────────────────────────────────────

function SummaryCards({ subs, unsub }: { subs: DojoSub[]; unsub: UnsubDojo[] }) {
  const totalDojos    = subs.length + unsub.length;
  const trials        = subs.filter(s => s.status === "TRIAL").length;
  const active        = subs.filter(s => s.status === "ACTIVE").length;
  const problems      = subs.filter(s => s.status === "PAST_DUE" || s.status === "READ_ONLY").length;
  const canceled      = subs.filter(s => s.status === "CANCELED").length;
  const complimentary = subs.filter(s => s.status === "COMPLIMENTARY" || s.status === "SPECIAL_ACCESS").length;
  const noSub         = unsub.length;
  const totalRevenue  = subs.reduce((acc, s) => acc + s.totalRevenue, 0);

  const cards = [
    { label: "Total dojos",      value: totalDojos,  icon: Building2,    color: "text-dojo-gold"  },
    { label: "En trial",         value: trials,      icon: Clock,        color: "text-blue-400"   },
    { label: "Activos",          value: active,      icon: CheckCircle2, color: "text-green-400"  },
    { label: "Acc. especial",    value: complimentary,icon: Star,        color: "text-dojo-gold"  },
    { label: "Con problemas",    value: problems,    icon: AlertTriangle,color: "text-amber-400"  },
    { label: "Cancelados",       value: canceled,    icon: XCircle,      color: "text-red-400"    },
    { label: "Sin suscripción",  value: noSub,       icon: Building2,    color: "text-dojo-muted" },
    { label: "Recaudación total",value: fmtMoney(totalRevenue), icon: CreditCard, color: "text-green-400", wide: true },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <div key={c.label} className={`card py-3 px-4 ${(c as { wide?: boolean }).wide ? "sm:col-span-2 xl:col-span-1" : ""}`}>
            <div className={`flex items-center gap-2 mb-1 ${c.color}`}>
              <Icon size={14} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-dojo-muted">{c.label}</span>
            </div>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Subscriptions Tab ─────────────────────────────────────────────────────────

// ── Grant Modal ───────────────────────────────────────────────────────────────

// Returns "YYYY-MM-DD" in local time (for input[type=date] min attribute)
function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function GrantModal({
  dojo, onClose, onDone,
}: {
  dojo:    { id: string; name: string; status: string; trialEndsAt: string; planId: string | null };
  onClose: () => void;
  onDone:  () => void;
}) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = toDateInputValue(new Date(Date.now() + 30 * 86_400_000));

  const isComplimentary  = dojo.status === "COMPLIMENTARY";
  const isSpecialAccess  = dojo.status === "SPECIAL_ACCESS";
  const hasSpecialStatus = isComplimentary || isSpecialAccess;

  const [action,   setAction]   = useState<"free_month"|"special_access"|"complimentary">("special_access");
  const [months,   setMonths]   = useState(1);
  const [note,     setNote]     = useState("");
  const [endsAt,   setEndsAt]   = useState(defaultDate);
  const [planId,   setPlanId]   = useState(dojo.planId ?? "");
  const [plans,    setPlans]    = useState<PlanOption[]>([]);
  const [newDate,  setNewDate]  = useState(
    isSpecialAccess && dojo.trialEndsAt
      ? toDateInputValue(new Date(dojo.trialEndsAt))
      : defaultDate,
  );
  const [extMode,  setExtMode]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  // Load plans for plan selector (special_access y complimentary)
  useEffect(() => {
    if (!hasSpecialStatus) {
      fetch("/api/billing/plans")
        .then(r => r.json())
        .then((data: PlanOption[]) => {
          setPlans(data);
          if (!planId && data.length > 0) {
            const gold = data.find(p => p.maxStudents === null) ?? data[data.length - 1];
            setPlanId(gold.id);
          }
        })
        .catch(() => null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function apply() {
    setSaving(true); setError("");
    const body: Record<string, unknown> = { dojoId: dojo.id, action, note: note.trim() || undefined };
    if (action === "free_month")     body.months = months;
    if (action === "special_access") { body.endsAt = new Date(endsAt).toISOString(); body.planId = planId; }
    if (action === "complimentary" && planId) body.planId = planId;
    const res = await fetch("/api/billing/admin/grant", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) { onDone(); onClose(); }
    else { const d = await res.json() as { error?: string }; setError(d.error ?? "Error al aplicar."); }
  }

  async function extend() {
    setSaving(true); setError("");
    const res = await fetch("/api/billing/admin/grant", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dojoId: dojo.id, action: "extend_special_access", endsAt: new Date(newDate).toISOString() }),
    });
    setSaving(false);
    if (res.ok) { onDone(); onClose(); }
    else { const d = await res.json() as { error?: string }; setError(d.error ?? "Error al extender."); }
  }

  async function revoke() {
    setSaving(true); setError("");
    const res = await fetch("/api/billing/admin/grant", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dojoId: dojo.id, action: "revoke" }),
    });
    setSaving(false);
    if (res.ok) { onDone(); onClose(); }
    else { const d = await res.json() as { error?: string }; setError(d.error ?? "Error al revocar."); }
  }

  const minDate = toDateInputValue(tomorrow);

  return (
    <div className="space-y-5">
      {/* Dojo context */}
      <div className="bg-dojo-darker border border-dojo-border rounded-xl px-4 py-3">
        <p className="text-dojo-white font-semibold">{dojo.name}</p>
        <span className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[dojo.status] ?? ""}`}>
          {STATUS_LABEL[dojo.status] ?? dojo.status}
        </span>
        {isSpecialAccess && dojo.trialEndsAt && (
          <p className="text-purple-300 text-xs mt-1">
            Acceso hasta: {fmtDate(dojo.trialEndsAt)}
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* ── SPECIAL_ACCESS: extender o revocar ── */}
      {isSpecialAccess && !extMode && (
        <div className="space-y-3">
          <div className="bg-purple-900/20 border border-purple-800/40 rounded-xl p-4 space-y-3">
            <p className="text-purple-300 text-sm font-medium flex items-center gap-2">
              <Star size={15}/> Acceso especial con tiempo activo.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setExtMode(true)}
                className="btn-primary text-xs gap-1.5 flex-1 justify-center">
                <CalendarPlus size={13}/> Cambiar fecha
              </button>
              <button type="button" onClick={() => void revoke()} disabled={saving}
                className="btn-secondary text-xs gap-1.5 border-red-700/50 text-red-400 hover:text-red-300 disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin"/> : <Ban size={13}/>}
                Revocar
              </button>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary w-full justify-center">Cerrar</button>
        </div>
      )}

      {/* ── SPECIAL_ACCESS: cambiar fecha ── */}
      {isSpecialAccess && extMode && (
        <div className="space-y-4">
          <div>
            <label className="form-label">Nueva fecha de acceso</label>
            <input type="date" value={newDate} min={minDate}
              onChange={e => setNewDate(e.target.value)} className="form-input" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => void extend()} disabled={saving}
              className="btn-primary flex-1 justify-center gap-1.5 disabled:opacity-50">
              {saving ? <><Loader2 size={14} className="animate-spin"/> Guardando...</> : <><CalendarPlus size={14}/> Guardar nueva fecha</>}
            </button>
            <button type="button" onClick={() => setExtMode(false)} disabled={saving} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── COMPLIMENTARY: revocar ── */}
      {isComplimentary && (
        <div className="space-y-3">
          <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-4 space-y-3">
            <p className="text-amber-300 text-sm font-medium flex items-center gap-2">
              <Ban size={15}/> Este dojo tiene acceso permanente activo.
            </p>
            <p className="text-amber-400/70 text-xs">
              Al revocar, pasará a Solo lectura hasta que configure un plan de pago.
            </p>
            <button type="button" onClick={() => void revoke()} disabled={saving}
              className="btn-secondary text-xs gap-1.5 border-amber-700/50 text-amber-300 hover:text-amber-200 disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin"/> : <Ban size={13}/>}
              Revocar acceso permanente
            </button>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary w-full justify-center">Cerrar</button>
        </div>
      )}

      {/* ── Sin acceso especial: elegir tipo ── */}
      {!hasSpecialStatus && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setAction("free_month")}
              className={`p-3 rounded-xl border-2 text-left transition-colors ${
                action === "free_month" ? "border-blue-500 bg-blue-500/10" : "border-dojo-border hover:border-dojo-border/80"
              }`}>
              <CalendarPlus size={16} className="text-blue-400 mb-1.5"/>
              <p className="text-dojo-white font-semibold text-xs">Mes gratis</p>
              <p className="text-dojo-muted text-[10px] mt-0.5">Extiende trial</p>
            </button>
            <button type="button" onClick={() => setAction("special_access")}
              className={`p-3 rounded-xl border-2 text-left transition-colors ${
                action === "special_access" ? "border-purple-500 bg-purple-500/10" : "border-dojo-border hover:border-dojo-border/80"
              }`}>
              <Star size={16} className="text-purple-400 mb-1.5"/>
              <p className="text-dojo-white font-semibold text-xs">Acc. especial</p>
              <p className="text-dojo-muted text-[10px] mt-0.5">Hasta fecha</p>
            </button>
            <button type="button" onClick={() => setAction("complimentary")}
              className={`p-3 rounded-xl border-2 text-left transition-colors ${
                action === "complimentary" ? "border-dojo-gold bg-dojo-gold/10" : "border-dojo-border hover:border-dojo-border/80"
              }`}>
              <Star size={16} className="text-dojo-gold mb-1.5"/>
              <p className="text-dojo-white font-semibold text-xs">Permanente</p>
              <p className="text-dojo-muted text-[10px] mt-0.5">Sin expirar</p>
            </button>
          </div>

          {action === "free_month" && (
            <div>
              <label className="form-label">Cantidad de meses</label>
              <select value={months} onChange={e => setMonths(Number(e.target.value))} className="form-input">
                {[1,2,3,6,12].map(m => (
                  <option key={m} value={m}>{m} {m === 1 ? "mes" : "meses"}</option>
                ))}
              </select>
              <p className="text-xs text-dojo-muted mt-1">Se añaden {months * 30} días al período actual.</p>
            </div>
          )}

          {action === "special_access" && (
            <div className="space-y-3">
              <div>
                <label className="form-label">Acceso hasta</label>
                <input type="date" value={endsAt} min={minDate}
                  onChange={e => setEndsAt(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label">Plan (límite de alumnos)</label>
                <select value={planId} onChange={e => setPlanId(e.target.value)} className="form-input">
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.maxStudents != null ? `hasta ${p.maxStudents} alumnos` : "alumnos ilimitados"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {action === "complimentary" && (
            <div className="space-y-3">
              <div className="bg-dojo-gold/10 border border-dojo-gold/30 rounded-xl px-4 py-3 text-sm">
                <p className="text-dojo-gold font-semibold flex items-center gap-2">
                  <Star size={14}/> Acceso permanente sin pago
                </p>
                <p className="text-dojo-muted text-xs mt-1">
                  Acceso indefinido. Sin expiración. Revocable en cualquier momento.
                </p>
              </div>
              {plans.length > 0 && (
                <div>
                  <label className="form-label">Plan (límite de alumnos)</label>
                  <select value={planId} onChange={e => setPlanId(e.target.value)} className="form-input">
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.maxStudents != null ? `hasta ${p.maxStudents} alumnos` : "alumnos ilimitados"}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-dojo-muted mt-1">
                    El límite de alumnos del plan aplica aunque el acceso sea permanente.
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="form-label">Nota interna <span className="text-dojo-muted font-normal">(opcional)</span></label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={300}
              placeholder="Motivo, acuerdo con el sensei..." className="form-input resize-none" />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => void apply()} disabled={saving || (action === "special_access" && !planId)}
              className="btn-primary flex-1 justify-center disabled:opacity-50 gap-1.5">
              {saving
                ? <><Loader2 size={14} className="animate-spin"/> Aplicando...</>
                : action === "free_month"
                  ? <><CalendarPlus size={14}/> Dar {months} {months === 1 ? "mes" : "meses"} gratis</>
                  : action === "special_access"
                    ? <><Star size={14}/> Dar acceso hasta {endsAt}</>
                    : <><Star size={14}/> Dar acceso permanente</>
              }
            </button>
            <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">Cancelar</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Subscriptions Table ───────────────────────────────────────────────────────

function SubsTable({ subs, unsub, onSelectDojo, onRefresh }: {
  subs: DojoSub[];
  unsub: UnsubDojo[];
  onSelectDojo: (dojoId: string) => void;
  onRefresh:    () => void;
}) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [grantTarget, setGrantTarget] = useState<{
    id: string; name: string; status: string; trialEndsAt: string; planId: string | null;
  } | null>(null);

  const filtered = [
    ...subs.filter(s => {
      const q = search.toLowerCase();
      const matchSearch = !q
        || s.dojo.name.toLowerCase().includes(q)
        || (s.dojo.ownerName ?? "").toLowerCase().includes(q)
        || s.dojo.slug.toLowerCase().includes(q);
      const matchStatus = filterStatus === "ALL" || s.status === filterStatus;
      return matchSearch && matchStatus;
    }),
  ];

  const showUnsub = (filterStatus === "ALL" || filterStatus === "NONE") &&
    (!search || unsub.some(d =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.ownerName ?? "").toLowerCase().includes(search.toLowerCase())
    ));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
          <input
            type="text"
            placeholder="Buscar dojo o sensei…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input pl-8 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 bg-dojo-dark border border-dojo-border rounded-lg p-1 flex-wrap">
          {["ALL","TRIAL","ACTIVE","COMPLIMENTARY","SPECIAL_ACCESS","PAST_DUE","READ_ONLY","CANCELED","NONE"].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors whitespace-nowrap ${
                filterStatus === s ? "bg-dojo-red text-white" : "text-dojo-muted hover:text-dojo-white"
              }`}
            >
              {s === "ALL" ? "Todos" : STATUS_LABEL[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-dojo-border bg-dojo-darker/60">
                {["Dojo / Sensei","Estado","Plan / Ciclo","Trial / Renovación","Gateway","Ingresos","Acciones"].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-dojo-muted text-sm">Sin resultados</td></tr>
              )}
              {filtered.map(s => {
                const Icon = STATUS_ICON[s.status] ?? Building2;
                const gatewaySubId = s.gateway === "PAYPAL" ? s.paypalSubscriptionId : s.mpSubscriptionId;
                return (
                  <tr key={s.id} className="border-b border-dojo-border/50 hover:bg-dojo-border/10">
                    {/* Dojo / Sensei */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-dojo-white">{s.dojo.name}</p>
                      <p className="text-xs text-dojo-muted">{s.dojo.ownerName ?? "—"}</p>
                      {s.dojo.email && <p className="text-xs text-dojo-muted/70">{s.dojo.email}</p>}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[s.status]}`}>
                        <Icon size={10} /> {STATUS_LABEL[s.status]}
                      </span>
                      {s.daysRemaining !== null && (
                        <p className={`text-[11px] mt-1 ${s.status === "SPECIAL_ACCESS" ? "text-purple-400" : "text-blue-400"}`}>
                          {s.daysRemaining}d restantes
                        </p>
                      )}
                    </td>
                    {/* Plan */}
                    <td className="px-4 py-3">
                      <p className="text-dojo-white font-medium">{s.plan?.name ?? "—"}</p>
                      <p className="text-xs text-dojo-muted capitalize">{s.cycle === "MONTHLY" ? "Mensual" : "Anual"}</p>
                    </td>
                    {/* Dates */}
                    <td className="px-4 py-3 text-xs text-dojo-muted">
                      {s.status === "TRIAL" ? (
                        <><span className="text-blue-400 font-medium">Vence:</span> {fmtDate(s.trialEndsAt)}</>
                      ) : s.status === "SPECIAL_ACCESS" ? (
                        <><span className="text-purple-300 font-medium">Hasta:</span> {fmtDate(s.trialEndsAt)}</>
                      ) : s.currentPeriodEnd ? (
                        <><span className="text-dojo-white font-medium">Renueva:</span> {fmtDate(s.currentPeriodEnd)}</>
                      ) : (
                        <span className="text-dojo-muted">—</span>
                      )}
                      <p className="mt-0.5">Alta: {fmtDate(s.createdAt)}</p>
                    </td>
                    {/* Gateway */}
                    <td className="px-4 py-3">
                      {s.gateway ? (
                        <>
                          <p className="text-dojo-white text-xs font-medium">{GW_LABEL[s.gateway]}</p>
                          {gatewaySubId && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] text-dojo-muted font-mono truncate max-w-[120px]" title={gatewaySubId}>
                                {gatewaySubId.slice(0, 16)}…
                              </span>
                              <CopyBtn value={gatewaySubId} />
                            </div>
                          )}
                        </>
                      ) : <span className="text-dojo-muted text-xs">—</span>}
                    </td>
                    {/* Revenue */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-green-400">{fmtMoney(s.totalRevenue)}</p>
                      <p className="text-[11px] text-dojo-muted">{s.paidCount} factura{s.paidCount !== 1 ? "s" : ""}</p>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectDojo(s.dojo.id)}
                          className="btn-ghost text-xs px-2 py-1 gap-1"
                        >
                          <Receipt size={12} /> Facturas
                        </button>
                        <button
                          type="button"
                          onClick={() => setGrantTarget({
                            id: s.dojo.id, name: s.dojo.name, status: s.status,
                            trialEndsAt: s.trialEndsAt, planId: s.plan?.id ?? null,
                          })}
                          className={`btn-ghost text-xs px-2 py-1 gap-1 ${
                            s.status === "COMPLIMENTARY" || s.status === "SPECIAL_ACCESS"
                              ? "text-dojo-gold hover:text-yellow-300"
                              : "text-dojo-muted hover:text-dojo-white"
                          }`}
                          title="Gestionar acceso"
                        >
                          <Star size={12}/>
                          {s.status === "COMPLIMENTARY" || s.status === "SPECIAL_ACCESS" ? "Especial" : "Acceso"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Unsubscribed dojos */}
              {showUnsub && unsub
                .filter(d => {
                  const q = search.toLowerCase();
                  return !q || d.name.toLowerCase().includes(q) || (d.ownerName ?? "").toLowerCase().includes(q);
                })
                .map(d => (
                  <tr key={d.id} className="border-b border-dojo-border/30 bg-dojo-darker/30 hover:bg-dojo-border/5 opacity-70">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-dojo-white">{d.name}</p>
                      <p className="text-xs text-dojo-muted">{d.ownerName ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE.NONE}`}>
                        <Building2 size={10} /> Sin suscripción
                      </span>
                    </td>
                    <td colSpan={4} className="px-4 py-3 text-xs text-dojo-muted">
                      Alta: {fmtDate(d.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setGrantTarget({ id: d.id, name: d.name, status: "NONE", trialEndsAt: "", planId: null })}
                        className="btn-ghost text-xs px-2 py-1 gap-1 text-dojo-muted hover:text-dojo-white"
                      >
                        <Gift size={12}/> Acceso
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Grant modal */}
      {grantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-dojo-dark border border-dojo-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-dojo-border">
              <h2 className="font-display font-bold text-dojo-white text-lg flex items-center gap-2">
                <Gift size={18} className="text-dojo-gold"/> Gestionar acceso
              </h2>
              <button type="button" onClick={() => setGrantTarget(null)} className="text-dojo-muted hover:text-dojo-white">
                ✕
              </button>
            </div>
            <div className="px-6 py-5">
              <GrantModal
                dojo={grantTarget}
                onClose={() => setGrantTarget(null)}
                onDone={() => { onRefresh(); setGrantTarget(null); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Invoices Tab ──────────────────────────────────────────────────────────────

function InvoicesTable({ initialDojoId }: { initialDojoId?: string }) {
  const [invoices,   setInvoices]   = useState<InvoiceRow[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filterGw,   setFilterGw]   = useState("ALL");
  const [filterSt,   setFilterSt]   = useState("ALL");
  const [dojoFilter, setDojoFilter] = useState(initialDojoId ?? "");

  const limit = 50;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(limit) });
    if (dojoFilter) params.set("dojoId",  dojoFilter);
    if (filterGw !== "ALL") params.set("gateway", filterGw);
    if (filterSt !== "ALL") params.set("status",  filterSt);

    try {
      const res  = await fetch(`/api/billing/admin/invoices?${params.toString()}`);
      const data = await res.json() as { invoices: InvoiceRow[]; total: number };
      setInvoices(data.invoices ?? []);
      setTotal(data.total ?? 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [dojoFilter, filterGw, filterSt]);

  useEffect(() => {
    setPage(1);
    void load(1);
  }, [load]);

  // Client-side name search (on current page)
  const visible = search
    ? invoices.filter(i =>
        i.dojoName.toLowerCase().includes(search.toLowerCase()) ||
        (i.senseiName ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : invoices;

  const totalPages = Math.ceil(total / limit);

  function exportCSV() {
    const headers = ["Fecha","Dojo","Sensei","Email","Monto","Moneda","Gateway","Estado","ID Factura","ID Gateway","Sub PayPal","Sub MP"];
    const rows = invoices.map(i => [
      new Date(i.createdAt).toISOString(),
      i.dojoName, i.senseiName ?? "", i.dojoEmail ?? "",
      i.amount, i.currency, i.gateway, i.status,
      i.id, i.gatewayInvoiceId ?? "", i.paypalSubscriptionId ?? "", i.mpSubscriptionId ?? "",
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `billing-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
          <input
            type="text"
            placeholder="Buscar dojo o sensei…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input pl-8 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-1 bg-dojo-dark border border-dojo-border rounded-lg p-1 text-xs">
          {["ALL","PAID","FAILED","PENDING"].map(s => (
            <button key={s} type="button" onClick={() => setFilterSt(s)}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${filterSt === s ? "bg-dojo-red text-white" : "text-dojo-muted hover:text-dojo-white"}`}>
              {s === "ALL" ? "Todos" : s === "PAID" ? "Pagadas" : s === "FAILED" ? "Fallidas" : "Pendientes"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-dojo-dark border border-dojo-border rounded-lg p-1 text-xs">
          {["ALL","PAYPAL","MERCADOPAGO"].map(g => (
            <button key={g} type="button" onClick={() => setFilterGw(g)}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${filterGw === g ? "bg-dojo-red text-white" : "text-dojo-muted hover:text-dojo-white"}`}>
              {g === "ALL" ? "Todas" : GW_LABEL[g]}
            </button>
          ))}
        </div>

        <button type="button" onClick={exportCSV} className="btn-ghost text-xs gap-1.5 px-3 py-2">
          <Download size={13} /> Exportar CSV
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-dojo-border bg-dojo-darker/60">
                {["Fecha","Dojo / Sensei","Monto","Gateway","Estado","Ref. Gateway","Sub ID","Acciones"].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-dojo-muted">
                  <Loader2 size={18} className="animate-spin mx-auto" />
                </td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-dojo-muted text-sm">Sin facturas</td></tr>
              ) : visible.map(inv => {
                const gatewaySubId = inv.gateway === "PAYPAL" ? inv.paypalSubscriptionId : inv.mpSubscriptionId;
                return (
                  <tr key={inv.id} className="border-b border-dojo-border/50 hover:bg-dojo-border/10">
                    {/* Fecha */}
                    <td className="px-4 py-3 text-xs text-dojo-muted whitespace-nowrap">
                      <p className="text-dojo-white font-medium">{fmtDate(inv.paidAt ?? inv.createdAt)}</p>
                      <p className="text-[10px]">{new Date(inv.createdAt).toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit" })}</p>
                    </td>
                    {/* Dojo */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-dojo-white">{inv.dojoName}</p>
                      <p className="text-xs text-dojo-muted">{inv.senseiName ?? "—"}</p>
                      {inv.dojoEmail && <p className="text-[11px] text-dojo-muted/70">{inv.dojoEmail}</p>}
                    </td>
                    {/* Monto */}
                    <td className="px-4 py-3 font-bold text-dojo-white whitespace-nowrap">
                      {fmtMoney(inv.amount, inv.currency)}
                    </td>
                    {/* Gateway */}
                    <td className="px-4 py-3 text-xs text-dojo-muted">{GW_LABEL[inv.gateway] ?? inv.gateway}</td>
                    {/* Estado */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${INV_BADGE[inv.status] ?? ""}`}>
                        {inv.status === "PAID" ? "Pagada" : inv.status === "FAILED" ? "Fallida" : inv.status === "PENDING" ? "Pendiente" : inv.status}
                      </span>
                    </td>
                    {/* Ref. Gateway — clave para reclamos */}
                    <td className="px-4 py-3">
                      {inv.gatewayInvoiceId ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[11px] text-dojo-white truncate max-w-[130px]" title={inv.gatewayInvoiceId}>
                            {inv.gatewayInvoiceId}
                          </span>
                          <CopyBtn value={inv.gatewayInvoiceId} />
                        </div>
                      ) : <span className="text-dojo-muted text-xs">—</span>}
                    </td>
                    {/* Sub ID */}
                    <td className="px-4 py-3">
                      {gatewaySubId ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[10px] text-dojo-muted truncate max-w-[100px]" title={gatewaySubId}>
                            {gatewaySubId.slice(0, 14)}…
                          </span>
                          <CopyBtn value={gatewaySubId} />
                        </div>
                      ) : <span className="text-dojo-muted text-xs">—</span>}
                    </td>
                    {/* Copy all */}
                    <td className="px-4 py-3">
                      <CopyBtn value={JSON.stringify({
                        invoiceId: inv.id, gatewayInvoiceId: inv.gatewayInvoiceId,
                        subscriptionId: inv.subscriptionId, paypalSub: inv.paypalSubscriptionId,
                        mpSub: inv.mpSubscriptionId, dojo: inv.dojoName,
                        amount: inv.amount, currency: inv.currency, date: inv.paidAt ?? inv.createdAt,
                      })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination + count */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-dojo-muted text-xs">
          {total} factura{total !== 1 ? "s" : ""} — página {page} de {totalPages || 1}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={() => { const p = page - 1; setPage(p); void load(p); }} disabled={page === 1}
              className="btn-ghost p-1.5 disabled:opacity-40"><ChevronLeft size={15} /></button>
            <button onClick={() => { const p = page + 1; setPage(p); void load(p); }} disabled={page >= totalPages}
              className="btn-ghost p-1.5 disabled:opacity-40"><ChevronRight size={15} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Access Email Logs Table ───────────────────────────────────────────────────

function AccessEmailLogsTable({ initialDojoId }: { initialDojoId?: string }) {
  const [logs,    setLogs]    = useState<AccessEmailLogRow[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [dojoFilter, setDojoFilter] = useState(initialDojoId ?? "");
  const limit = 50;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(limit) });
    if (dojoFilter) params.set("dojoId", dojoFilter);
    try {
      const res  = await fetch(`/api/billing/admin/access-email-logs?${params}`);
      const data = await res.json() as { logs: AccessEmailLogRow[]; total: number };
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [dojoFilter]);

  useEffect(() => { setPage(1); void load(1); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-dojo-border bg-dojo-darker/60">
                {["Fecha", "Dojo", "Destinatario(s)", "Días restantes", "Estado"].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-dojo-muted">
                  <Loader2 size={18} className="animate-spin mx-auto" />
                </td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-dojo-muted text-sm">
                  Sin registros de correos
                </td></tr>
              ) : logs.map(row => (
                <tr key={row.id} className="border-b border-dojo-border/50 hover:bg-dojo-border/10">
                  <td className="px-4 py-3 text-xs text-dojo-muted whitespace-nowrap">
                    <p className="text-dojo-white font-medium">{fmtDate(row.sentAt)}</p>
                    <p className="text-[10px]">
                      {new Date(row.sentAt).toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit", timeZone: "America/Panama" })}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-dojo-white">{row.dojo.name}</p>
                    <p className="text-xs text-dojo-muted">{row.dojo.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-dojo-muted max-w-[200px] truncate" title={row.email}>
                    {row.email}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      row.daysLeft === 0 ? "bg-red-500/20 text-red-300" :
                      row.daysLeft === 1 ? "bg-amber-500/20 text-amber-300" :
                      "bg-yellow-500/20 text-yellow-300"
                    }`}>
                      {row.daysLeft === 0 ? "Expira hoy" : `${row.daysLeft}d restantes`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.status === "sent" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle2 size={12}/> Enviado
                      </span>
                    ) : (
                      <div>
                        <span className="inline-flex items-center gap-1 text-xs text-red-400">
                          <XCircle size={12}/> Falló
                        </span>
                        {row.error && (
                          <p className="text-[10px] text-red-400/70 mt-0.5 max-w-[160px] truncate" title={row.error}>
                            {row.error}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <p className="text-dojo-muted text-xs">{total} correo{total !== 1 ? "s" : ""} — página {page} de {totalPages || 1}</p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={() => { const p = page - 1; setPage(p); void load(p); }} disabled={page === 1}
              className="btn-ghost p-1.5 disabled:opacity-40"><ChevronLeft size={15}/></button>
            <button onClick={() => { const p = page + 1; setPage(p); void load(p); }} disabled={page >= totalPages}
              className="btn-ghost p-1.5 disabled:opacity-40"><ChevronRight size={15}/></button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export function SuperadminBillingDashboard() {
  const [tab,        setTab]        = useState<"subs" | "invoices" | "notifications">("subs");
  const [data,       setData]       = useState<{ subscriptions: DojoSub[]; unsubscribed: UnsubDojo[] } | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [jumpDojo,   setJumpDojo]   = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/admin");
      const d   = await res.json() as { subscriptions: DojoSub[]; unsubscribed: UnsubDojo[] };
      setData(d);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function handleSelectDojo(dojoId: string) {
    setJumpDojo(dojoId);
    setTab("invoices");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white">Billing SaaS</h1>
          <p className="text-dojo-muted text-sm mt-1">Suscripciones, pagos y log de reclamos de todos los dojos.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="btn-ghost gap-2 text-sm">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
          {[1,2,3,4].map(i => <div key={i} className="card h-20 bg-dojo-border/40" />)}
        </div>
      ) : data && (
        <SummaryCards subs={data.subscriptions} unsub={data.unsubscribed} />
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-dojo-dark border border-dojo-border rounded-xl p-1 w-fit flex-wrap">
        <button type="button" onClick={() => setTab("subs")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === "subs" ? "bg-dojo-red text-white" : "text-dojo-muted hover:text-dojo-white"}`}>
          Suscripciones
        </button>
        <button type="button" onClick={() => { setTab("invoices"); setJumpDojo(undefined); }}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === "invoices" ? "bg-dojo-red text-white" : "text-dojo-muted hover:text-dojo-white"}`}>
          Log de Pagos
        </button>
        <button type="button" onClick={() => setTab("notifications")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === "notifications" ? "bg-dojo-red text-white" : "text-dojo-muted hover:text-dojo-white"}`}>
          Notificaciones
        </button>
      </div>

      {/* Tab content */}
      {tab === "subs" && data && (
        <SubsTable
          subs={data.subscriptions}
          unsub={data.unsubscribed}
          onSelectDojo={handleSelectDojo}
          onRefresh={() => void load()}
        />
      )}
      {tab === "invoices" && (
        <InvoicesTable key={jumpDojo ?? "all"} initialDojoId={jumpDojo} />
      )}
      {tab === "notifications" && (
        <div className="space-y-3">
          <p className="text-dojo-muted text-sm">
            Correos de aviso enviados a dojos con acceso especial por vencer (≤ 2 días).
            El cron los envía una vez al día automáticamente.
          </p>
          <AccessEmailLogsTable />
        </div>
      )}
    </div>
  );
}
