"use client";
import { useState, useEffect, useCallback } from "react";
import { CreditCard, Search, Bell, CheckCircle, Filter } from "lucide-react";
import { formatDate, formatCurrency, PAYMENT_STATUS_LABELS } from "@/lib/utils";

interface Payment {
  id: string; type: string; amount: number;
  dueDate: string; paidDate: string | null; status: string; note: string | null;
  reminderSent: boolean;
  student: { firstName: string; lastName: string; motherEmail: string | null; fatherEmail: string | null; };
}

export default function PaymentsPage() {
  const [payments,  setPayments]  = useState<Payment[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [typeFilter,   setType]   = useState("all");
  const [sending,   setSending]   = useState(false);
  const [sentMsg,   setSentMsg]   = useState("");
  const [marking,   setMarking]   = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter   !== "all") params.set("type",   typeFilter);
    const r = await fetch(`/api/payments?${params}`);
    if (r.ok) setPayments(await r.json());
    setLoading(false);
  }, [statusFilter, typeFilter]);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function sendReminders() {
    setSending(true); setSentMsg("");
    const r = await fetch("/api/payments", { method: "PATCH" });
    const d = await r.json();
    setSentMsg(`Procesados: ${d.processed} pagos, enviados: ${d.emailsSent} correos.`);
    setSending(false);
    fetch_();
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

  const filtered = payments.filter(p => {
    const name = `${p.student.firstName} ${p.student.lastName}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

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
        <button onClick={sendReminders} disabled={sending} className="btn-secondary">
          <Bell size={16}/> {sending ? "Enviando..." : "Enviar Recordatorios"}
        </button>
      </div>

      {sentMsg && (
        <div className="bg-green-900/30 border border-green-800 rounded-lg p-3 text-green-300 text-sm flex items-center gap-2">
          <CheckCircle size={16}/> {sentMsg}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pendientes",  amount: totals.pending, className: "text-yellow-400", bg: "bg-yellow-900/20 border-yellow-800/30" },
          { label: "Atrasados",   amount: totals.late,    className: "text-red-400",    bg: "bg-red-900/20 border-red-800/30"       },
          { label: "Cobrado",     amount: totals.paid,    className: "text-green-400",  bg: "bg-green-900/20 border-green-800/30"   },
        ].map(s => (
          <div key={s.label} className={`card border ${s.bg}`}>
            <p className="text-xs text-dojo-muted uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.className}`}>{formatCurrency(s.amount)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="form-input pl-8 w-56" placeholder="Buscar alumno..." />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-dojo-muted"/>
          <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="form-input w-36">
            <option value="all">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="late">Atrasado</option>
            <option value="paid">Pagado</option>
          </select>
        </div>
        <select value={typeFilter} onChange={e => setType(e.target.value)} className="form-input w-36">
          <option value="all">Todos los tipos</option>
          <option value="monthly">Mensualidades</option>
          <option value="annual">Anualidades</option>
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dojo-border">
              {["Alumno","Tipo","Monto","Vencimiento","Pago","Estado","Correos","Acción"].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="text-center py-12 text-dojo-muted">Cargando...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-dojo-muted">No hay pagos que coincidan.</td></tr>
            )}
            {filtered.map(p => {
              const st = PAYMENT_STATUS_LABELS[p.status] ?? { label: p.status, className: "badge-blue" };
              return (
                <tr key={p.id} className="border-b border-dojo-border/40 hover:bg-dojo-border/10 transition-colors">
                  <td className="px-4 py-3 font-semibold text-dojo-white">
                    {p.student.firstName} {p.student.lastName}
                  </td>
                  <td className="px-4 py-3 text-dojo-muted capitalize">
                    {p.type === "monthly" ? "Mensualidad" : "Anualidad"}
                  </td>
                  <td className="px-4 py-3 text-dojo-gold font-bold">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3 text-dojo-muted">{formatDate(p.dueDate)}</td>
                  <td className="px-4 py-3 text-dojo-muted">{p.paidDate ? formatDate(p.paidDate) : "—"}</td>
                  <td className="px-4 py-3"><span className={st.className}>{st.label}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 text-xs text-dojo-muted">
                      {p.student.motherEmail && <span title={p.student.motherEmail}>M</span>}
                      {p.student.fatherEmail && <span title={p.student.fatherEmail}>P</span>}
                      {p.reminderSent && <span className="text-yellow-500" title="Recordatorio enviado">✓</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.status !== "paid" && (
                      <button onClick={() => markPaid(p.id)} disabled={marking === p.id}
                        className="text-xs text-green-400 hover:text-green-300 font-semibold transition-colors whitespace-nowrap">
                        {marking === p.id ? "..." : "✓ Pagado"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
