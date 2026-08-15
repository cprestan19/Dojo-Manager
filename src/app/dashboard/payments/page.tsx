"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CreditCard, Search, Bell, CheckCircle, Filter, AlertTriangle, X, Send, Mail, CalendarPlus, FileText, Pencil, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { formatDate, PAYMENT_STATUS_LABELS, getPaymentTypeLabel } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { useDojoTimeZone, useDojoCurrency } from "@/lib/hooks/useDojo";
import { EditPaymentModal } from "@/components/payments/EditPaymentModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Payment {
  id: string; studentId: string; type: string; amount: number;
  dueDate: string; paidDate: string | null; status: string; note: string | null;
  reminderSent: boolean;
  student: {
    fullName: string; firstName: string; lastName: string;
    motherName: string | null; motherEmail: string | null;
    fatherName: string | null; fatherEmail: string | null;
  };
}

interface ReminderTarget {
  paymentId: string;
  studentName: string;
  amount: number;
  dueDate: string;
  recipients: { label: string; name: string; email: string }[];
}

function buildTarget(p: Payment): ReminderTarget {
  const recipients: { label: string; name: string; email: string }[] = [];
  if (p.student.motherEmail)
    recipients.push({ label: "Madre / Tutora", name: p.student.motherName ?? "—", email: p.student.motherEmail });
  if (p.student.fatherEmail)
    recipients.push({ label: "Padre / Tutor",  name: p.student.fatherName ?? "—", email: p.student.fatherEmail });
  return {
    paymentId: p.id,
    studentName: p.student.fullName,
    amount: p.amount,
    dueDate: p.dueDate,
    recipients,
  };
}

