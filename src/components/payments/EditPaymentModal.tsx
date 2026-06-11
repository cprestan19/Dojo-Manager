"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { getPaymentTypeLabel } from "@/lib/utils";

export interface PaymentForEdit {
  id:       string;
  type:     string;
  amount:   number;
  dueDate:  string;
  paidDate: string | null;
  status:   string;
  note:     string | null;
  studentName?: string; // opcional — se muestra como contexto
}

interface Props {
  payment:  PaymentForEdit;
  onClose:  () => void;
  onSaved:  () => void;
}

export function EditPaymentModal({ payment, onClose, onSaved }: Props) {
  const [amount,   setAmount]  = useState(String(payment.amount));
  const [dueDate,  setDueDate] = useState(payment.dueDate.slice(0, 10));
  const [status,   setStatus]  = useState(payment.status);
  const [paidDate, setPaid]    = useState(
    payment.paidDate
      ? payment.paidDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [note,     setNote]    = useState(payment.note ?? "");
  const [saving,   setSaving]  = useState(false);
  const [error,    setError]   = useState("");

  async function save() {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed < 0) { setError("El monto no puede ser negativo."); return; }
    if (!dueDate)                     { setError("La fecha de vencimiento es requerida."); return; }

    setSaving(true);
    setError("");

    const body: Record<string, unknown> = {
      id:      payment.id,
      amount:  parsed,
      dueDate,
      status,
      note:    note.trim() || null,
      paidDate: status === "paid" ? paidDate : null,
    };

    const res = await fetch("/api/payments", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    setSaving(false);

    if (res.ok) {
      onSaved();
      onClose();
    } else {
      const d = await res.json() as { error?: string };
      setError(d.error ?? "Error al guardar. Intenta de nuevo.");
    }
  }

  return (
    <div className="space-y-5">
      {/* Contexto — solo lectura */}
      <div className="bg-dojo-darker border border-dojo-border rounded-xl px-4 py-3 space-y-0.5">
        {payment.studentName && (
          <p className="text-dojo-white font-semibold">{payment.studentName}</p>
        )}
        <p className="text-xs text-dojo-muted">
          {getPaymentTypeLabel(payment.type)}
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Monto y vencimiento */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Monto (USD)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted text-sm">$</span>
            <input
              type="number" step="0.01" min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="form-input pl-7"
              placeholder="0.00"
            />
          </div>
        </div>
        <div>
          <label className="form-label">Fecha de vencimiento</label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="form-input"
          />
        </div>
      </div>

      {/* Estado */}
      <div>
        <label className="form-label">Estado</label>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="form-input"
        >
          <option value="pending">Pendiente</option>
          <option value="paid">Pagado</option>
          <option value="late">Atrasado</option>
        </select>
      </div>

      {/* Fecha de pago — solo cuando status = paid */}
      {status === "paid" && (
        <div>
          <label className="form-label">Fecha de pago</label>
          <input
            type="date"
            value={paidDate}
            onChange={e => setPaid(e.target.value)}
            className="form-input"
          />
        </div>
      )}

      {/* Nota interna */}
      <div>
        <label className="form-label">
          Nota interna <span className="text-dojo-muted font-normal">(opcional)</span>
        </label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Observaciones, descuentos, acuerdos…"
          className="form-input resize-none"
        />
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="btn-primary flex-1 justify-center disabled:opacity-50"
        >
          {saving
            ? <><Loader2 size={14} className="animate-spin" /> Guardando...</>
            : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="btn-secondary"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
