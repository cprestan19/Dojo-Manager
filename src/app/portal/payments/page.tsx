import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { formatDate, formatCurrency, PAYMENT_STATUS_LABELS, getPaymentTypeLabel } from "@/lib/utils";
import { Users } from "lucide-react";

export default async function PortalPaymentsPage() {
  const session   = await getServerSession(authOptions);
  const studentId = (session?.user as { studentId?: string | null })?.studentId!;

  const me = await prisma.student.findUnique({
    where:  { id: studentId },
    select: { id: true, fullName: true, familyId: true, dojoId: true },
  });
  if (!me) return null;

  let members: { id: string; fullName: string; isMe: boolean }[];

  if (me.familyId) {
    const siblings = await prisma.student.findMany({
      where:   { familyId: me.familyId, dojoId: me.dojoId, active: true },
      select:  { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    });
    members = siblings.map(m => ({ ...m, isMe: m.id === me.id }));
  } else {
    members = [{ id: me.id, fullName: me.fullName, isMe: true }];
  }

  const isFamily = members.length > 1;

  const payments = await prisma.payment.findMany({
    where:   { studentId: { in: members.map(m => m.id) } },
    orderBy: { dueDate: "desc" },
    take:    96,
  });

  const totals = {
    paid:    payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0),
    pending: payments.filter(p => p.status !== "paid").reduce((s, p) => s + p.amount, 0),
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-bold text-dojo-white">
        {isFamily ? "Pagos de la Familia" : "Mis Pagos"}
      </h1>

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

      {payments.length === 0 ? (
        <div className="card text-center py-8 text-dojo-muted text-sm">
          Sin pagos registrados.
        </div>
      ) : isFamily ? (
        <div className="space-y-5">
          {members.map(member => {
            const memberPayments = payments.filter(p => p.studentId === member.id);
            if (memberPayments.length === 0) return null;
            return (
              <div key={member.id} className="space-y-2">
                <div className="flex items-center gap-2 pb-1 border-b border-dojo-border/50">
                  <Users size={13} className="text-dojo-muted shrink-0" />
                  <span className="text-sm font-semibold text-dojo-white">
                    {member.fullName}
                    {member.isMe && (
                      <span className="text-dojo-muted font-normal text-xs ml-1.5">(yo)</span>
                    )}
                  </span>
                  <span className="text-xs text-dojo-muted ml-auto">
                    {memberPayments.length} registro{memberPayments.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="card p-0 overflow-hidden">
                  <div className="divide-y divide-dojo-border">
                    {memberPayments.map(p => {
                      const st = PAYMENT_STATUS_LABELS[p.status] ?? { label: p.status, className: "badge-blue" };
                      return (
                        <div key={p.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-sm text-dojo-white font-medium">
                              {getPaymentTypeLabel(p.type)}
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
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="divide-y divide-dojo-border">
            {payments.map(p => {
              const st = PAYMENT_STATUS_LABELS[p.status] ?? { label: p.status, className: "badge-blue" };
              return (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm text-dojo-white font-medium">
                      {getPaymentTypeLabel(p.type)}
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
        </div>
      )}
    </div>
  );
}
