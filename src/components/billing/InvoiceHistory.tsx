"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";

interface Invoice {
  id:              string;
  amount:          number;
  currency:        string;
  status:          string;
  gateway:         string;
  gatewayInvoiceId: string | null;
  paidAt:          string | null;
  createdAt:       string;
}

const STATUS_BADGE: Record<string, string> = {
  PAID:     "badge-green",
  PENDING:  "badge-yellow",
  FAILED:   "badge-red",
  REFUNDED: "text-dojo-muted bg-dojo-border rounded-full px-2 py-0.5 text-xs",
};
const STATUS_LABEL: Record<string, string> = {
  PAID: "Pagada", PENDING: "Pendiente", FAILED: "Fallida", REFUNDED: "Reembolsada",
};

export function InvoiceHistory() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const limit = 10;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/billing/invoices?page=${p}&limit=${limit}`);
      const data = await res.json() as { invoices: Invoice[]; total: number };
      setInvoices(data.invoices ?? []);
      setTotal(data.total ?? 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(page); }, [page, load]);

  if (!loading && invoices.length === 0) {
    return (
      <div className="card text-center py-10">
        <Receipt size={32} className="mx-auto mb-2 text-dojo-muted opacity-40" />
        <p className="text-dojo-muted text-sm">Sin facturas aún.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-3">
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dojo-border bg-dojo-darker/60">
              <th className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3">Fecha</th>
              <th className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3">Monto</th>
              <th className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3">Pasarela</th>
              <th className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8 text-dojo-muted">Cargando...</td></tr>
            ) : invoices.map(inv => (
              <tr key={inv.id} className="border-b border-dojo-border/50 hover:bg-dojo-border/10">
                <td className="px-4 py-3 text-dojo-muted">
                  {new Date(inv.paidAt ?? inv.createdAt).toLocaleDateString("es-PA")}
                </td>
                <td className="px-4 py-3 font-semibold text-dojo-white">
                  ${inv.amount.toFixed(2)} {inv.currency}
                </td>
                <td className="px-4 py-3 text-dojo-muted capitalize">
                  {inv.gateway === "PAYPAL" ? "PayPal" : "MercadoPago"}
                </td>
                <td className="px-4 py-3">
                  <span className={STATUS_BADGE[inv.status] ?? "text-dojo-muted"}>
                    {STATUS_LABEL[inv.status] ?? inv.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-dojo-muted">{total} factura{total !== 1 ? "s" : ""}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-ghost p-1.5 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-dojo-muted">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-ghost p-1.5 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
