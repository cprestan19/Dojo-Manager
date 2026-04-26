"use client";
import { useState } from "react";
import Link from "next/link";
import { Users, CreditCard, AlertTriangle, CheckCircle, X, Bell, Mail } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface LateStudent {
  id: string;
  amount: number;
  dueDate: string;
  status: string;
  student: {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    motherEmail: string | null;
    fatherEmail: string | null;
  };
}

interface Props {
  activeStudents: number;
  paidThisMonth: number;
  pendingCount: number;
  pendingAmount: number;
  lateStudents: LateStudent[];
}

export function DashboardMobileCards({
  activeStudents,
  paidThisMonth,
  pendingCount,
  pendingAmount,
  lateStudents,
}: Props) {
  const [sheetOpen,  setSheetOpen]  = useState(false);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [sending,    setSending]    = useState(false);
  const [sentMsg,    setSentMsg]    = useState("");

  const allIds = lateStudents.map(p => p.id);

  function toggleAll() {
    setSelected(prev =>
      prev.size === allIds.length ? new Set() : new Set(allIds)
    );
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function sendReminders() {
    setSending(true);
    setSentMsg("");
    const r = await fetch("/api/payments", { method: "PATCH" });
    const d = await r.json();
    setSentMsg(`${d.emailsSent ?? 0} recordatorio(s) enviado(s).`);
    setSending(false);
  }

  const daysLate = (dueDate: string) =>
    Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000));

  return (
    <div className="block lg:hidden space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/dashboard/students"
          className="rounded-2xl border p-4 bg-blue-900/20 border-blue-800/40 active:opacity-70 transition-opacity"
        >
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-blue-400" />
            <span className="text-xs text-blue-400 font-semibold uppercase tracking-wide">Alumnos</span>
          </div>
          <p className="text-2xl font-bold text-dojo-white">{activeStudents}</p>
          <p className="text-xs text-dojo-muted mt-0.5">activos · ver lista →</p>
        </Link>

        <div className="rounded-2xl border p-4 bg-green-900/20 border-green-800/40">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} className="text-green-400" />
            <span className="text-xs text-green-400 font-semibold uppercase tracking-wide">Cobrado</span>
          </div>
          <p className="text-xl font-bold text-dojo-white">{formatCurrency(paidThisMonth)}</p>
          <p className="text-xs text-dojo-muted mt-0.5">este mes</p>
        </div>

        <button
          onClick={() => { setSheetOpen(true); setSentMsg(""); }}
          className="rounded-2xl border p-4 bg-yellow-900/20 border-yellow-800/40 text-left active:opacity-80"
        >
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={16} className="text-yellow-400" />
            <span className="text-xs text-yellow-400 font-semibold uppercase tracking-wide">Pendientes</span>
          </div>
          <p className="text-2xl font-bold text-dojo-white">{pendingCount}</p>
          <p className="text-xs text-dojo-muted mt-0.5">{formatCurrency(pendingAmount)}</p>
        </button>

        <button
          onClick={() => { setSheetOpen(true); setSentMsg(""); }}
          className="rounded-2xl border p-4 bg-red-900/20 border-red-800/40 text-left active:opacity-80"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-400" />
            <span className="text-xs text-red-400 font-semibold uppercase tracking-wide">Atrasados</span>
          </div>
          <p className="text-2xl font-bold text-dojo-white">
            {lateStudents.filter(p => p.status === "late").length}
          </p>
          <p className="text-xs text-dojo-muted mt-0.5">requieren atención</p>
        </button>
      </div>

      {sheetOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setSheetOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 rounded-t-2xl bg-dojo-dark border-t border-dojo-border max-h-[85vh] overflow-y-auto z-50 flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-dojo-border shrink-0">
              <p className="font-display text-dojo-white font-bold">Pagos Pendientes / Atrasados</p>
              <button onClick={() => setSheetOpen(false)}>
                <X size={18} className="text-dojo-muted" />
              </button>
            </div>

            {lateStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-dojo-muted">
                <CheckCircle size={36} className="mb-3 opacity-40" />
                <p className="text-sm">Sin pagos pendientes</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-dojo-border shrink-0">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.size === allIds.length && allIds.length > 0}
                      onChange={toggleAll}
                      className="w-4 h-4 accent-dojo-red"
                    />
                    <span className="text-sm text-dojo-white">
                      Seleccionar todos ({allIds.length})
                    </span>
                  </label>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-dojo-border">
                  {lateStudents.map(p => {
                    const days = daysLate(p.dueDate);
                    const hasMail = p.student.motherEmail || p.student.fatherEmail;
                    return (
                      <label key={p.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-dojo-border/20">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleOne(p.id)}
                          className="w-4 h-4 accent-dojo-red shrink-0"
                        />
                        <div className="w-9 h-9 bg-dojo-border rounded-full flex items-center justify-center text-xs font-bold text-dojo-gold shrink-0">
                          {p.student.fullName.split(" ").slice(0,2).map(w => w[0]).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-dojo-white truncate">
                            {p.student.fullName}
                          </p>
                          <p className="text-xs text-dojo-muted">
                            {formatCurrency(p.amount)} · vence {formatDate(p.dueDate)}
                            {days > 0 && <span className="text-red-400 ml-1">({days}d atraso)</span>}
                          </p>
                        </div>
                        {hasMail && (
                          <Mail size={13} className="text-dojo-muted shrink-0" />
                        )}
                      </label>
                    );
                  })}
                </div>

                <div className="px-4 py-4 border-t border-dojo-border shrink-0 space-y-2">
                  {sentMsg && (
                    <p className="text-green-400 text-sm text-center">{sentMsg}</p>
                  )}
                  <button
                    onClick={sendReminders}
                    disabled={sending || selected.size === 0}
                    className="btn-primary w-full justify-center disabled:opacity-50"
                  >
                    <Bell size={15} />
                    {sending ? "Enviando..." : `Enviar Recordatorios${selected.size > 0 ? ` (${selected.size})` : ""}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
