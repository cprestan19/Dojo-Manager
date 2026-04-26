import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Users, CreditCard, Award, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { DashboardMobileCards } from "@/components/dashboard/DashboardMobileCards";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const dojoId  = (session?.user as { dojoId?: string | null })?.dojoId ?? null;

  const baseStudentWhere = dojoId ? { dojoId } : {};
  const basePaymentWhere = dojoId ? { student: { dojoId } } : {};

  // All counts + aggregate in one parallel batch
  const [totalStudents, activeStudents, pendingPayments, latePayments, collectedThisMonth, pendingAggregate, recentStudents] =
    await Promise.all([
      prisma.student.count({ where: baseStudentWhere }),
      prisma.student.count({ where: { ...baseStudentWhere, active: true } }),
      prisma.payment.count({ where: { ...basePaymentWhere, status: "pending" } }),
      prisma.payment.count({ where: { ...basePaymentWhere, status: "late"    } }),
      prisma.payment.aggregate({
        where: {
          ...basePaymentWhere,
          status:   "paid",
          paidDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { ...basePaymentWhere, status: { in: ["pending", "late"] } },
        _sum:  { amount: true },
      }),
      prisma.student.findMany({
        where: { ...baseStudentWhere },
        take:  5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, fullName: true, firstName: true, lastName: true, birthDate: true,
          beltHistory: {
            orderBy: { changeDate: "desc" },
            take: 1,
            select: { beltColor: true },
          },
        },
      }),
    ]);

  const lateStudentsRaw = await prisma.payment.findMany({
    where: { ...basePaymentWhere, status: { in: ["pending", "late"] } },
    include: {
      student: { select: { id: true, fullName: true, firstName: true, lastName: true, motherEmail: true, fatherEmail: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const lateStudents = lateStudentsRaw.map(p => ({
    ...p,
    dueDate: p.dueDate.toISOString(),
  }));

  const stats = [
    { label: "Total Alumnos",    value: totalStudents,  sub: `${activeStudents} activos`,    icon: Users,         color: "text-blue-400",   bg: "bg-blue-900/30"   },
    { label: "Pagos Pendientes", value: pendingPayments, sub: `${latePayments} atrasados`,   icon: CreditCard,    color: "text-yellow-400", bg: "bg-yellow-900/30" },
    { label: "Cobrado este Mes", value: formatCurrency(collectedThisMonth._sum.amount ?? 0), sub: "pagos registrados", icon: CreditCard, color: "text-green-400", bg: "bg-green-900/30" },
    { label: "Pagos Atrasados",  value: latePayments,   sub: "requieren atención",           icon: AlertTriangle, color: "text-red-400",    bg: "bg-red-900/30"    },
  ];

  return (
    <div className="space-y-6 lg:space-y-8">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold text-dojo-white tracking-wide">
          Bienvenido, <span className="text-dojo-red">{session?.user?.name}</span>
        </h1>
        <p className="text-dojo-muted mt-1 text-sm">Panel de control del Dojo</p>
      </div>

      <DashboardMobileCards
        activeStudents={activeStudents}
        paidThisMonth={collectedThisMonth._sum.amount ?? 0}
        pendingCount={pendingPayments + latePayments}
        pendingAmount={pendingAggregate._sum.amount ?? 0}
        lateStudents={lateStudents}
      />

      <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card flex items-center gap-4">
              <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center shrink-0`}>
                <Icon size={22} className={stat.color} />
              </div>
              <div>
                <p className="text-2xl font-bold text-dojo-white">{stat.value}</p>
                <p className="text-xs text-dojo-muted">{stat.label}</p>
                <p className="text-xs text-dojo-muted/70">{stat.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <p className="section-title flex items-center gap-2"><Users size={14}/> Alumnos Recientes</p>
        <div className="space-y-3">
          {recentStudents.length === 0 && (
            <p className="text-dojo-muted text-sm text-center py-4">No hay alumnos registrados aún.</p>
          )}
          {recentStudents.map((s) => {
            const belt = s.beltHistory[0]?.beltColor ?? "sin cinta";
            const age  = Math.floor((Date.now() - new Date(s.birthDate).getTime()) / (365.25 * 86400000));
            return (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-dojo-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-dojo-border rounded-full flex items-center justify-center text-sm font-bold text-dojo-gold">
                    {s.fullName.split(" ").slice(0,2).map(w => w[0]).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-dojo-white">{s.fullName}</p>
                    <p className="text-xs text-dojo-muted">{age} años</p>
                  </div>
                </div>
                <span className="text-xs text-dojo-muted capitalize">{belt}</span>
              </div>
            );
          })}
        </div>
      </div>

      {totalStudents === 0 && (
        <div className="bg-dojo-gold/10 border border-dojo-gold/30 rounded-xl p-4 flex gap-3">
          <Award className="text-dojo-gold shrink-0 mt-0.5" size={18}/>
          <div>
            <p className="text-dojo-gold font-semibold text-sm">¡Sistema listo!</p>
            <p className="text-dojo-muted text-xs mt-1">
              Empieza creando alumnos en el módulo de <strong className="text-dojo-white">Alumnos</strong>.
              El catálogo de Katas ya fue cargado con los kata predeterminados.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
