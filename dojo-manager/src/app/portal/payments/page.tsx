import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { formatDate, formatCurrency, PAYMENT_STATUS_LABELS } from "@/lib/utils";

export default async function PortalPaymentsPage() {
  const session   = await getServerSession(authOptions);
  const studentId = (session?.user as { studentId?: string | null })?.studentId!;

  const payments = await prisma.payment.findMany({
    where:   { studentId },
    orderBy: { dueDate: "desc" },
    take:    48,
  });

  const totals = {
    paid:    payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0),
    pending: payments.filter(p => p.status !== "paid").reduce((s, p) => s + p.amount, 0),
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-bold text-dojo-white">Mis Pagos</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="card border border-green-800/40 bg-green-900/10 text-center">
          <p className="text-xs text-dojo-muted mb-1">Pagado</p>
          <p className="text-lg font-bold text-green-400">{formatCurrency(totals.paid)}</p>
        </div>
        <div className="card border border-yellow-800/40 bg-yellow-900/10 text-center">
          <p className="text-xs text-dojo-muted mb-1">Pendiente</p>
          <p className="text-lg font-bold text-yellow-400">{formatCurrency(totals.pending)}</p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {payments.length === 0 ? (
          <p className="text-center text-dojo-muted py-8 text-sm">Sin pagos registrados.</p>
        ) : (
          <div className="divide-y divide-dojo-border">
            {payments.map(p => {
              const st = PAYMENT_STATUS_LABELS[p.status] ?? { label: p.status, className: "badge-blue" };
              return (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm text-dojo-white font-medium">
                      {p.type === "monthly" ? "Mensualidad" : "Anualidad"}
                    </p>
                    <p className="text-xs text-dojo-muted">Vence: {formatDate(p.dueDate)}</p>
                    {p.paidDate && <p className="text-xs text-green-400">Pagado: {formatDate(p.paidDate)}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-dojo-gold font-bold">{formatCurrency(p.amount)}</p>
                    <span className={`${st.className} text-xs`}>{st.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