function ReminderConfirmModal({
  target, onClose, onConfirm, sending,
}: {
  target: ReminderTarget;
  onClose: () => void;
  onConfirm: () => void;
  sending: boolean;
}) {
  const currency = useDojoCurrency();
  return (
    <div className="space-y-5">
      {/* Warning */}
      <div className="flex items-start gap-3 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
        <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-yellow-300 text-sm font-medium">
          Verifique los datos antes de enviar. El correo se enviará a los destinatarios indicados.
        </p>
      </div>

      {/* Alumno y pago */}
      <div className="bg-dojo-dark border border-dojo-border rounded-lg p-4 space-y-2">
        <p className="text-xs text-dojo-muted uppercase tracking-wider mb-3">Datos del pago</p>
        <div className="flex justify-between text-sm">
          <span className="text-dojo-muted">Alumno</span>
          <span className="text-dojo-white font-semibold">{target.studentName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-dojo-muted">Monto</span>
          <span className="text-dojo-gold font-bold">{formatCurrency(target.amount, currency)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-dojo-muted">Vencimiento</span>
          <span className="text-dojo-white">{formatDate(target.dueDate)}</span>
        </div>
      </div>

      {/* Destinatarios */}
      <div className="space-y-2">
        <p className="text-xs text-dojo-muted uppercase tracking-wider">Destinatario(s)</p>
        {target.recipients.length === 0 ? (
          <div className="flex items-start gap-3 p-3 bg-red-900/20 border border-red-800/40 rounded-lg">
            <Mail size={15} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-300 font-medium">Sin correos registrados</p>
              <p className="text-xs text-red-300/70 mt-0.5">
                Este alumno no tiene correo de madre ni de padre. Agrégalos en su perfil para poder enviar recordatorios.
              </p>
            </div>
          </div>
        ) : (
          target.recipients.map(r => (
            <div key={r.email} className="flex items-center gap-3 p-3 bg-dojo-dark border border-dojo-border rounded-lg">
              <Mail size={15} className="text-dojo-red shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-dojo-muted">{r.label}</p>
                <p className="text-sm text-dojo-white font-medium">{r.name}</p>
                <p className="text-xs text-dojo-gold font-mono truncate">{r.email}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-dojo-muted">
        El correo incluirá el recordatorio del pago y la política de recargo por atraso configurada en Ajustes.
      </p>

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary" disabled={sending}>
          <X size={15} /> Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={sending || target.recipients.length === 0}
          className="btn-primary disabled:opacity-40"
        >
          <Send size={15} /> {sending ? "Enviando..." : "Confirmar y Enviar"}
        </button>
      </div>
    </div>
  );
}

interface ReceiptTarget {
  paymentId:   string;
  studentName: string;
  amount:      number;
  paidDate:    string;
  concept:     string;
  recipients:  { label: string; name: string; email: string }[];
}

function buildReceiptTarget(p: Payment): ReceiptTarget {
  const recipients: { label: string; name: string; email: string }[] = [];
  if (p.student.motherEmail)
    recipients.push({ label: "Madre / Tutora", name: p.student.motherName ?? "—", email: p.student.motherEmail });
  if (p.student.fatherEmail)
    recipients.push({ label: "Padre / Tutor",  name: p.student.fatherName ?? "—", email: p.student.fatherEmail });
  const concept = `Mensualidad ${new Date(p.dueDate).toLocaleDateString("es-PA", { month: "long", year: "numeric" })}`;
  return {
    paymentId:   p.id,
    studentName: p.student.fullName,
    amount:      p.amount,
    paidDate:    p.paidDate ? formatDate(p.paidDate) : formatDate(p.dueDate),
    concept,
    recipients,
  };
}

function ReceiptConfirmModal({
  target, onClose, onConfirm, sending,
}: {
  target:    ReceiptTarget;
  onClose:   () => void;
  onConfirm: () => void;
  sending:   boolean;
}) {
  const currency = useDojoCurrency();
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
        <FileText size={16} className="text-blue-400 shrink-0 mt-0.5" />
        <p className="text-blue-300 text-sm font-medium">
          Verifique los datos antes de enviar el recibo de pago.
        </p>
      </div>

      <div className="bg-dojo-dark border border-dojo-border rounded-lg p-4 space-y-2">
        <p className="text-xs text-dojo-muted uppercase tracking-wider mb-3">Datos del recibo</p>
        <div className="flex justify-between text-sm">
          <span className="text-dojo-muted">Alumno</span>
          <span className="text-dojo-white font-semibold">{target.studentName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-dojo-muted">Concepto</span>
          <span className="text-dojo-white">{target.concept}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-dojo-muted">Monto</span>
          <span className="text-green-400 font-bold">{formatCurrency(target.amount, currency)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-dojo-muted">Fecha de pago</span>
          <span className="text-dojo-white">{target.paidDate}</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-dojo-muted uppercase tracking-wider">Destinatario(s)</p>
        {target.recipients.length === 0 ? (
          <div className="flex items-start gap-3 p-3 bg-red-900/20 border border-red-800/40 rounded-lg">
            <Mail size={15} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">Sin correos registrados. Agregue correos en el perfil del alumno.</p>
          </div>
        ) : (
          target.recipients.map(r => (
            <div key={r.email} className="flex items-center gap-3 p-3 bg-dojo-dark border border-dojo-border rounded-lg">
              <Mail size={15} className="text-green-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-dojo-muted">{r.label}</p>
                <p className="text-sm text-dojo-white font-medium">{r.name}</p>
                <p className="text-xs text-green-400 font-mono truncate">{r.email}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary" disabled={sending}>
          <X size={15} /> Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={sending || target.recipients.length === 0}
          className="btn-primary disabled:opacity-40"
        >
          <Send size={15} /> {sending ? "Enviando..." : "Enviar Recibo"}
        </button>
      </div>
    </div>
  );
}

// ── Ordenamiento de columnas (tabla desktop) ────────────────────────────────

type SortField = "name" | "type" | "amount" | "dueDate" | "paidDate" | "status";
type SortDir   = "asc" | "desc";

function SortTh({
  label, field, sortField, sortDir, onSort,
}: {
  label: string; field: SortField; sortField: SortField | null; sortDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <TableHead
      onClick={() => onSort(field)}
      className="cursor-pointer select-none hover:text-dojo-white transition-colors group"
    >
      <span className="flex items-center gap-1">
        {label}
        <span className="text-dojo-border group-hover:text-dojo-muted transition-colors">
          {active
            ? sortDir === "asc" ? <ChevronUp size={12} className="text-dojo-gold" /> : <ChevronDown size={12} className="text-dojo-gold" />
            : <ChevronsUpDown size={12} />
          }
        </span>
      </span>
    </TableHead>
  );
}

function GenerateModal({
  onClose, onConfirm, generating, result,
}: {
  onClose:    () => void;
  onConfirm:  () => void;
  generating: boolean;
  result:     { created: number; skipped: number } | null;
}) {
  const tz        = useDojoTimeZone();
  const now       = new Date();
  const monthName = now.toLocaleDateString("es-PA", { timeZone: tz, month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      {!result ? (
        <>
          <div className="flex items-start gap-3 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
            <CalendarPlus size={16} className="text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-300 text-sm font-medium">Generar pagos de {monthName}</p>
              <p className="text-yellow-200/70 text-xs mt-1">
                Se creará un pago pendiente para cada alumno activo que tenga mensualidad configurada y no tenga registro del mes actual.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={generating}>
              <X size={15} /> Cancelar
            </button>
            <button type="button" onClick={onConfirm} disabled={generating} className="btn-primary">
              <CalendarPlus size={15} /> {generating ? "Generando..." : "Generar"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle size={40} className="text-green-400" />
            <p className="text-dojo-white font-semibold text-lg">Mensualidades generadas</p>
            <div className="grid grid-cols-2 gap-4 w-full mt-2">
              <div className="bg-green-900/20 border border-green-800/40 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-400">{result.created}</p>
                <p className="text-xs text-dojo-muted">Pagos creados</p>
              </div>
              <div className="bg-dojo-dark border border-dojo-border rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-dojo-muted">{result.skipped}</p>
                <p className="text-xs text-dojo-muted">Ya existían</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-primary w-full justify-center">
            Aceptar
          </button>
        </>
      )}
    </div>
  );
}

export default function PaymentsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const canEdit = role === "admin" || role === "sysadmin";
  const currency = useDojoCurrency();

  const [payments,     setPayments]     = useState<Payment[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatus]       = useState("all");
  const [typeFilter,   setType]         = useState("all");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [sending,      setSending]      = useState(false);
  const [sentMsg,      setSentMsg]      = useState("");
  const [marking,      setMarking]      = useState<string | null>(null);

  const [reminderTarget,   setReminderTarget]   = useState<ReminderTarget | null>(null);
  const [sendingReminder,  setSendingReminder]  = useState(false);
  const [receiptTarget,    setReceiptTarget]    = useState<ReceiptTarget | null>(null);
  const [sendingReceipt,   setSendingReceipt]   = useState(false);
  const [showGenerate,     setShowGenerate]     = useState(false);
  const [generating,       setGenerating]       = useState(false);
  const [generateResult,   setGenerateResult]   = useState<{ created: number; skipped: number } | null>(null);
  const [editTarget,       setEditTarget]       = useState<Payment | null>(null);
  const [sortField,        setSortField]        = useState<SortField | null>(null);
  const [sortDir,          setSortDir]          = useState<SortDir>("desc");

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter   !== "all") params.set("type",   typeFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo)   params.set("dateTo",   dateTo);
    const r = await fetch(`/api/payments?${params}`);
    if (r.ok) setPayments(await r.json());
    setLoading(false);
  }, [statusFilter, typeFilter, dateFrom, dateTo]);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function sendBulkReminders() {
    setSending(true); setSentMsg("");
    const r = await fetch("/api/payments", { method: "PATCH" });
    const d = await r.json();
    setSentMsg(`Procesados: ${d.processed} pagos, enviados: ${d.emailsSent} correos.`);
    setSending(false);
    fetch_();
  }

  async function confirmSendReminder() {
    if (!reminderTarget) return;
    setSendingReminder(true);
    const r = await fetch("/api/payments/remind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: reminderTarget.paymentId }),
    });
    const d = await r.json();
    setSendingReminder(false);
    setReminderTarget(null);
    if (r.ok) {
      setSentMsg(`Recordatorio enviado a ${d.sent} correo(s).`);
      fetch_();
    } else {
      setSentMsg(`Error: ${d.error}`);
    }
  }

  async function generateMonthly() {
    setGenerating(true);
    const r = await fetch("/api/payments/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const d = await r.json();
    setGenerateResult(r.ok ? d : null);
    setGenerating(false);
    if (r.ok) fetch_();
  }

  async function confirmSendReceipt() {
    if (!receiptTarget) return;
    setSendingReceipt(true);
    const r = await fetch("/api/payments/receipt", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ paymentId: receiptTarget.paymentId }),
    });
    const d = await r.json();
    setSendingReceipt(false);
    setReceiptTarget(null);
    setSentMsg(r.ok ? `Recibo enviado a ${d.sent} correo(s).` : `Error: ${d.error}`);
  }

  async function markPaid(id: string) {
    setMarking(id);
    await fetch("/api/payments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "paid", paidDate: new Date().toISOString() }),
    });
    setMarking(null);
    fetch_();
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  }

  const filtered = payments.filter(p => {
    const name = p.student.fullName.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const displayed = sortField ? [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "name":     cmp = a.student.fullName.localeCompare(b.student.fullName, "es"); break;
      case "type":     cmp = getPaymentTypeLabel(a.type).localeCompare(getPaymentTypeLabel(b.type), "es"); break;
      case "amount":   cmp = a.amount - b.amount; break;
      case "dueDate":  cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); break;
      case "paidDate": cmp = (a.paidDate ? new Date(a.paidDate).getTime() : -Infinity) - (b.paidDate ? new Date(b.paidDate).getTime() : -Infinity); break;
      case "status":   cmp = (PAYMENT_STATUS_LABELS[a.status]?.label ?? a.status).localeCompare(PAYMENT_STATUS_LABELS[b.status]?.label ?? b.status, "es"); break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  }) : filtered;

  const totals = {
    pending: payments.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0),
    late:    payments.filter(p => p.status === "late")   .reduce((s, p) => s + p.amount, 0),
    paid:    payments.filter(p => p.status === "paid")   .reduce((s, p) => s + p.amount, 0),
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
            <CreditCard size={24} className="text-dojo-red" /> Pagos
          </h1>
          <p className="text-dojo-muted text-sm mt-1">{filtered.length} registro(s)</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={() => { setGenerateResult(null); setShowGenerate(true); }}
            className="btn-secondary"
          >
            <CalendarPlus size={16}/> Generar Mensualidades
          </button>
          <button onClick={sendBulkReminders} disabled={sending} className="btn-secondary">
            <Bell size={16}/> {sending ? "Enviando..." : "Recordatorios Masivos"}
          </button>
        </div>
      </div>

      {sentMsg && (
        <div className="bg-green-900/30 border border-green-800 rounded-lg p-3 text-green-300 text-sm flex items-center gap-2">
          <CheckCircle size={16}/> {sentMsg}
          <button onClick={() => setSentMsg("")} className="ml-auto text-green-400 hover:text-green-200">
            <X size={14}/>
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Pendientes", amount: totals.pending, className: "text-yellow-400", bg: "bg-yellow-900/20 border-yellow-800/30" },
          { label: "Atrasados",  amount: totals.late,    className: "text-red-400",    bg: "bg-red-900/20 border-red-800/30"       },
          { label: "Cobrado",    amount: totals.paid,    className: "text-green-400",  bg: "bg-green-900/20 border-green-800/30"   },
        ].map(s => (
          <div key={s.label} className={`card border ${s.bg}`}>
            <p className="text-xs text-dojo-muted uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.className}`}>{formatCurrency(s.amount, currency)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted"/>
          <Input value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 w-56" placeholder="Buscar alumno..." />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-dojo-muted"/>
          <Select value={statusFilter} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="late">Atrasado</SelectItem>
              <SelectItem value="paid">Pagado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={typeFilter} onValueChange={setType}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="monthly">Mensualidades</SelectItem>
            <SelectItem value="biweekly">Quincenales</SelectItem>
            <SelectItem value="annual">Anualidades</SelectItem>
            <SelectItem value="affiliation">Afiliaciones</SelectItem>
            <SelectItem value="other">Otros</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="w-[150px]" aria-label="Vencimiento desde" title="Vencimiento desde" />
          <span className="text-dojo-muted text-xs">a</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="w-[150px]" aria-label="Vencimiento hasta" title="Vencimiento hasta" />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="btn-ghost text-xs px-3 flex items-center gap-1">
            <X size={12}/> Limpiar fechas
          </button>
        )}
      </div>

      {/* ── Vista mobile: tarjetas ── */}
      <div className="block lg:hidden space-y-3">
        {loading && <div className="text-center py-8 text-dojo-muted">Cargando...</div>}
        {!loading && displayed.length === 0 && (
          <div className="text-center py-8 text-dojo-muted">No hay pagos que coincidan.</div>
        )}
        {!loading && displayed.map(p => {
          const st = PAYMENT_STATUS_LABELS[p.status] ?? { label: p.status, className: "badge-blue" };
          return (
            <div key={p.id} className="bg-dojo-dark border border-dojo-border rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-dojo-white truncate">{p.student.fullName}</p>
                  <p className="text-xs text-dojo-muted mt-0.5">
                    {getPaymentTypeLabel(p.type)} · Vence {formatDate(p.dueDate)}
                  </p>
                </div>
                <span className={`${st.className} shrink-0`}>{st.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold text-dojo-gold">{formatCurrency(p.amount, currency)}</p>
                {p.paidDate && (
                  <p className="text-xs text-dojo-muted">Pagado {formatDate(p.paidDate)}</p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {p.status !== "paid" && (
                  <button
                    onClick={() => markPaid(p.id)}
                    disabled={marking === p.id}
                    className="btn-primary text-xs py-1.5 px-3 flex-1 justify-center disabled:opacity-50"
                  >
                    {marking === p.id ? "..." : "✓ Pagado"}
                  </button>
                )}
                {p.status !== "paid" && (
                  <button
                    onClick={() => setReminderTarget(buildTarget(p))}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                  >
                    <Bell size={12}/> Recordatorio
                  </button>
                )}
                {p.status === "paid" && (
                  <button
                    onClick={() => setReceiptTarget(buildReceiptTarget(p))}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                  >
                    <FileText size={12}/> Recibo
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => setEditTarget(p)}
                    className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1 text-dojo-muted hover:text-dojo-white"
                  >
                    <Pencil size={12}/> Editar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Vista desktop: tabla ── */}
      <div className="hidden lg:block card p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortTh label="Alumno"      field="name"     sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Tipo"        field="type"     sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Monto"       field="amount"   sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Vencimiento" field="dueDate"  sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Pago"        field="paidDate" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Estado"      field="status"   sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-dojo-muted">Cargando...</TableCell></TableRow>
            )}
            {!loading && displayed.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-dojo-muted">No hay pagos que coincidan.</TableCell></TableRow>
            )}
            {displayed.map(p => {
              const st = PAYMENT_STATUS_LABELS[p.status] ?? { label: p.status, className: "badge-blue", variant: "info" as const };
              return (
                <TableRow
                  key={p.id}
                  onDoubleClick={() => router.push(`/dashboard/students/${p.studentId}`)}
                  className="cursor-pointer"
                  title="Doble clic para ver el perfil del alumno"
                >
                  <TableCell className="font-semibold">
                    {p.student.fullName}
                  </TableCell>
                  <TableCell className="text-dojo-muted capitalize">
                    {getPaymentTypeLabel(p.type)}
                  </TableCell>
                  <TableCell className="text-dojo-gold font-bold">{formatCurrency(p.amount, currency)}</TableCell>
                  <TableCell className="text-dojo-muted">{formatDate(p.dueDate)}</TableCell>
                  <TableCell className="text-dojo-muted">{p.paidDate ? formatDate(p.paidDate) : "—"}</TableCell>
                  <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                  <TableCell onDoubleClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-3">
                      {p.status !== "paid" && (
                        <button
                          onClick={() => markPaid(p.id)}
                          disabled={marking === p.id}
                          className="text-xs text-green-400 hover:text-green-300 font-semibold transition-colors whitespace-nowrap disabled:opacity-50"
                        >
                          {marking === p.id ? "..." : "✓ Pagado"}
                        </button>
                      )}
                      {p.status !== "paid" && (
                        <button
                          onClick={() => setReminderTarget(buildTarget(p))}
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
                        >
                          <Bell size={12}/>
                          {p.reminderSent ? "Re-enviar" : "Recordatorio"}
                        </button>
                      )}
                      {p.status === "paid" && (
                        <button
                          onClick={() => setReceiptTarget(buildReceiptTarget(p))}
                          className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors whitespace-nowrap"
                        >
                          <FileText size={12}/> Enviar Recibo
                        </button>
                      )}
                      {p.reminderSent && p.status !== "paid" && (
                        <span className="text-xs text-dojo-muted flex items-center gap-1">
                          <CheckCircle size={11} className="text-yellow-500"/>
                        </span>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => setEditTarget(p)}
                          className="flex items-center gap-1 text-xs text-dojo-muted hover:text-dojo-white transition-colors whitespace-nowrap"
                          title="Editar pago"
                        >
                          <Pencil size={12}/> Editar
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>{/* card desktop */}

      {/* Modal recordatorio */}
      <Dialog open={!!reminderTarget} onOpenChange={(o) => !o && setReminderTarget(null)}>
        <DialogContent size="md">
          <DialogHeader><DialogTitle>Confirmar Envío de Recordatorio</DialogTitle></DialogHeader>
          {reminderTarget && (
            <ReminderConfirmModal
              target={reminderTarget}
              onClose={() => setReminderTarget(null)}
              onConfirm={confirmSendReminder}
              sending={sendingReminder}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal recibo */}
      <Dialog open={!!receiptTarget} onOpenChange={(o) => !o && setReceiptTarget(null)}>
        <DialogContent size="md">
          <DialogHeader><DialogTitle>Enviar Recibo de Pago</DialogTitle></DialogHeader>
          {receiptTarget && (
            <ReceiptConfirmModal
              target={receiptTarget}
              onClose={() => setReceiptTarget(null)}
              onConfirm={confirmSendReceipt}
              sending={sendingReceipt}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal generar mensualidades */}
      <Dialog open={showGenerate} onOpenChange={(o) => !o && setShowGenerate(false)}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Generar Pagos del Período</DialogTitle></DialogHeader>
          <GenerateModal
            onClose={() => setShowGenerate(false)}
            onConfirm={generateMonthly}
            generating={generating}
            result={generateResult}
          />
        </DialogContent>
      </Dialog>

      {/* Modal editar pago */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent size="md">
          <DialogHeader><DialogTitle>Editar Pago</DialogTitle></DialogHeader>
          {editTarget && (
            <EditPaymentModal
              payment={{
                id:          editTarget.id,
                type:        editTarget.type,
                amount:      editTarget.amount,
                dueDate:     editTarget.dueDate,
                paidDate:    editTarget.paidDate,
                status:      editTarget.status,
                note:        editTarget.note,
                studentName: editTarget.student.fullName,
              }}
              onClose={() => setEditTarget(null)}
              onSaved={() => { void fetch_(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
